import type { TaskRow } from '@/app/api/tasks/route'
import {
  animalIdsFromTaskLogRows,
  buildFosterDirectory,
  strictTaskPresenceForRollup,
  type DogRecord,
  type FosterDirectoryItem,
  type FosterDog,
  type FosterStatus,
} from '@/app/lib/fosterDirectory'

/** Aggregate status for photo or survey lanes from Task Log rows (animal-level). */
export type TaskLane = 'none' | 'good' | 'overdue' | 'unknown' | 'not_in_log'

const LANE_WEIGHT: Record<TaskLane, number> = {
  overdue: 5,
  unknown: 4,
  not_in_log: 3,
  good: 2,
  none: 1,
}

export function laneWeight(l: TaskLane): number {
  return LANE_WEIGHT[l]
}

function worstLanes(...lanes: TaskLane[]): TaskLane {
  let w: TaskLane = 'none'
  for (const l of lanes) {
    if (LANE_WEIGHT[l] > LANE_WEIGHT[w]) w = l
  }
  return w
}

/** Active = still tracked for follow-ups (completed/retired = done for that row). */
function isRowActive(row: TaskRow): boolean {
  return row.status !== 'completed' && row.status !== 'retired'
}

/** Rank for picking the worst label across dogs in a home (higher = needs attention first). */
const SHEET_LABEL_RANK: Record<string, number> = {
  Overdue: 50,
  Unknown: 40,
  Good: 30,
  'Not in log': 20,
  Completed: 11,
  Retired: 11,
  'Completed / Retired': 11,
}

/**
 * Task Log **Status** for one dog and task family (PHOTOS_* / SURVEY_*), matching the sheet column.
 */
export function sheetStatusLabelForAnimalPrefix(
  rows: readonly TaskRow[],
  animalId: string,
  prefix: 'PHOTOS' | 'SURVEY'
): string {
  const relevant = rows.filter(
    r => r.animalId === animalId && r.taskType.startsWith(prefix)
  )
  if (relevant.length === 0) return 'Not in log'

  const active = relevant.filter(isRowActive)
  if (active.length > 0) {
    if (active.some(r => r.status === 'overdue')) return 'Overdue'
    if (active.some(r => r.status === 'unknown')) return 'Unknown'
    if (active.some(r => r.status === 'good')) return 'Good'
    return 'Good'
  }

  const hasCompleted = relevant.some(r => r.status === 'completed')
  const hasRetired = relevant.some(r => r.status === 'retired')
  if (hasCompleted && hasRetired) return 'Completed / Retired'
  if (hasRetired) return 'Retired'
  if (hasCompleted) return 'Completed'
  return 'Completed / Retired'
}

/** Worst Task Log status string across dogs (e.g. one Overdue and one Good → Overdue). */
export function worstSheetLabelAcrossHousehold(labels: readonly string[]): string {
  if (labels.length === 0) return 'Not in log'
  let maxR = -1
  for (const l of labels) {
    maxR = Math.max(maxR, SHEET_LABEL_RANK[l] ?? 0)
  }
  const atMax = labels.filter(l => (SHEET_LABEL_RANK[l] ?? 0) === maxR)
  if (maxR === 11) {
    const uniq = new Set(atMax)
    if (uniq.has('Completed') && uniq.has('Retired')) return 'Completed / Retired'
  }
  return atMax[0] ?? 'Not in log'
}

/** Summarize all PHOTOS_* or SURVEY_* rows for one animal ID. */
export function summarizeTaskLane(rows: TaskRow[], animalId: string, prefix: 'PHOTOS' | 'SURVEY'): TaskLane {
  const relevant = rows.filter(r => r.animalId === animalId && r.taskType.startsWith(prefix))
  if (relevant.length === 0) return 'not_in_log'

  const active = relevant.filter(isRowActive)
  if (active.length === 0) return 'none'

  if (active.some(r => r.status === 'overdue')) return 'overdue'
  if (active.some(r => r.status === 'unknown')) return 'unknown'
  if (active.some(r => r.status === 'good')) return 'good'
  return 'none'
}

/** Fallback label from internal lane enum (prefers {@link sheetStatusLabelForAnimalPrefix} on the fosters table). */
export function laneLabel(lane: TaskLane): string {
  switch (lane) {
    case 'overdue':
      return 'Overdue'
    case 'unknown':
      return 'Unknown'
    case 'good':
      return 'Good'
    case 'not_in_log':
      return 'Not in log'
    case 'none':
      return 'Cleared'
    default:
      return '—'
  }
}

