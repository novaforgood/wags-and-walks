import type { FosterStatus } from '@/app/lib/fosterDirectory'
import type { TaskRow, TaskStatus } from '@/app/lib/taskTypes'

export type { TaskRow, TaskStatus }

const TASK_SCRIPT_URL = process.env.TASK_SCRIPT_URL

// Status is pre-computed by the Apps Script and stored in the sheet's Status column.
// Fall back to date fields only for rows where the sheet status is blank.
function deriveStatus(sheetStatus: string, completedDate: string, retiredDate: string): TaskStatus {
  if (retiredDate) return 'retired'
  if (completedDate) return 'completed'
  const s = sheetStatus.trim()
  if (s === 'Overdue') return 'overdue'
  if (s === 'Needs Review') return 'needs_review'
  return 'pending'
}

const STATUS_RANK: Record<FosterStatus, number> = { Good: 1, 'Needs Review': 2, Overdue: 3 }

function toFosterStatus(s: TaskStatus): FosterStatus {
  if (s === 'overdue') return 'Overdue'
  if (s === 'needs_review') return 'Needs Review'
  return 'Good'
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
      return Response.json(JSON.parse(text))
    } catch {
      return Response.json({ success: false, error: text }, { status: 502 })
    }
  } catch (error) {
    console.error('Tasks update error:', error)
    return Response.json({ success: false, error: 'Failed to update scheduled email' }, { status: 500 })
  }
}

export async function GET() {
  if (!TASK_SCRIPT_URL) {
    return Response.json({ success: true, rows: [], taskStatusByAnimalId: {} })
  }

  try {
    const url = new URL(TASK_SCRIPT_URL)
    url.searchParams.set('action', 'taskLog')


    const res = await fetch(url.toString(), { cache: 'no-store' })
    const data = (await res.json()) as {
      success?: boolean
      rows?: Record<string, unknown>[]
      error?: string
    }

    if (!data.success || !Array.isArray(data.rows)) {
      return Response.json(
        { success: false, error: data.error || 'Failed to fetch task log' },
        { status: 502 }
      )
    }

    const rows: TaskRow[] = data.rows.map(r => {
      const completedDate = String(r.completedDate ?? '').trim()
      const retiredDate = String(r.retiredDate ?? '').trim()
      const sheetStatus = String(r.status ?? '').trim()
      return {
        animalId: String(r.animalId ?? '').trim(),
        dogName: String(r.dogName ?? '').trim(),
        taskType: String(r.taskType ?? '').trim(),
        triggerDay: Number(r.triggerDay) || 0,
        emailSentDate: String(r.emailSentDate ?? '').trim(),
        followUpSent: String(r.followUpSent ?? '').trim(),
        completedDate,
        retiredDate,
        fosterName: String(r.fosterName ?? '').trim(),
        fosterEmail: String(r.fosterEmail ?? '').trim(),
        status: deriveStatus(sheetStatus, completedDate, retiredDate),
        driveLink: String(r.driveLink ?? r.driveFolder ?? r.folderUrl ?? r.photoFolder ?? '').trim(),
        scheduledEmail: String(r.scheduledEmail ?? ''),
        scheduledDate: String(r.scheduledDate ?? '').trim(),
        snoozeUntil: String(r.snoozeUntil ?? '').trim(),
      }
    })

    // Worst active status per animal ID — used by fosters directory + overview
    const taskStatusByAnimalId: Record<string, FosterStatus> = {}
    for (const row of rows) {
      if (!row.animalId || row.status === 'retired' || row.status === 'completed') continue
      const fs = toFosterStatus(row.status)
      const existing = taskStatusByAnimalId[row.animalId]
      if (!existing || STATUS_RANK[fs] > STATUS_RANK[existing]) {
        taskStatusByAnimalId[row.animalId] = fs
      }
    }

    return Response.json({ success: true, rows, taskStatusByAnimalId })
  } catch (error) {
    console.error('Tasks API error:', error)
    return Response.json({ success: false, error: 'Failed to load tasks' }, { status: 500 })
  }
}
