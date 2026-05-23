import type { FosterStatus } from '@/app/lib/fosterDirectory'
import type {
  TaskRow,
  TaskRowSheetStatus,
  TasksDataQuality,
  TasksGetMetrics,
} from '@/app/lib/taskTypes'
import {
  readFirestoreCache,
  writeFirestoreCache,
  isCacheFresh,
  triggerBackgroundSync,
} from '@/app/lib/firestoreCache'

export type { TaskRow, TaskRowSheetStatus, TasksDataQuality, TasksGetMetrics }

const TASK_SCRIPT_URL = process.env.TASK_SCRIPT_URL
const TASKS_FS_DOC_ID = 'tasks'
const rawTaskCacheTtl = Number(process.env.TASK_LOG_CACHE_TTL_SEC)
const TASK_CACHE_TTL_MS =
  Math.max(10, Math.min(300, Number.isFinite(rawTaskCacheTtl) && rawTaskCacheTtl > 0 ? rawTaskCacheTtl : 45)) * 1000

type TasksGetResponse = {
  success: true
  rows: TaskRow[]
  taskStatusByAnimalId: Record<string, FosterStatus>
  metrics: TasksGetMetrics
  dataQuality: TasksDataQuality
}

let taskCache: { data: TasksGetResponse; expiresAt: number } | null = null
let taskInFlight: Promise<TasksGetResponse> | null = null

function taskCacheHeaders() {
  return {
    'Cache-Control': `private, max-age=0, s-maxage=${Math.floor(TASK_CACHE_TTL_MS / 1000)}`,
  }
}

function invalidateTaskCache() {
  taskCache = null
}

/** Parse Sheet Status text only — do not infer from dates. */
export function normalizeSheetStatus(sheetStatus: string): TaskRowSheetStatus {
  const s = sheetStatus.trim()
  if (!s) return 'unknown'
  const lower = s.toLowerCase()
  if (lower === 'good') return 'good'
  if (lower === 'needs review' || lower === 'needs_review') return 'needs_review'
  if (lower === 'overdue') return 'overdue'
  if (lower === 'completed') return 'completed'
  if (lower === 'retired') return 'retired'
  return 'unknown'
}

const ROLLUP_WEIGHT: Record<FosterStatus, number> = {
  Good: 1,
  'Needs Review': 2,
  Overdue: 3,
  Unknown: 4,
}

/** Active rows that still affect follow-up health (Completed & Retired require no action). */
function rollupContribution(status: TaskRowSheetStatus): FosterStatus | null {
  if (status === 'completed' || status === 'retired') return null
  if (status === 'overdue') return 'Overdue'
  if (status === 'needs_review') return 'Needs Review'
  if (status === 'good') return 'Good'
  return 'Unknown'
}

