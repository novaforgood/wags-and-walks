'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import type { Person, PersonStatus } from '@/app/lib/peopleTypes'
import layoutStyles from '../candidates/candidates.module.css'
import styles from './overview.module.css'

function hasEmail(p: Person): boolean {
    return !!p.email?.trim()
}

function isRejectedStatus(s?: PersonStatus): boolean {
    if (!s) return false
    if (s === 'rejected') return true
    return s.startsWith('rejected_')
}

function hasRedFlag(person: Person): boolean {
    const flags = String(person.raw?.['Flags'] || '').trim().toLowerCase()
    return !!(flags && flags !== 'ok' && flags !== 'none')
}

type QueueFilter = 'all' | 'flagged'

const APPLICANT_QUEUE_MAX = 6

const AVATAR_BG = [
    'var(--app-avatar-0)',
    'var(--app-avatar-1)',
    'var(--app-avatar-2)',
    'var(--app-avatar-3)',
    'var(--app-avatar-4)',
    'var(--app-avatar-5)',
] as const

function initialsOf(p: Person): string {
    const f = p.firstName?.trim().charAt(0) || ''
    const l = p.lastName?.trim().charAt(0) || ''
    if (f || l) return (f + l).toUpperCase()
    const e = p.email?.trim() || '?'
    return e.slice(0, 2).toUpperCase()
}

function displayName(p: Person): string {
    const n = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
    return n || p.email || 'Unknown'
}

