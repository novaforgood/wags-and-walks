/** Task log row shape returned by GET /api/tasks (Apps Script task log). */

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
  driveLink: string
  scheduledEmail: string
  scheduledDate: string
  snoozeUntil: string
}
