import type { TaskRow } from '@/app/api/tasks/route'
import {
  buildFosterDirectory,
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

export function laneLabel(lane: TaskLane): string {
  switch (lane) {
    case 'overdue':
      return 'Follow-up overdue'
    case 'unknown':
      return 'Bad status cell'
    case 'good':
      return 'On track'
    case 'not_in_log':
      return 'Not in Task Log'
    case 'none':
      return 'Done / cleared'
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
  householdRollup: FosterStatus
}

export function enrichFosterDirectoryWithLanes(
  dogs: DogRecord[],
  taskRows: TaskRow[],
  taskStatusByAnimalId: Record<string, FosterStatus>
): EnrichedFosterRow[] {
  const base = buildFosterDirectory(dogs, taskStatusByAnimalId)
  return base.map(item => {
    const enrichedDogs: EnrichedDog[] = item.dogs.map(d => {
      const photoLane = summarizeTaskLane(taskRows, d.id, 'PHOTOS')
      const surveyLane = summarizeTaskLane(taskRows, d.id, 'SURVEY')
      return { ...d, photoLane, surveyLane }
    })
    const photoWorst = worstLanes(...enrichedDogs.map(d => d.photoLane))
    const surveyWorst = worstLanes(...enrichedDogs.map(d => d.surveyLane))
    return {
      ...item,
      dogs: enrichedDogs,
      householdRollup: item.status,
      photoWorst,
      surveyWorst,
    }
  })
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