export type EnrichedDog = FosterDog & {
  photoLane: TaskLane
  surveyLane: TaskLane
}

export type EnrichedFosterRow = Omit<FosterDirectoryItem, 'dogs'> & {
  dogs: EnrichedDog[]
  photoWorst: TaskLane
  surveyWorst: TaskLane
  /** Worst Task Log Status (sheet wording) for PHOTOS_* across dogs in the home. */
  photoHouseholdSheetLabel: string
  /** Worst Task Log Status for SURVEY_* across dogs in the home. */
  surveyHouseholdSheetLabel: string
  householdRollup: FosterStatus
  /**
   * Latest **milestone** date for PHOTOS_* in this home: prefers Completed; else max of Email sent/to send,
   * Scheduled send, Task retired. **Follow-up sent** is excluded (reminder you sent, not foster submission).
   */
  lastPhotoTaskActivityDate?: string
  /** Same milestone rules as {@link lastPhotoTaskActivityDate} for SURVEY_*. */
  lastSurveyTaskActivityDate?: string
}

/** Parse sheet-style dates for ordering (YYYY-MM-DD… or M/D/YYYY). */
function parseTaskSheetDateForSort(raw: string): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(d.getTime()) ? null : d.getTime()
  }
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdy) {
    const d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]))
    return Number.isNaN(d.getTime()) ? null : d.getTime()
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/**
 * Latest Task Log touch for rows matching `taskPrefix` (PHOTOS_* or SURVEY_*) for any dog in the household.
 * Prefers `completedDate`; if none, uses latest of follow-up sent, email sent, scheduled, or retired.
 */
export function householdLastTaskActivityDate(
  taskRows: readonly TaskRow[],
  animalIds: ReadonlySet<string>,
  taskPrefix: 'PHOTOS' | 'SURVEY'
): string | undefined {
  type Best = { ts: number; raw: string }
  const best: { completed: Best | null; any: Best | null } = {
    completed: null,
    any: null,
  }

  function consider(value: string, mode: 'completed' | 'any'): void {
    const ts = parseTaskSheetDateForSort(value)
    if (ts == null) return
    const trimmed = value.trim()
    if (mode === 'completed') {
      if (!best.completed || ts >= best.completed.ts) best.completed = { ts, raw: trimmed }
    }
    if (!best.any || ts >= best.any.ts) best.any = { ts, raw: trimmed }
  }

  for (const r of taskRows) {
    const id = String(r.animalId ?? '').trim()
    if (!id || !animalIds.has(id)) continue
    if (!String(r.taskType ?? '').startsWith(taskPrefix)) continue

    const completed = String(r.completedDate ?? '').trim()
    if (completed) {
      consider(completed, 'completed')
      consider(completed, 'any')
    }

    for (const dateRaw of [r.emailSentDate, r.scheduledDate, r.retiredDate]) {
      const t = String(dateRaw ?? '').trim()
      if (t) consider(t, 'any')
    }
  }

  if (best.completed) return best.completed.raw
  if (best.any) return best.any.raw
  return undefined
}

export function enrichFosterDirectoryWithLanes(
  dogs: DogRecord[],
  taskRows: TaskRow[],
  taskStatusByAnimalId: Record<string, FosterStatus>
): EnrichedFosterRow[] {
  const strictRollup = strictTaskPresenceForRollup(
    taskRows.length,
    taskStatusByAnimalId
  )
  const animalIdsWithAnyRow = strictRollup
    ? animalIdsFromTaskLogRows(taskRows)
    : undefined
  const base = buildFosterDirectory(
    dogs,
    taskStatusByAnimalId,
    animalIdsWithAnyRow
  )
  return base.map(item => {
    const enrichedDogs: EnrichedDog[] = item.dogs.map(d => {
      const photoLane = summarizeTaskLane(taskRows, d.id, 'PHOTOS')
      const surveyLane = summarizeTaskLane(taskRows, d.id, 'SURVEY')
      return { ...d, photoLane, surveyLane }
    })
    const photoWorst = worstLanes(...enrichedDogs.map(d => d.photoLane))
    const surveyWorst = worstLanes(...enrichedDogs.map(d => d.surveyLane))
    const photoLabels = enrichedDogs.map(d =>
      sheetStatusLabelForAnimalPrefix(taskRows, d.id, 'PHOTOS')
    )
    const surveyLabels = enrichedDogs.map(d =>
      sheetStatusLabelForAnimalPrefix(taskRows, d.id, 'SURVEY')
    )
    const photoHouseholdSheetLabel = worstSheetLabelAcrossHousehold(photoLabels)
    const surveyHouseholdSheetLabel = worstSheetLabelAcrossHousehold(surveyLabels)
    const animalIdSet = new Set(enrichedDogs.map(d => d.id))
    const lastPhotoTaskActivityDate = householdLastTaskActivityDate(taskRows, animalIdSet, 'PHOTOS')
    const lastSurveyTaskActivityDate = householdLastTaskActivityDate(taskRows, animalIdSet, 'SURVEY')
    return {
      ...item,
      dogs: enrichedDogs,
      householdRollup: item.status,
      photoWorst,
      surveyWorst,
      photoHouseholdSheetLabel,
      surveyHouseholdSheetLabel,
      lastPhotoTaskActivityDate,
      lastSurveyTaskActivityDate,
    }
  })
}