function formatRelativeTime(iso?: string): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const now = Date.now()
    const diffMs = now - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const startOf = (t: number) => {
        const x = new Date(t)
        x.setHours(0, 0, 0, 0)
        return x.getTime()
    }
    const dayDiff = Math.round((startOf(now) - startOf(d.getTime())) / 86400000)
    if (dayDiff === 1) return 'Yesterday'
    if (dayDiff < 7) return `${dayDiff}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function avatarBg(email?: string): string {
    const s = email || 'x'
    let h = 0
    for (let i = 0; i < s.length; i++) h += s.charCodeAt(i)
    return AVATAR_BG[h % AVATAR_BG.length]
}

function buildConicGradient(segments: { count: number; color: string }[]): string | null {
    const total = segments.reduce((a, s) => a + Math.max(0, s.count), 0)
    if (total <= 0) return null
    let deg = 0
    const parts: string[] = []
    for (const s of segments) {
        if (s.count <= 0) continue
        const span = (s.count / total) * 360
        const end = deg + span
        parts.push(`${s.color} ${deg}deg ${end}deg`)
        deg = end
    }
    if (parts.length === 0) return null
    return `conic-gradient(${parts.join(', ')})`
}

export default function OverviewPage() {
    const { people, isLoading, error } = usePeople()
    const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')

    // ── ADDED: ASM foster count from /api/fosters ──────────────────────────
    const [asmFosterCount, setAsmFosterCount] = useState<number | null>(null)

    useEffect(() => {
        let active = true
        async function loadFosterCount() {
            try {
                const res = await fetch('/api/fosters', { method: 'GET', cache: 'no-store' })
                const data = await res.json()
                if (!active) return
                if (typeof data?.count === 'number') {
                    setAsmFosterCount(data.count)
                }
            } catch {
                // silently fail — stat card falls back to spreadsheet count
            }
        }
        loadFosterCount()
        return () => { active = false }
    }, [])
    // ───────────────────────────────────────────────────────────────────────

    const stats = useMemo(() => {
        const rows = people.filter(hasEmail)

        let newCount = 0
        let inProgressCount = 0
        let approvedCount = 0
        let currentCount = 0
        let rejectedCount = 0

        for (const p of rows) {
            const s = p.status || 'new'
            if (isRejectedStatus(s)) {
                rejectedCount += 1
                continue
            }
            switch (s) {
                case 'new':
                    newCount += 1
                    break
                case 'in-progress':
                    inProgressCount += 1
                    break
                case 'approved':
                    approvedCount += 1
                    break
                case 'current':
                    currentCount += 1
                    break
                default:
                    break
            }
        }

        const pipelineCount = newCount + inProgressCount
        const flaggedInPipeline = rows.filter(p => {
            const s = p.status || 'new'
            if (s !== 'new' && s !== 'in-progress') return false
            return hasRedFlag(p)
        }).length

        const monthBuckets = new Map<string, number>()
        for (const p of rows) {
            if (!p.appliedAt) continue
            const d = new Date(p.appliedAt)
            if (Number.isNaN(d.getTime())) continue
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            monthBuckets.set(key, (monthBuckets.get(key) || 0) + 1)
        }
        const sortedMonths = [...monthBuckets.keys()].sort()
        const last12 = sortedMonths.slice(-12)
        const monthly = last12.map(key => ({
            key,
            label: formatMonthLabel(key),
            count: monthBuckets.get(key) || 0,
        }))
        const monthMax = Math.max(1, ...monthly.map(m => m.count))

        const statusMax = Math.max(1, newCount, inProgressCount, approvedCount, currentCount, rejectedCount)

        // ── CHANGED: use asmFosterCount for the donut if available ──────────
        const activeFosterCount = asmFosterCount ?? currentCount
        const rosterTotal = activeFosterCount + pipelineCount + approvedCount + rejectedCount
        const donutSegments = [
            { key: 'current', label: 'Active fosters', count: activeFosterCount, color: '#05aaaf' },
            { key: 'pipeline', label: 'Pipeline', count: pipelineCount, color: '#7ecbcd' },
            { key: 'approved', label: 'Approved', count: approvedCount, color: '#3a9da0' },
            { key: 'rejected', label: 'Rejected', count: rejectedCount, color: '#9e9e9e' },
        ]
        // ────────────────────────────────────────────────────────────────────

        const donutGradient = buildConicGradient(
            donutSegments.map(s => ({ count: s.count, color: s.color }))
        )

        return {
            newCount,
            inProgressCount,
            pipelineCount,
            approvedCount,
            currentCount,
            activeFosterCount,
            rejectedCount,
            flaggedInPipeline,
            monthly,
            monthMax,
            statusMax,
            rosterTotal,
            donutSegments,
            donutGradient,
        }
    }, [people, asmFosterCount]) // ← CHANGED: added asmFosterCount dependency

    const applicantQueue = useMemo(() => {
        const rows = people.filter(hasEmail).filter(p => {
            const s = p.status || 'new'
            if (isRejectedStatus(s)) return false
            return s === 'new' || s === 'in-progress'
        })
        const filtered = rows.filter(p =>
            queueFilter === 'all' ? true : hasRedFlag(p)
        )
        const ts = (p: Person) => {
            const t = p.appliedAt ? new Date(p.appliedAt).getTime() : NaN
            return Number.isNaN(t) ? 0 : t
        }
        return [...filtered].sort((a, b) => ts(b) - ts(a)).slice(0, APPLICANT_QUEUE_MAX)
    }, [people, queueFilter])

    const showQueueSeeAll =
        applicantQueue.length > 0 &&
        ((queueFilter === 'all' && stats.pipelineCount > APPLICANT_QUEUE_MAX) ||
            (queueFilter === 'flagged' && stats.flaggedInPipeline > APPLICANT_QUEUE_MAX))

    return (
        <ProtectedRoute>
            <DashboardShell>
                    <div className={layoutStyles.topBar}>
                        <h1 className={layoutStyles.topBarTitle}>Overview</h1>
                        <div className={layoutStyles.topBarActions}>
                            <NotificationPanel />
                            <TopBarProfileMenu />
                        </div>
                    </div>

                    {isLoading && people.length === 0 && (
                        <div className={styles.loadingBox}>Loading…</div>
                    )}
                    {error && <div className={styles.errorText}>{error}</div>}

                    {!isLoading && (
                        <div className={styles.contentPadding}>

                            <div className={styles.statsGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Pipeline</span>
                                    <span className={styles.statValue}>{stats.pipelineCount}</span>
                                    <span className={styles.statHint}>New and in progress</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Active fosters</span>
                                    <span className={styles.statValue}>{stats.activeFosterCount}</span>
                                    <span className={styles.statHint}>Shelter Manager</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Approved</span>
                                    <span className={styles.statValue}>{stats.approvedCount}</span>
                                    <span className={styles.statHint}>Directory-ready</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Flagged</span>
                                    <span className={styles.statValue}>{stats.flaggedInPipeline}</span>
                                    <span className={styles.statHint}>In pipeline</span>
                                </div>
                            </div>

                            <div className={styles.applicantSectionWrap}>
                                <section className={styles.applicantCard} aria-labelledby="applicant-queue-title">
                                    <div className={styles.cardHead}>
                                        <div className={styles.cardHeadText}>
                                            <h2 id="applicant-queue-title" className={styles.cardTitle}>
                                                Applicant queue
                                            </h2>
                                        </div>
                                        <div className={styles.filterBar} role="tablist" aria-label="Applicant filters">
                                            {(
                                                [
                                                    ['all', 'All'],
                                                    ['flagged', 'Flagged'],
                                                ] as const satisfies readonly (readonly [QueueFilter, string])[]
                                            ).map(([key, label]) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={queueFilter === key}
                                                    className={`${styles.filterBtn} ${queueFilter === key ? styles.filterBtnActive : ''}`}
                                                    onClick={() => setQueueFilter(key)}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {applicantQueue.length === 0 ? (
                                        <p className={styles.emptyQueue}>
                                            {stats.pipelineCount === 0
                                                ? 'No applications in the pipeline yet.'
                                                : 'No applicants match this filter.'}
                                        </p>
                                    ) : (
                                        <ul className={styles.queueList}>
                                            {applicantQueue.map(p => {
                                                const email = p.email!.trim()
                                                const href = `/applicants/${encodeURIComponent(email)}?from=overview`
                                                const badge = hasRedFlag(p)
                                                    ? { label: 'Red flag', cls: styles.badgeFlag }
                                                    : (p.status || 'new') === 'new'
                                                      ? { label: 'New', cls: styles.badgeNew }
                                                      : { label: 'In progress', cls: styles.badgeReview }
                                                return (
                                                    <li key={email}>
                                                        <Link href={href} className={styles.queueRow}>
                                                            <span
                                                                className={styles.queueAvatar}
                                                                style={{ background: avatarBg(email) }}
                                                                aria-hidden
                                                            >
                                                                {initialsOf(p)}
                                                            </span>
                                                            <span className={styles.queueMain}>
                                                                <span className={styles.queueName}>{displayName(p)}</span>
                                                            </span>
                                                            <span className={styles.queueRowTail}>
                                                                <span className={`${styles.queueBadge} ${badge.cls}`}>
                                                                    {badge.label}
                                                                </span>
                                                                <span className={styles.queueTime}>
                                                                    {formatRelativeTime(p.appliedAt)}
                                                                </span>
                                                                <span className={styles.queueChevron} aria-hidden>
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                                        <path
                                                                            d="M9 6l6 6-6 6"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        />
                                                                    </svg>
                                                                </span>
                                                            </span>
                                                        </Link>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )}
                                    {showQueueSeeAll && (
                                        <div className={styles.queueFooter}>
                                            <Link href="/candidates" className={styles.queueFooterLink}>
                                                View all in Candidates
                                            </Link>
                                        </div>
                                    )}
                                </section>
                            </div>

                            <div className={styles.chartsRow}>
                                <div className={styles.panel}>
                                    <h2 className={styles.panelTitle}>Pipeline</h2>
                                    {stats.rosterTotal === 0 ? (
                                        <div className={styles.emptyChart}>No applicants yet.</div>
                                    ) : (
                                        <div className={styles.donutRow}>
                                            <div className={styles.donutOuter}>
                                                <div
                                                    className={styles.donutRing}
                                                    style={{
                                                        background:
                                                            stats.donutGradient ??
                                                            'conic-gradient(#e0e0e0 0deg 360deg)',
                                                    }}
                                                />
                                                <div className={styles.donutHole} />
                                                <div className={styles.donutCenterLabel}>
                                                    <span className={styles.donutCenterValue}>
                                                        {stats.rosterTotal}
                                                    </span>
                                                    <span className={styles.donutCenterHint}>total</span>
                                                </div>
                                            </div>
                                            <div className={styles.donutLegend}>
                                                {stats.donutSegments.map(seg => (
                                                    <div key={seg.key} className={styles.legendItem}>
                                                        <span
                                                            className={styles.legendSwatch}
                                                            style={{ background: seg.color }}
                                                        />
                                                        <span className={styles.legendLabel}>{seg.label}</span>
                                                        <span className={styles.legendValue}>{seg.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.panel}>
                                    <h2 className={styles.panelTitle}>Applications</h2>
                                    {stats.monthly.length === 0 ? (
                                        <div className={styles.emptyChart}>No submission dates on file.</div>
                                    ) : (
                                        <div className={styles.monthBars}>
                                            {stats.monthly.map(m => (
                                                <div key={m.key} className={styles.monthCol}>
                                                    <div className={styles.monthTrack}>
                                                        <div
                                                            className={styles.monthFill}
                                                            style={{
                                                                height: `${(m.count / stats.monthMax) * 100}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className={styles.monthCount}>{m.count}</span>
                                                    <span className={styles.monthLabel}>{m.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.panel}>
                                <h2 className={styles.panelTitle}>By stage</h2>
                                <div className={styles.statusBars}>
                                    {[
                                        {
                                            label: 'New',
                                            count: stats.newCount,
                                            className: styles.barNew,
                                        },
                                        {
                                            label: 'In progress',
                                            count: stats.inProgressCount,
                                            className: styles.barInProgress,
                                        },
                                        {
                                            label: 'Approved',
                                            count: stats.approvedCount,
                                            className: styles.barApproved,
                                        },
                                        {
                                            label: 'Active',
                                            // ── CHANGED: use activeFosterCount (ASM) ──
                                            count: stats.activeFosterCount,
                                            className: styles.barCurrent,
                                        },
                                        {
                                            label: 'Rejected',
                                            count: stats.rejectedCount,
                                            className: styles.barRejected,
                                        },
                                    ].map(col => (
                                        <div key={col.label} className={styles.statusBarCol}>
                                            <div className={styles.statusBarTrack}>
                                                <div
                                                    className={`${styles.statusBarFill} ${col.className}`}
                                                    style={{
                                                        height: `${(col.count / stats.statusMax) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className={styles.statusBarCount}>{col.count}</span>
                                            <span className={styles.statusBarLabel}>{col.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
            </DashboardShell>
        </ProtectedRoute>
    )
}

function formatMonthLabel(ym: string): string {
    const [y, m] = ym.split('-').map(Number)
    if (!y || !m) return ym
    const d = new Date(y, m - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short' })
}