export async function POST(request: Request) {
  if (!TASK_SCRIPT_URL) {
    return Response.json({ success: false, error: 'TASK_SCRIPT_URL not configured' }, { status: 500 })
  }
  const body = await request.json().catch(() => null) as
    | {
      action?: 'updateScheduledEmail' | 'snooze'
      animalId?: string
      taskType?: string
      scheduledEmail?: string
      scheduledDate?: string
      days?: number
    }
    | null
  if (!body?.animalId || !body?.taskType) {
    return Response.json({ success: false, error: 'animalId and taskType required' }, { status: 400 })
  }
  const action = body.action ?? 'updateScheduledEmail'
  const payload =
    action === 'snooze'
      ? {
        action: 'snoozeTask',
        animalId: body.animalId,
        taskType: body.taskType,
        days: body.days ?? 3,
        scheduledDate: body.scheduledDate ?? '',
      }
      : { action: 'updateScheduledEmail', animalId: body.animalId, taskType: body.taskType, scheduledEmail: body.scheduledEmail ?? '' }
  try {
    const res = await fetch(TASK_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    try {
      const parsed = JSON.parse(text)
      invalidateTaskCache()
      triggerBackgroundSync(TASKS_FS_DOC_ID, async () => {
        const fresh = await loadTaskLog()
        await writeFirestoreCache(TASKS_FS_DOC_ID, fresh)
      })
      return Response.json(parsed)
    } catch {
      return Response.json({ success: false, error: text }, { status: 502 })
    }
  } catch (error) {
    console.error('Tasks update error:', error)
    return Response.json({ success: false, error: 'Failed to update scheduled email' }, { status: 500 })
  }
}

const EMPTY_METRICS: TasksGetMetrics = {
  activeOverdueTaskRows: 0,
  unknownStatusRowCount: 0,
}

const EMPTY_QUALITY: TasksDataQuality = {
  unknownStatusRowCount: 0,
  hasUnknownTaskStatuses: false,
}

const EMPTY_TASKS_RESPONSE: TasksGetResponse = {
  success: true,
  rows: [],
  taskStatusByAnimalId: {},
  metrics: EMPTY_METRICS,
  dataQuality: EMPTY_QUALITY,
}

async function loadTaskLog(): Promise<TasksGetResponse> {
  if (!TASK_SCRIPT_URL) {
    return EMPTY_TASKS_RESPONSE
  }

  const url = new URL(TASK_SCRIPT_URL)
  url.searchParams.set('action', 'taskLog')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = (await res.json()) as {
    success?: boolean
    rows?: Record<string, unknown>[]
    error?: string
  }

  if (!data.success || !Array.isArray(data.rows)) {
    throw new Error(data.error || 'Failed to fetch task log')
  }

  let activeOverdueTaskRows = 0
  let unknownStatusRowCount = 0

  const rows: TaskRow[] = data.rows.map(r => {
    const rawStatus = String(r.status ?? '')
    const normalized = normalizeSheetStatus(rawStatus)
    if (normalized === 'overdue') activeOverdueTaskRows += 1
    if (normalized === 'unknown') unknownStatusRowCount += 1

    const completedDate = String(r.completedDate ?? r.taskCompletedDate ?? '').trim()
    const retiredDate = String(r.retiredDate ?? r.taskRetiredDate ?? '').trim()

    return {
      animalId: String(r.animalId ?? '').trim(),
      dogName: String(r.dogName ?? '').trim(),
      taskType: String(r.taskType ?? '').trim(),
      triggerDay: Number(r.triggerDay) || 0,
      emailSentDate: String(
        r.emailSentDate ?? r.emailSentToSendDate ?? r.emailSent ?? ''
      ).trim(),
      followUpSent: String(r.followUpSent ?? r.followUpSentDate ?? '').trim(),
      completedDate,
      retiredDate,
      fosterName: String(r.fosterName ?? '').trim(),
      fosterEmail: String(r.fosterEmail ?? '').trim(),
      status: normalized,
      statusRaw: normalized === 'unknown' ? rawStatus.trim() : undefined,
      driveLink: String(r.driveLink ?? r.driveFolder ?? r.folderUrl ?? r.photoFolder ?? '').trim(),
      scheduledEmail: String(r.scheduledEmail ?? ''),
      scheduledDate: String(r.scheduledDate ?? '').trim(),
      snoozeUntil: String(r.snoozeUntil ?? '').trim(),
    }
  })

  const taskStatusByAnimalId: Record<string, FosterStatus> = {}
  for (const row of rows) {
    if (!row.animalId) continue
    const contrib = rollupContribution(row.status)
    if (contrib === null) continue
    const existing = taskStatusByAnimalId[row.animalId]
    if (!existing || ROLLUP_WEIGHT[contrib] > ROLLUP_WEIGHT[existing]) {
      taskStatusByAnimalId[row.animalId] = contrib
    }
  }

  const dataQuality: TasksDataQuality = {
    unknownStatusRowCount,
    hasUnknownTaskStatuses: unknownStatusRowCount > 0,
  }

  const metrics: TasksGetMetrics = {
    activeOverdueTaskRows,
    unknownStatusRowCount,
  }

  return {
    success: true,
    rows,
    taskStatusByAnimalId,
    metrics,
    dataQuality,
  }
}

/** Uncached fetch for use in sync routes. */
export async function loadTaskLogUncached(): Promise<TasksGetResponse> {
  return loadTaskLog()
}

export async function GET() {
  const now = Date.now()

  // Module-level cache (hot path — same server instance)
  if (taskCache && taskCache.expiresAt > now) {
    return Response.json(taskCache.data, { headers: taskCacheHeaders() })
  }

  // Firestore cache (cold start / cross-instance)
  const fsCached = await readFirestoreCache<TasksGetResponse>(TASKS_FS_DOC_ID)
  if (fsCached) {
    if (!isCacheFresh(fsCached.updatedAt)) {
      triggerBackgroundSync(TASKS_FS_DOC_ID, async () => {
        const data = await loadTaskLog()
        await writeFirestoreCache(TASKS_FS_DOC_ID, data)
      })
    }
    taskCache = { data: fsCached.data, expiresAt: now + TASK_CACHE_TTL_MS }
    return Response.json(fsCached.data, { headers: taskCacheHeaders() })
  }

  // Cold start — no Firestore doc yet; fetch directly and prime the cache
  try {
    if (!taskInFlight) {
      taskInFlight = loadTaskLog()
        .then(data => {
          taskCache = { data, expiresAt: Date.now() + TASK_CACHE_TTL_MS }
          writeFirestoreCache(TASKS_FS_DOC_ID, data)
            .catch(e => console.error('[tasks] Firestore prime failed:', e))
          return data
        })
        .finally(() => {
          taskInFlight = null
        })
    }

    const data = await taskInFlight
    return Response.json(data, { headers: taskCacheHeaders() })
  } catch (error) {
    console.error('Tasks API error:', error)
    return Response.json({ success: false, error: 'Failed to load tasks' }, { status: 500 })
  }
}
