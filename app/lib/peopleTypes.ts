export type PersonStatus =
  | 'new'
  | 'in-progress'
  | 'approved'
  | 'current'
  | 'rejected'
  | 'rejected_new'
  | 'rejected_in-progress'
  | 'rejected_approved'

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

export const KNOWN_SPECIAL_NEEDS = [
  'Puppies',
  'Pregnant Dogs',
  'Sick Dogs',
  'Injured / Recovering Dogs',
  'Litters of Puppies Still Feeding From Mom',
  'Dogs that Need Training / Rehabilitation for Behavioral',
  'None of the Above'
]

export const NONE_OF_THE_ABOVE = 'None of the Above'
export const SELECTABLE_SPECIAL_NEEDS = KNOWN_SPECIAL_NEEDS.filter(n => n !== NONE_OF_THE_ABOVE)
