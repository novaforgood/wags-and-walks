export type PersonStatus = 'new' | 'in-progress' | 'approved' | 'current'

export type Person = {
  rowIndex?: number
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  age?: string
  status?: PersonStatus
  appliedAt?: string
  availability?: string
  specialNeeds?: string[]
  raw?: Record<string, string>
}

export const PENDING_STATUS_UPDATES_STORAGE_KEY = 'pending_status_updates_v1'

export function normalizeEmailKey(email?: string): string {
  return String(email || '').trim().toLowerCase()
}