/**
 * Display string for the household column: same Good/Overdue/Unknown rollup as the sheet for **open**
 * rows, plus **No open tasks** when every photo/survey row is Completed or Retired (rollup is still Good).
 */
export function householdRollupDisplay(row: EnrichedFosterRow): string {
  if (row.householdRollup === 'Overdue') return 'Overdue'
  if (row.householdRollup === 'Unknown') return 'Unknown'
  if (row.photoWorst === 'none' && row.surveyWorst === 'none') return 'No open tasks'
  return 'Good'
}

/** True when something in the household needs admin follow-up vs Task Log gaps or overdue states. */
export function fosterNeedsAttention(row: EnrichedFosterRow): boolean {
  if (row.householdRollup === 'Overdue' || row.householdRollup === 'Unknown') return true
  const hot = new Set<TaskLane>(['overdue', 'unknown', 'not_in_log'])
  return hot.has(row.photoWorst) || hot.has(row.surveyWorst)
}

/** Work-queue presets for the fosters Task inbox. */
export type TaskInboxFilter =
  | 'all'
  | 'needs_attention'
  | 'rollup_overdue'
  | 'rollup_good'
  | 'rollup_unknown'
  | 'photo_overdue'
  | 'survey_overdue'
  | 'photo_on_track'
  | 'survey_on_track'
  | 'photo_missing_log'
  | 'survey_missing_log'

/** Matches overview priority queue: Unknown worst, then Overdue, then Good. */
function rollupRankForSort(status: FosterStatus): number {
  return status === 'Unknown' ? 3 : status === 'Overdue' ? 2 : 1
}

function maxDaysInFosterAcrossDogs(row: EnrichedFosterRow): number {
  let m = 0
  for (const d of row.dogs) {
    const n = d.daysInFoster
    if (typeof n === 'number' && n > m) m = n
  }
  return m
}

/**
 * Sort “Needs attention” rows by urgency (not A–Z): worst household status first,
 * then heavier Task Log lane issues, then longest time in foster.
 */
export function compareNeedsAttentionPriority(a: EnrichedFosterRow, b: EnrichedFosterRow): number {
  const rr =
    rollupRankForSort(b.householdRollup) - rollupRankForSort(a.householdRollup)
  if (rr !== 0) return rr

  const laneHeat = (row: EnrichedFosterRow) =>
    laneWeight(row.photoWorst) + laneWeight(row.surveyWorst)
  const lr = laneHeat(b) - laneHeat(a)
  if (lr !== 0) return lr

  const days = maxDaysInFosterAcrossDogs(b) - maxDaysInFosterAcrossDogs(a)
  if (days !== 0) return days

  return a.fosterName.localeCompare(b.fosterName)
}

export function matchesTaskInboxFilter(row: EnrichedFosterRow, f: TaskInboxFilter): boolean {
  switch (f) {
    case 'all':
      return true
    case 'needs_attention':
      return fosterNeedsAttention(row)
    case 'rollup_overdue':
      return row.householdRollup === 'Overdue'
    case 'rollup_good':
      return row.householdRollup === 'Good'
    case 'rollup_unknown':
      return row.householdRollup === 'Unknown'
    case 'photo_overdue':
      return row.photoWorst === 'overdue'
    case 'survey_overdue':
      return row.surveyWorst === 'overdue'
    case 'photo_on_track':
      return row.dogs.some(d => d.photoLane === 'good')
    case 'survey_on_track':
      return row.dogs.some(d => d.surveyLane === 'good')
    case 'photo_missing_log':
      return row.photoWorst === 'not_in_log'
    case 'survey_missing_log':
      return row.surveyWorst === 'not_in_log'
    default:
      return true
  }
}
