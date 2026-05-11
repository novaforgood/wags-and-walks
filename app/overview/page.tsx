'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import type { Person, PersonStatus } from '@/app/lib/peopleTypes'
import { formatRelativeTime } from '@/app/lib/formatRelativeTime'
import type { TasksDataQuality, TasksGetMetrics, TaskRow } from '@/app/api/tasks/route'
import type { DogRecord, FosterStatus } from '@/app/lib/fosterDirectory'
import {
    compareNeedsAttentionPriority,
    enrichFosterDirectoryWithLanes,
    fosterNeedsAttention,
    laneLabel,
    type EnrichedFosterRow,
    type TaskLane,
} from '@/app/lib/fosterTaskEnrichment'
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
type TaskQueueFilter = 'attention' | 'overdue' | 'unknown'

const APPLICANT_QUEUE_MAX = 6
const TASK_QUEUE_MAX = 6

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

function avatarBg(email?: string): string {
    const s = email || 'x'
    let h = 0
    for (let i = 0; i < s.length; i++) h += s.charCodeAt(i)
    return AVATAR_BG[h % AVATAR_BG.length]
}

function fosterInitials(name: string, email?: string): string {
    const trimmed = name.trim()
    if (trimmed) {
        const parts = trimmed.split(/\s+/)
        const first = parts[0]?.charAt(0) || ''
        const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
        const combined = (first + last).toUpperCase()
        if (combined) return combined
    }
    return (email || '?').slice(0, 2).toUpperCase()
}

