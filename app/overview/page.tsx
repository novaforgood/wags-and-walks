'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import { normalizeEmailKey, type Person, type PersonStatus } from '@/app/lib/peopleTypes'
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

type QueueFilter = 'all' | 'flagged' | 'new' | 'in_review'

const AVATAR_BG = ['#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ea580c']

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

function parseStateFromAddress(address?: string): string | null {
    if (!address) return null
    const m = address.match(/\b([A-Z]{2})\s*\d{5}\b/i)
    if (m) return m[1].toUpperCase()
    const m2 = address.match(/,\s*([A-Z]{2})\s*,?\s*$/i)
    return m2 ? m2[1].toUpperCase() : null
}

function reviewSubtitle(p: Person): string {
    const state = parseStateFromAddress(p.address)
    const pets = (p.currentPets || '').toLowerCase() === 'yes' ? 'Pets at home' : 'No pets listed'
    const parts = ['Application']
    if (state) parts.push(state)
    parts.push(pets)
    return parts.join(' · ')
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

function formatActivityTime(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const now = Date.now()
    const diffMs = now - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const startOf = (t: number) => {
        const x = new Date(t)
        x.setHours(0, 0, 0, 0)
        return x.getTime()
    }
    const dayDiff = Math.round((startOf(now) - startOf(d.getTime())) / 86400000)
    if (dayDiff === 1) return 'Yesterday'
    if (dayDiff < 7) return `${dayDiff}d`
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
            { key: 'pipeline', label: 'In review', count: pipelineCount, color: '#7ecbcd' },
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

    const reviewQueue = useMemo(() => {
        const rows = people.filter(hasEmail).filter(p => {
            const s = p.status || 'new'
            if (isRejectedStatus(s)) return false
            return s === 'new' || s === 'in-progress'
        })
        const filtered = rows.filter(p => {
            if (queueFilter === 'all') return true
            if (queueFilter === 'flagged') return hasRedFlag(p)
            if (queueFilter === 'new') return (p.status || 'new') === 'new'
            return (p.status || '') === 'in-progress'
        })
        const ts = (p: Person) => {
            const t = p.appliedAt ? new Date(p.appliedAt).getTime() : NaN
            return Number.isNaN(t) ? Infinity : t
        }
        return [...filtered].sort((a, b) => ts(a) - ts(b)).slice(0, 12)
    }, [people, queueFilter])

    const activityItems = useMemo(() => {
        type Ev = { id: string; iso: string; kind: 'submitted' | 'notes'; person: Person }
        const out: Ev[] = []
        for (const p of people.filter(hasEmail)) {
            if (isRejectedStatus(p.status)) continue
            if (p.appliedAt) {
                out.push({
                    id: `sub-${normalizeEmailKey(p.email)}`,
                    iso: p.appliedAt,
                    kind: 'submitted',
                    person: p,
                })
            }
            if (p.notesUpdatedAt && p.notes?.trim()) {
                out.push({
                    id: `notes-${normalizeEmailKey(p.email)}-${p.notesUpdatedAt}`,
                    iso: p.notesUpdatedAt,
                    kind: 'notes',
                    person: p,
                })
            }
        }
        out.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
        return out.slice(0, 8)
    }, [people])

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
                                    <span className={styles.statLabel}>In review</span>
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

                            <div className={styles.insightsRow}>
                                <section className={styles.reviewCard} aria-labelledby="review-queue-title">
                                    <div className={styles.cardHead}>
                                        <div className={styles.cardHeadText}>
                                            <h2 id="review-queue-title" className={styles.cardTitle}>
                                                Review queue
                                            </h2>
                                            <p className={styles.cardSubtitle}>
                                                Applicants waiting on you, sorted by oldest first
                                            </p>
                                        </div>
                                        <div className={styles.filterBar} role="tablist" aria-label="Queue filter">
                                            {(
                                                [
                                                    ['all', 'All'],
                                                    ['flagged', 'Flagged'],
                                                    ['new', 'New'],
                                                    ['in_review', 'In review'],
                                                ] as const
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

                                    {reviewQueue.length === 0 ? (
                                        <p className={styles.emptyQueue}>
                                            {stats.pipelineCount === 0
                                                ? 'No applicants in the review queue yet.'
                                                : 'No applicants match this filter.'}
                                        </p>
                                    ) : (
                                        <ul className={styles.queueList}>
                                            {reviewQueue.map(p => {
                                                const email = p.email!.trim()
                                                const href = `/applicants/${encodeURIComponent(email)}`
                                                const badge = hasRedFlag(p)
                                                    ? { label: 'RED FLAG', cls: styles.badgeFlag }
                                                    : (p.status || 'new') === 'new'
                                                      ? { label: 'NEW', cls: styles.badgeNew }
                                                      : { label: 'IN REVIEW', cls: styles.badgeReview }
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
                                                                <span className={styles.queueMeta}>{reviewSubtitle(p)}</span>
                                                            </span>
                                                            <span className={`${styles.queueBadge} ${badge.cls}`}>{badge.label}</span>
                                                            <span className={styles.queueTime}>{formatRelativeTime(p.appliedAt)}</span>
                                                            <span className={styles.queueChevron} aria-hidden>
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                                                    <path
                                                                        d="M9 6l6 6-6 6"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                    />
                                                                </svg>
                                                            </span>
                                                        </Link>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )}
                                </section>

                                <section className={styles.activityCard} aria-labelledby="activity-title">
                                    <div className={styles.activityHead}>
                                        <div className={styles.cardHeadText}>
                                            <h2 id="activity-title" className={styles.cardTitle}>
                                                Activity
                                            </h2>
                                            <p className={styles.cardSubtitle}>Latest events across the workspace</p>
                                        </div>
                                        <Link href="/candidates" className={styles.viewAllLink}>
                                            View all
                                            <span aria-hidden> ›</span>
                                        </Link>
                                    </div>

                                    {activityItems.length === 0 ? (
                                        <p className={styles.emptyQueue}>No recent activity.</p>
                                    ) : (
                                        <ul className={styles.activityList}>
                                            {activityItems.map(ev => {
                                                const name = displayName(ev.person)
                                                const isFlagContext =
                                                    ev.kind === 'submitted' && hasRedFlag(ev.person)
                                                return (
                                                    <li key={ev.id}>
                                                        <div className={styles.activityRow}>
                                                            {isFlagContext ? (
                                                                <span className={styles.activityIconFlag} aria-hidden>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                                                                        <path
                                                                            fill="#dc2626"
                                                                            d="M6 20V4h1.5v16H6zm3-9.5L19 12l-10 5V10.5z"
                                                                        />
                                                                    </svg>
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    className={
                                                                        ev.kind === 'notes'
                                                                            ? styles.activityIconNotes
                                                                            : styles.activityIconApp
                                                                    }
                                                                    aria-hidden
                                                                />
                                                            )}
                                                            <p className={styles.activityText}>
                                                                {ev.kind === 'submitted' && (
                                                                    <>
                                                                        <strong>{name}</strong> submitted a new application
                                                                    </>
                                                                )}
                                                                {ev.kind === 'notes' && (
                                                                    <>
                                                                        <strong>{name}</strong> updated applicant notes
                                                                    </>
                                                                )}
                                                            </p>
                                                            <span className={styles.activityWhen}>{formatActivityTime(ev.iso)}</span>
                                                        </div>
                                                    </li>
                                                )
                                            })}
                                        </ul>
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