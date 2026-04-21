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
  isRead: boolean
}

type Tab = 'all' | 'unread' | 'read'

const READ_KEY = 'ww-notif-read-ids'

function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(READ_KEY)
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

function taskLabel(taskType: string): string {
  if (taskType.startsWith('PHOTOS')) return 'photo upload'
  if (taskType.startsWith('SURVEY')) return 'foster survey'
  return taskType.toLowerCase().replace(/_\d+$/, '').replace('_', ' ')
}

function rowToNotification(row: TaskRow, readIds: Set<string>): Notification | null {
  if (row.status !== 'needs_review' && row.status !== 'overdue' && row.status !== 'completed') return null
  const label = taskLabel(row.taskType)
  const name = row.fosterName || `Animal ${row.animalId}`

  if (row.status === 'completed') {
    const id = `${row.animalId}-${row.taskType}-completed-${row.completedDate}`
    return {
      id,
      personName: name,
      action: `completed ${label} for`,
      entityName: row.dogName || undefined,
      timestamp: new Date(row.completedDate),
      actionLabel: 'Mark as read',
      isRead: readIds.has(id),
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
    isRead: readIds.has(id),
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
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/tasks', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: { success?: boolean; rows?: TaskRow[] }) => {
        if (!data.success || !Array.isArray(data.rows)) return
        const readIds = getReadIds()
        const notifs = data.rows
          .map(row => rowToNotification(row, readIds))
          .filter((n): n is Notification => n !== null)
          // overdue first, then needs-review, then completed; within each group newest first
          .sort((a, b) => {
            const rank = (n: Notification) =>
              n.action.includes('overdue') ? 2 : n.action.startsWith('completed') ? 0 : 1
            if (rank(b) !== rank(a)) return rank(b) - rank(a)
            return b.timestamp.getTime() - a.timestamp.getTime()
          })
        setNotifications(notifs)
      })
      .catch(err => console.error('Failed to load notifications', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    const readIds = getReadIds()
    readIds.add(id)
    saveReadIds(readIds)
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    const readIds = getReadIds()
    notifications.forEach(n => readIds.add(n.id))
    saveReadIds(readIds)
  }

  const filtered = notifications.filter(n => {
    if (activeTab === 'unread') return !n.isRead
    if (activeTab === 'read') return n.isRead
    return true
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className={styles.bellWrapper} ref={panelRef}>
      <button
        className={styles.bellButton}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Notifications"
      >
        <img src="/assets/Notif.svg" alt="Notifications" width={24} height={24} />
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <div className={styles.closeRow}>
              <button
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
              >
                ✕
              </button>
            </div>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>Notifications</h2>
              <button className={styles.markAllRead} onClick={markAllAsRead}>
                Mark all as read
              </button>
            </div>
          </div>

          <div className={styles.tabs}>
            {(['all', 'unread', 'read'] as Tab[]).map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'all' ? 'All' : tab === 'unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'Read'}
              </button>
            ))}
          </div>

          <div className={styles.list}>
            {loading ? (
              <div className={styles.empty}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>No notifications</div>
            ) : (
              filtered.map(n => (
                <div
                  key={n.id}
                  className={`${styles.card} ${!n.isRead ? styles.cardUnread : ''}`}
                >
                  <p className={styles.cardText}>
                    <strong>{n.personName}</strong> {n.action}
                    {n.entityName && <> <strong>{n.entityName}</strong></>}
                  </p>
                  <div className={styles.cardTimestamp}>
                    {formatTimestamp(n.timestamp)}
                  </div>
                  <button
                    className={styles.cardAction}
                    onClick={() => markAsRead(n.id)}
                  >
                    {n.actionLabel}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
