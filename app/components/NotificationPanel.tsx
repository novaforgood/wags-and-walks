'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './NotificationPanel.module.css'

type Notification = {
    id: string
    personName: string
    action: string
    entityName?: string
    timestamp: Date
    actionLabel: string
    isRead: boolean
}

const now = new Date()

function hoursAgo(hours: number): Date {
    return new Date(now.getTime() - hours * 60 * 60 * 1000)
}

const INITIAL_NOTIFICATIONS: Notification[] = [
    {
        id: '1',
        personName: 'Anusha L.',
        action: 'uploaded 10 photos of',
        entityName: 'Spot',
        timestamp: hoursAgo(2),
        actionLabel: 'View photos',
        isRead: false,
    },
    {
        id: '2',
        personName: 'Olivia Q.',
        action: 'missed their photo uploads of',
        entityName: 'Fido',
        timestamp: hoursAgo(5),
        actionLabel: 'Send an email',
        isRead: false,
    },
    {
        id: '3',
        personName: 'Olivia Q.',
        action: 'submitted their onboarding form',
        timestamp: new Date(2026, 1, 15),
        actionLabel: 'View form',
        isRead: true,
    },
    {
        id: '4',
        personName: 'Marcus T.',
        action: 'completed their home check for',
        entityName: 'Bella',
        timestamp: hoursAgo(18),
        actionLabel: 'View details',
        isRead: false,
    },
    {
        id: '5',
        personName: 'Sarah K.',
        action: 'requested a foster extension for',
        entityName: 'Luna',
        timestamp: hoursAgo(36),
        actionLabel: 'Review request',
        isRead: true,
    },
    {
        id: '6',
        personName: 'James R.',
        action: 'signed their foster agreement',
        timestamp: hoursAgo(48),
        actionLabel: 'View agreement',
        isRead: false,
    },
]

function formatTimestamp(date: Date): string {
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours} hrs ago`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type Tab = 'all' | 'unread' | 'read'

export default function NotificationPanel() {
    const [isOpen, setIsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<Tab>('all')
    const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS)
    const panelRef = useRef<HTMLDivElement>(null)

    // Click-outside to close
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
        setNotifications(prev =>
            prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
        )
    }

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
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
                    {/* Header */}
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

                    {/* Tabs */}
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

                    {/* Notification List */}
                    <div className={styles.list}>
                        {filtered.length === 0 ? (
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
