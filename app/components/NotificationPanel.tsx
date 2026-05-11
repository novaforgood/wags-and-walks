'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './NotificationPanel.module.css'
import type { TaskRow } from '@/app/api/tasks/route'

type Notification = {
  id: string
  personName: string
  action: string
  entityName?: string
  timestamp: Date
  actionLabel: string
  actionHref?: string
}

function taskLabel(taskType: string): string {
  if (taskType.startsWith('PHOTOS')) return 'photo upload'
  if (taskType.startsWith('SURVEY')) return 'foster survey'
  return taskType.toLowerCase().replace(/_\d+$/, '').replace('_', ' ')
}

function rowToNotification(row: TaskRow): Notification | null {
  if (row.status !== 'needs_review' && row.status !== 'overdue' && row.status !== 'completed') return null
  const label = taskLabel(row.taskType)
  const name = row.fosterName || `Animal ${row.animalId}`

  if (row.status === 'completed') {
    const id = `${row.animalId}-${row.taskType}-completed-${row.completedDate}`
    const isPhotoTask = row.taskType.startsWith('PHOTOS')
    const hasDriveLink = isPhotoTask && !!row.driveLink
    return {
      id,
      personName: name,
      action: `completed ${label} for`,
      entityName: row.dogName || undefined,
      timestamp: new Date(row.completedDate),
      actionLabel: hasDriveLink ? 'See Photos' : 'Mark as read',
      actionHref: hasDriveLink ? row.driveLink : undefined,
    }
  }

  const id = `${row.animalId}-${row.taskType}-${row.emailSentDate}`
  return {
    id,
    personName: name,
    action: row.status === 'overdue'
      ? `has an overdue ${label} for`
      : `needs a follow-up ${label} for`,
    entityName: row.dogName || undefined,
    timestamp: new Date(row.followUpSent || row.emailSentDate),
    actionLabel: 'Send follow-up',
  }
}

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours} hrs ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/tasks', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: { success?: boolean; rows?: TaskRow[] }) => {
        if (!data.success || !Array.isArray(data.rows)) return
        const notifs = data.rows
          .map(row => rowToNotification(row))
          .filter((n): n is Notification => n !== null)
          .sort((a, b) => {
            const ta = a.timestamp.getTime()
            const tb = b.timestamp.getTime()
            if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
            if (Number.isNaN(ta)) return 1
            if (Number.isNaN(tb)) return -1
            return tb - ta
          })
        setNotifications(notifs)
      })
      .catch(err => console.error('Failed to load notifications', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.bellWrapper} ref={panelRef}>
      <button
        type="button"
        className={`${styles.bellButton} ${isOpen ? styles.bellButtonActive : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? 'Close notifications' : 'Open notifications'}
        aria-expanded={isOpen}
        aria-pressed={isOpen}
      >
        <img src="/assets/Notif.svg" alt="" width={24} height={24} />
      </button>

      {isOpen && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Notifications</h2>
          </div>

          <div className={styles.list}>
            {loading ? (
              <div className={styles.empty}>Loading…</div>
            ) : notifications.length === 0 ? (
              <div className={styles.empty}>No notifications</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={styles.card}>
                  <div className={styles.cardBody}>
                    <p className={styles.cardText}>
                      <strong>{n.personName}</strong> {n.action}
                      {n.entityName && <> <strong>{n.entityName}</strong></>}
                    </p>
                    <div className={styles.cardTimestamp}>
                      {formatTimestamp(n.timestamp)}
                    </div>
                    {n.actionHref ? (
                      <a
                        className={styles.cardAction}
                        href={n.actionHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {n.actionLabel}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