function dogListLabel(dogs: EnrichedFosterRow['dogs']): string {
    const names = dogs.map(d => d.name).filter(Boolean)
    if (names.length === 0) return 'No dogs listed'
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

type TaskQueueBadge = { label: string; cls: string }

function badgeForTaskRow(row: EnrichedFosterRow, badgeStyles: Record<string, string>): TaskQueueBadge {
    if (row.householdRollup === 'Overdue' || row.photoWorst === 'overdue' || row.surveyWorst === 'overdue') {
        const photo = row.photoWorst === 'overdue'
        const survey = row.surveyWorst === 'overdue'
        const label =
            photo && survey
                ? 'Photos + survey overdue'
                : photo
                  ? 'Photos overdue'
                  : survey
                    ? 'Survey overdue'
                    : 'Overdue'
        return { label, cls: badgeStyles.badgeFlag }
    }
    if (row.householdRollup === 'Unknown' || row.photoWorst === 'unknown' || row.surveyWorst === 'unknown') {
        return { label: 'Unknown status', cls: badgeStyles.badgeReview }
    }
    const missingPhoto = row.photoWorst === 'not_in_log'
    const missingSurvey = row.surveyWorst === 'not_in_log'
    if (missingPhoto || missingSurvey) {
        const label =
            missingPhoto && missingSurvey
                ? 'Not in Task Log'
                : missingPhoto
                  ? 'Photos: not in log'
                  : 'Survey: not in log'
        return { label, cls: badgeStyles.badgeNew }
    }
    return { label: laneLabel(row.photoWorst === 'good' ? 'good' : row.surveyWorst), cls: badgeStyles.badgeReview }
}

/**
 * Earliest active "overdue trigger" across a household — the oldest
 * `emailSentDate` (or `scheduledDate` if the email never went out) among the
 * household's active Overdue task rows. Falls back to any active non-Overdue
 * row's date, and finally to the placement date so the cell is never blank.
 */
function earliestOverdueTrigger(
    row: EnrichedFosterRow,
    rowsByAnimalId: Map<string, TaskRow[]>
): { date?: string; isOverdue: boolean } {
    const animalIds = row.dogs.map(d => d.id)
    const candidatesOverdue: string[] = []
    const candidatesActive: string[] = []
    for (const id of animalIds) {
        const list = rowsByAnimalId.get(id)
        if (!list) continue
        for (const t of list) {
            if (t.status === 'completed' || t.status === 'retired') continue
            const d = (t.emailSentDate || t.scheduledDate || '').trim()
            if (!d) continue
            if (t.status === 'overdue') candidatesOverdue.push(d)
            else candidatesActive.push(d)
        }
    }
    if (candidatesOverdue.length > 0) {
        candidatesOverdue.sort()
        return { date: candidatesOverdue[0], isOverdue: true }
    }
    if (candidatesActive.length > 0) {
        candidatesActive.sort()
        return { date: candidatesActive[0], isOverdue: false }
    }
    return { date: row.lastUpdate, isOverdue: false }
}

function matchesTaskQueueFilter(row: EnrichedFosterRow, filter: TaskQueueFilter): boolean {
    if (filter === 'attention') return fosterNeedsAttention(row)
    if (filter === 'overdue') {
        return (
            row.householdRollup === 'Overdue' ||
            row.photoWorst === 'overdue' ||
            row.surveyWorst === 'overdue'
        )
    }
    if (filter === 'unknown') {
        const bad = (l: TaskLane) => l === 'unknown' || l === 'not_in_log'
        return row.householdRollup === 'Unknown' || bad(row.photoWorst) || bad(row.surveyWorst)
    }
    return true
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
    const [taskMetrics, setTaskMetrics] = useState<TasksGetMetrics | null>(null)
    const [dataQuality, setDataQuality] = useState<TasksDataQuality | null>(null)
    const [dogs, setDogs] = useState<DogRecord[]>([])
    const [taskRows, setTaskRows] = useState<TaskRow[]>([])
    const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<Record<string, FosterStatus>>({})
    const [taskQueueFilter, setTaskQueueFilter] = useState<TaskQueueFilter>('attention')

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

    useEffect(() => {
        let active = true
        async function loadTaskMetrics() {
            try {
                const res = await fetch('/api/tasks', { cache: 'no-store' })
                if (!res.ok || !active) return
                const data = await res.json()
                if (!active) return
                if (data?.metrics) setTaskMetrics(data.metrics as TasksGetMetrics)
                if (data?.dataQuality) setDataQuality(data.dataQuality as TasksDataQuality)
                if (Array.isArray(data?.rows)) setTaskRows(data.rows as TaskRow[])
                if (data?.taskStatusByAnimalId) {
                    setTaskStatusByAnimalId(data.taskStatusByAnimalId as Record<string, FosterStatus>)
                }
            } catch {
                /* Task Log optional */
            }
        }
        void loadTaskMetrics()
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        let active = true
        async function loadDogs() {
            try {
                const res = await fetch('/api/dogs', { cache: 'no-store' })
                if (!res.ok || !active) return
                const data = await res.json()
                if (!active) return
                if (Array.isArray(data?.dogs)) setDogs(data.dogs as DogRecord[])
            } catch {
                /* dogs optional — queue gracefully empties */
            }
        }
        void loadDogs()
        return () => {
            active = false
        }
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

    const overdueFollowUpRows = taskMetrics?.activeOverdueTaskRows ?? 0
    const unknownStatusRows = taskMetrics?.unknownStatusRowCount ?? 0

    const enrichedFosters = useMemo(
        () => enrichFosterDirectoryWithLanes(dogs, taskRows, taskStatusByAnimalId),
        [dogs, taskRows, taskStatusByAnimalId]
    )

    const taskRowsByAnimalId = useMemo(() => {
        const map = new Map<string, TaskRow[]>()
        for (const t of taskRows) {
            const id = t.animalId
            if (!id) continue
            const list = map.get(id)
            if (list) list.push(t)
            else map.set(id, [t])
        }
        return map
    }, [taskRows])

    const taskQueueCounts = useMemo(() => {
        let attention = 0
        let overdue = 0
        let unknown = 0
        for (const row of enrichedFosters) {
            if (fosterNeedsAttention(row)) attention += 1
            if (
                row.householdRollup === 'Overdue' ||
                row.photoWorst === 'overdue' ||
                row.surveyWorst === 'overdue'
            ) overdue += 1
            const badLane = (l: TaskLane) => l === 'unknown' || l === 'not_in_log'
            if (row.householdRollup === 'Unknown' || badLane(row.photoWorst) || badLane(row.surveyWorst)) {
                unknown += 1
            }
        }
        return { attention, overdue, unknown }
    }, [enrichedFosters])

    const taskQueue = useMemo(() => {
        const filtered = enrichedFosters.filter(r => matchesTaskQueueFilter(r, taskQueueFilter))
        return [...filtered].sort(compareNeedsAttentionPriority).slice(0, TASK_QUEUE_MAX)
    }, [enrichedFosters, taskQueueFilter])

    const taskQueueTotal =
        taskQueueFilter === 'attention'
            ? taskQueueCounts.attention
            : taskQueueFilter === 'overdue'
              ? taskQueueCounts.overdue
              : taskQueueCounts.unknown

    const showTaskQueueSeeAll = taskQueue.length > 0 && taskQueueTotal > TASK_QUEUE_MAX
    const hasDogsLoaded = dogs.length > 0

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
                            <section
                                className={styles.applicantCard}
                                id="foster-task-log"
                                aria-labelledby="foster-task-log-title"
                            >
                                <div className={styles.cardHead}>
                                    <div className={styles.cardHeadText}>
                                        <h2 id="foster-task-log-title" className={styles.cardTitle}>
                                            Foster tasks
                                        </h2>
                                        <p className={styles.cardSubtitle}>
                                            {overdueFollowUpRows} overdue follow-up{overdueFollowUpRows === 1 ? '' : 's'}
                                            {unknownStatusRows > 0
                                                ? ` · ${unknownStatusRows} unknown row${unknownStatusRows === 1 ? '' : 's'}`
                                                : ''}
                                        </p>
                                    </div>
                                    <div className={styles.filterBar} role="tablist" aria-label="Foster task filters">
                                        {(
                                            [
                                                ['attention', 'Needs attention'],
                                                ['overdue', 'Overdue'],
                                                ['unknown', 'Unknown / missing'],
                                            ] as const satisfies readonly (readonly [TaskQueueFilter, string])[]
                                        ).map(([key, label]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                role="tab"
                                                aria-selected={taskQueueFilter === key}
                                                className={`${styles.filterBtn} ${taskQueueFilter === key ? styles.filterBtnActive : ''}`}
                                                onClick={() => setTaskQueueFilter(key)}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {dataQuality?.hasUnknownTaskStatuses ? (
                                    <p className={styles.dataQualityBanner} role="status">
                                        Data quality: {dataQuality.unknownStatusRowCount} task row
                                        {dataQuality.unknownStatusRowCount === 1 ? '' : 's'} have missing or
                                        unrecognized status in the Task Log — not counted as Good until fixed.
                                    </p>
                                ) : null}

                                {!hasDogsLoaded ? (
                                    <p className={styles.emptyQueue}>Loading foster households…</p>
                                ) : taskQueue.length === 0 ? (
                                    <p className={styles.emptyQueue}>
                                        {taskQueueFilter === 'attention'
                                            ? 'All households are caught up — nothing needs attention.'
                                            : taskQueueFilter === 'overdue'
                                              ? 'No overdue follow-ups right now.'
                                              : 'No unknown / missing task rows right now.'}
                                    </p>
                                ) : (
                                    <ul className={styles.queueList}>
                                        {taskQueue.map(row => {
                                            const href = `/fosters/${row.id}?from=overview`
                                            const badge = badgeForTaskRow(row, styles)
                                            const trigger = earliestOverdueTrigger(row, taskRowsByAnimalId)
                                            const triggerTitle = trigger.isOverdue
                                                ? `Overdue since ${trigger.date ?? 'unknown'}`
                                                : trigger.date
                                                  ? `Last task activity ${trigger.date}`
                                                  : 'No task log activity'
                                            return (
                                                <li key={row.id}>
                                                    <Link href={href} className={styles.queueRow}>
                                                        <span
                                                            className={styles.queueAvatar}
                                                            style={{ background: avatarBg(row.fosterEmail) }}
                                                            aria-hidden
                                                        >
                                                            {fosterInitials(row.fosterName, row.fosterEmail)}
                                                        </span>
                                                        <span className={styles.queueMain}>
                                                            <span className={styles.queueName}>{row.fosterName}</span>
                                                            <span className={styles.queueSub}>{dogListLabel(row.dogs)}</span>
                                                        </span>
                                                        <span className={styles.queueRowTail}>
                                                            <span className={`${styles.queueBadge} ${badge.cls}`}>
                                                                {badge.label}
                                                            </span>
                                                            <span className={styles.queueTime} title={triggerTitle}>
                                                                {formatRelativeTime(trigger.date)}
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

                                {showTaskQueueSeeAll && (
                                    <div className={styles.queueFooter}>
                                        <Link href="/fosters" className={styles.queueFooterLink}>
                                            View all in Onboarded fosters
                                        </Link>
                                    </div>
                                )}
                            </section>
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