/** Task log row shape returned by GET /api/tasks (Apps Script task log). */

/** Normalized Sheet Status column — only these four labels are recognized (case-insensitive). */
export type TaskRowSheetStatus = 'good' | 'overdue' | 'completed' | 'retired' | 'unknown'

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
  status: TaskRowSheetStatus
  /** When status is `unknown`, the raw cell value from the sheet (may be empty). */
  statusRaw?: string
  driveLink: string
  scheduledEmail: string
  scheduledDate: string
  snoozeUntil: string
}

export type TasksGetMetrics = {
  /** Active task rows whose normalized status is Overdue (follow-up overdue). */
  activeOverdueTaskRows: number
  /** Rows whose sheet Status was missing or not one of Good / Overdue / Completed / Retired. */
  unknownStatusRowCount: number
}

export type TasksDataQuality = {
  unknownStatusRowCount: number
  hasUnknownTaskStatuses: boolean
}
