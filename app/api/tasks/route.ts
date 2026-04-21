import type { FosterStatus } from '@/app/lib/fosterDirectory'

const TASK_SCRIPT_URL = process.env.TASK_SCRIPT_URL

export type TaskStatus = 'pending' | 'needs_review' | 'overdue' | 'completed' | 'retired'

export type TaskRow = {
  animalId: string
  dogName: string
  taskType: string
  triggerDay: number
  emailSentDate: string
  followUpSent: string
  completedDate: string
  retiredDate: string
  fosterName: string
  fosterEmail: string
  status: TaskStatus
}

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
