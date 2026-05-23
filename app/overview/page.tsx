'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import DashboardTopBar from '@/app/components/DashboardTopBar'
import { DashboardShell } from '@/app/components/DashboardShell'
import type { Person, PersonStatus } from '@/app/lib/peopleTypes'
import StatMetricHelp from '@/app/components/StatMetricHelp'
import {
    countApplicantsAppliedThisWeek,
    countTrackableFosterStartsThisMonth,
} from '@/app/lib/overviewMetrics'
import { formatRelativeTime } from '@/app/lib/formatRelativeTime'
import { authFetch } from '@/app/lib/authFetch'
import type { TasksGetMetrics, TaskRow } from '@/app/api/tasks/route'
import {
    countTrackableFosterDogs,
    type DogRecord,
    type FosterStatus,
} from '@/app/lib/fosterDirectory'
import {
    compareNeedsAttentionPriority,
    enrichFosterDirectoryWithLanes,
    fosterNeedsAttention,
    inferLastFosterSubmissionYmdFromEmailSent,
    parseTaskSheetDateForSort,
    type EnrichedFosterRow,
    type TaskLane,
} from '@/app/lib/fosterTaskEnrichment'
import { formatFlagsForDisplay, rawFlagsHasMeaningfulTokens } from '@/app/lib/flagDisplay'
import styles from './overview.module.css'

function hasEmail(p: Person): boolean {
    return !!p.email?.trim()
}

function isRejectedStatus(s?: PersonStatus): boolean {
    if (!s) return false
    if (s === 'rejected') return true
    return s.startsWith('rejected_')
}

/** Raw sheet flags when at least one real token exists (excludes ok/none-only). */
function sheetFlagText(person: Person): string | null {
    const raw = String(person.raw?.['Flags'] ?? '').trim()
    if (!rawFlagsHasMeaningfulTokens(raw)) return null
    return raw
}

function hasRedFlag(person: Person): boolean {
    return sheetFlagText(person) != null
}

type QueueFilter = 'all' | 'flagged'

const APPLICANT_QUEUE_MAX = 7
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

/** Large stat value: avoid showing 0 before data exists (reads as “none” instead of “loading”). */
function StatValueFigure({
    pending,
    children,
    alert,
}: {
    pending: boolean
    children: React.ReactNode
    alert?: boolean
}) {
    if (pending) {
        return (
            <span className={styles.statValueSkeleton} aria-busy="true" title="Loading" />
        )
    }
    return (
        <span className={`${styles.statCardValue} ${styles.fadeIn} ${alert ? styles.statCardValueAlert : ''}`}>
            {children}
        </span>
    )
}

function OverviewSkeletonRows({ label }: { label: string }) {
    return (
        <div className={styles.skeletonRows} role="status" aria-live="polite" aria-label={label}>
            {Array.from({ length: 4 }).map((_, i) => (
                <div className={styles.skeletonRow} key={i} aria-hidden>
                    <span className={styles.skeletonAvatar} />
                    <span className={styles.skeletonMain}>
                        <span className={`${styles.skeletonLine} ${styles.skeletonLineName}`} />
                        <span className={`${styles.skeletonLine} ${styles.skeletonLineSub}`} />
                    </span>
                    <span className={styles.skeletonTail} />
                </div>
            ))}
        </div>
    )
}

function dogListLabel(dogs: EnrichedFosterRow['dogs']): string {
    const names = dogs.map(d => d.name).filter(Boolean)
    if (names.length === 0) return 'No dogs listed'
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

type TaskQueueBadge = { label: string; cls: string }

function badgeForTaskRow(row: EnrichedFosterRow, badgeStyles: Record<string, string>): TaskQueueBadge {
    const photoOd = row.photoWorst === 'overdue'
    const surveyOd = row.surveyWorst === 'overdue'
    if (photoOd || surveyOd) {
        if (photoOd && surveyOd) return { label: 'Photos and survey overdue', cls: badgeStyles.badgeFlag }
        if (photoOd) return { label: 'Photos overdue', cls: badgeStyles.badgeFlag }
        return { label: 'Survey overdue', cls: badgeStyles.badgeFlag }
    }
    if (row.photoWorst === 'unknown' || row.surveyWorst === 'unknown') {
        return { label: 'Task row status issue', cls: '' }
    }
    const missingPhoto = row.photoWorst === 'not_in_log'
    const missingSurvey = row.surveyWorst === 'not_in_log'
    if (missingPhoto && missingSurvey) return { label: 'Photos and survey not in log', cls: '' }
    if (missingPhoto) return { label: 'Photos not in log', cls: '' }
    if (missingSurvey) return { label: 'Survey not in log', cls: '' }
    if (row.householdRollup === 'Unknown') {
        return { label: 'Task status unclear', cls: badgeStyles.badgePlacement }
    }
    if (row.householdRollup === 'Needs Review') {
        return { label: 'Needs review', cls: badgeStyles.badgePlacement }
    }
    if (row.householdRollup === 'Overdue') {
        return { label: '30+ days in foster', cls: badgeStyles.badgePlacement }
    }
    const pl = row.photoHouseholdSheetLabel
    const sl = row.surveyHouseholdSheetLabel
    return { label: [...new Set([pl, sl])].join(' · '), cls: '' }
}

/** Task Log dates are often plain M/D/YYYY; show a readable absolute date for the row. */
function formatTaskLogDate(isoOrSheetDate?: string): string {
    if (!isoOrSheetDate?.trim()) return '—'
    const raw = isoOrSheetDate.trim()
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) {
        const month = Number(m[1])
        const day = Number(m[2])
        const year = Number(m[3])
        const parsed = new Date(year, month - 1, day)
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }
    }
    return raw
}

/** Earlier of the home’s photo vs. survey “last touch” dates from the directory enricher (completed, else email-adjusted, etc.). */
function oldestHouseholdPhotoOrSurveyEstimate(row: EnrichedFosterRow): string | undefined {
    let best: { ts: number; raw: string } | null = null
    for (const raw of [row.lastPhotoTaskActivityDate, row.lastSurveyTaskActivityDate]) {
        const s = raw?.trim()
        if (!s) continue
        const ts = parseTaskSheetDateForSort(s)
        if (ts == null) continue
        if (!best || ts < best.ts) best = { ts, raw: s }
    }
    return best?.raw
}

function earliestOverdueTrigger(
    row: EnrichedFosterRow,
    rowsByAnimalId: Map<string, TaskRow[]>
): { date?: string; isOverdue: boolean } {
    const animalIds = row.dogs.map(d => d.id)
    type Cand = { ts: number; display: string }

    function pickEarlier(a: Cand | null, b: Cand): Cand | null {
        if (!a || b.ts < a.ts) return b
        return a
    }

    const overdueCandidates: Cand[] = []
    const activeCandidates: Cand[] = []

    function bump(list: TaskRow[] | undefined) {
        if (!list) return
        for (const t of list) {
            if (t.status === 'completed' || t.status === 'retired') continue
            const rawEmail = (t.emailSentDate || '').trim()
            const rawSched = (t.scheduledDate || '').trim()
            if (!rawEmail && !rawSched) continue

            const display =
                rawEmail
                    ? inferLastFosterSubmissionYmdFromEmailSent(rawEmail, t.taskType) ?? rawEmail
                    : rawSched
            const rawForParse = rawEmail || rawSched
            const ts =
                parseTaskSheetDateForSort(display) ?? parseTaskSheetDateForSort(rawForParse)
            if (ts == null) continue

            const cand: Cand = { ts, display }
            if (t.status === 'overdue') overdueCandidates.push(cand)
            else activeCandidates.push(cand)
        }
    }

    for (const id of animalIds) bump(rowsByAnimalId.get(id))

    const bestOverdue = overdueCandidates.reduce<Cand | null>(pickEarlier, null)
    const bestActive = activeCandidates.reduce<Cand | null>(pickEarlier, null)

    if (bestOverdue) return { date: bestOverdue.display, isOverdue: true }
    if (bestActive) return { date: bestActive.display, isOverdue: false }
    return { date: row.lastUpdate, isOverdue: false }
}

export default function OverviewPage() {
    const { people, isLoading, error } = usePeople()
    const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')
    const [fetchKey, setFetchKey] = useState(0)
    const [syncedAt, setSyncedAt] = useState<string | undefined>(undefined)

    const [taskMetrics, setTaskMetrics] = useState<TasksGetMetrics | null>(null)
    const [tasksRequestDone, setTasksRequestDone] = useState(false)
    const [dogs, setDogs] = useState<DogRecord[]>([])
    const [dogsRequestDone, setDogsRequestDone] = useState(false)
    const [taskRows, setTaskRows] = useState<TaskRow[]>([])
    const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<Record<string, FosterStatus>>({})
    useEffect(() => {
        let active = true
        async function loadTaskMetrics() {
            try {
                const res = await authFetch('/api/tasks', { cache: 'no-store' })
                if (!res.ok || !active) return
                const data = await res.json()
                if (!active) return
                if (data?.metrics) setTaskMetrics(data.metrics as TasksGetMetrics)
                if (Array.isArray(data?.rows)) setTaskRows(data.rows as TaskRow[])
                if (data?.taskStatusByAnimalId) {
                    setTaskStatusByAnimalId(data.taskStatusByAnimalId as Record<string, FosterStatus>)
                }
            } catch { /* Task Log optional */ }
            finally {
                if (active) setTasksRequestDone(true)
            }
        }
        void loadTaskMetrics()
        return () => { active = false }
    }, [fetchKey])

    useEffect(() => {
        let active = true
        async function loadDogs() {
            try {
                const res = await authFetch('/api/dogs', { cache: 'no-store' })
                if (!res.ok || !active) return
                const data = await res.json()
                if (!active) return
                if (Array.isArray(data?.dogs)) setDogs(data.dogs as DogRecord[])
                if (data?.updatedAt) setSyncedAt(data.updatedAt as string)
            } catch { /* dogs optional */ }
            finally {
                if (active) setDogsRequestDone(true)
            }
        }
        void loadDogs()
        return () => { active = false }
    }, [fetchKey])

    const stats = useMemo(() => {
        const rows = people.filter(hasEmail)
        let newCount = 0, inProgressCount = 0, approvedCount = 0, currentCount = 0
        for (const p of rows) {
            const s = p.status || 'new'
            if (isRejectedStatus(s)) continue
            if (s === 'new') newCount++
            else if (s === 'in-progress') inProgressCount++
            else if (s === 'approved') approvedCount++
            else if (s === 'current') currentCount++
        }
        const pipelineCount = newCount + inProgressCount
        const flaggedInPipeline = rows.filter(p => {
            const s = p.status || 'new'
            return (s === 'new' || s === 'in-progress') && hasRedFlag(p)
        }).length
        const activeFosterCount = dogsRequestDone
            ? countTrackableFosterDogs(dogs)
            : currentCount
        return { newCount, inProgressCount, pipelineCount, approvedCount, currentCount, activeFosterCount, flaggedInPipeline }
    }, [people, dogsRequestDone, dogs])

    const applicantQueue = useMemo(() => {
        const rows = people.filter(hasEmail).filter(p => {
            const s = p.status || 'new'
            return !isRejectedStatus(s) && (s === 'new' || s === 'in-progress')
        })
        const filtered = rows.filter(p => queueFilter === 'all' ? true : hasRedFlag(p))
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
    const peoplePending = isLoading && people.length === 0
    const applicantsThisWeek = useMemo(() => countApplicantsAppliedThisWeek(people), [people])
    const fosterStartsThisMonth = useMemo(
        () => countTrackableFosterStartsThisMonth(dogs),
        [dogs]
    )
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
        let attention = 0, overdue = 0, unknown = 0
        for (const row of enrichedFosters) {
            if (fosterNeedsAttention(row)) attention++
            if (row.householdRollup === 'Overdue' || row.photoWorst === 'overdue' || row.surveyWorst === 'overdue') overdue++
            const bad = (l: TaskLane) => l === 'unknown' || l === 'not_in_log'
            if (row.householdRollup === 'Unknown' || bad(row.photoWorst) || bad(row.surveyWorst)) unknown++
        }
        return { attention, overdue, unknown }
    }, [enrichedFosters])

    const taskQueue = useMemo(() => {
        const filtered = enrichedFosters.filter(fosterNeedsAttention)
        return [...filtered].sort(compareNeedsAttentionPriority).slice(0, TASK_QUEUE_MAX)
    }, [enrichedFosters])

    /** Dogs + Task Log must both be settled before the queue is meaningful (otherwise every home looks “missing log”). */
    const fosterQueueDataReady = dogsRequestDone && tasksRequestDone

    const showTaskQueueSeeAll =
        fosterQueueDataReady &&
        taskQueue.length > 0 &&
        taskQueueCounts.attention > TASK_QUEUE_MAX
    const activeFosterPending =
        !dogsRequestDone && peoplePending
    const trackableFosterDogCount = useMemo(
        () => countTrackableFosterDogs(dogs),
        [dogs]
    )
    const activeFosterDisplay =
        dogsRequestDone ? trackableFosterDogCount : stats.activeFosterCount

    return (
        <ProtectedRoute>
            <DashboardShell>
                <DashboardTopBar
                    title="Overview"
                    syncUpdatedAt={syncedAt}
                    onSyncRefresh={() => {
                        setSyncedAt(new Date().toISOString())
                        setFetchKey(k => k + 1)
                    }}
                />

                {error && <div className={styles.errorText}>{error}</div>}

                <div className={styles.contentPadding}>
                        <div className={styles.statCards}>
                            <div className={styles.statCard}>
                                <StatMetricHelp
                                    label="Active fosters"
                                    helpAriaLabel="How active fosters is calculated"
                                >
                                    <p>
                                        Shows dogs currently in active foster placements. Dogs
                                        marked as trial adoption, foster-to-adopt, training, or
                                        special-status placements are excluded.
                                    </p>
                                </StatMetricHelp>
                                <StatValueFigure pending={activeFosterPending}>
                                    {activeFosterDisplay}
                                </StatValueFigure>
                            </div>

                            <div className={styles.statCard}>
                                <StatMetricHelp
                                    label="Tasks past due"
                                    helpAriaLabel="How tasks past due is calculated"
                                >
                                    <p>
                                        Shows how many foster follow-up tasks are currently
                                        overdue, including photo and survey check-ins.
                                    </p>
                                </StatMetricHelp>
                                <StatValueFigure
                                    pending={!tasksRequestDone}
                                    alert={tasksRequestDone && overdueFollowUpRows > 0}
                                >
                                    {overdueFollowUpRows}
                                </StatValueFigure>
                            </div>

                            <div className={styles.statCard}>
                                <StatMetricHelp
                                    label="New applicants this week"
                                    helpAriaLabel="How new applicants this week is calculated"
                                >
                                    <p>
                                        Shows how many new applications have been received this
                                        week (starting Monday). Rejected applications are
                                        excluded.
                                    </p>
                                </StatMetricHelp>
                                <StatValueFigure pending={peoplePending}>
                                    {applicantsThisWeek}
                                </StatValueFigure>
                            </div>

                            <div className={styles.statCard}>
                                <StatMetricHelp
                                    label="Foster starts this month"
                                    helpAriaLabel="How foster starts this month is calculated"
                                >
                                    <p>
                                        Dogs in active foster placements that started this
                                        calendar month (through today). Applies the same
                                        exclusions as Active Fosters. Data from ShelterManager.
                                    </p>
                                </StatMetricHelp>
                                <StatValueFigure pending={!dogsRequestDone}>
                                    {fosterStartsThisMonth}
                                </StatValueFigure>
                            </div>
                        </div>

                        <div className={styles.twoColumn}>
                            {/* ── Applicants ────────────────────────────── */}
                            <section className={styles.briefingSection} aria-labelledby="applicant-section-title">
                                <div className={styles.sectionHeader}>
                                    <div className={styles.sectionHeaderLeft}>
                                        <h2 id="applicant-section-title" className={styles.sectionTitle}>
                                            Applicants
                                        </h2>
                                    </div>
                                    <div className={`${styles.filterPills} ${styles.filterPillsCompact}`} role="tablist">
                                        {([['all', 'All'], ['flagged', 'Flags']] as const).map(([key, label]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                role="tab"
                                                aria-selected={queueFilter === key}
                                                className={`${styles.pill} ${styles.pillCompact} ${queueFilter === key ? styles.pillActive : ''}`}
                                                disabled={peoplePending}
                                                onClick={() => setQueueFilter(key)}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.panelBody}>
                                    {peoplePending ? (
                                        <OverviewSkeletonRows label="Loading applicants" />
                                    ) : applicantQueue.length === 0 ? (
                                        <p className={styles.emptyState}>No applicants found.</p>
                                    ) : (
                                        <ul className={`${styles.rowList} ${styles.fadeIn}`}>
                                            {applicantQueue.map(p => {
                                                const email = p.email!.trim()
                                                const href = `/applicants/${encodeURIComponent(email)}?from=overview`
                                                const rawFlags = sheetFlagText(p)
                                                const flagDisplay = rawFlags ? formatFlagsForDisplay(rawFlags) : null
                                                const isFlag = rawFlags != null
                                                return (
                                                    <li key={email}>
                                                        <Link
                                                            href={href}
                                                            className={styles.row}
                                                            aria-label={
                                                                isFlag && flagDisplay
                                                                    ? `${displayName(p)}, flag: ${flagDisplay}`
                                                                    : undefined
                                                            }
                                                        >
                                                            <span
                                                                className={styles.avatar}
                                                                style={{ background: avatarBg(email) }}
                                                                aria-hidden
                                                            >
                                                                {initialsOf(p)}
                                                            </span>
                                                            <div className={styles.rowMain}>
                                                                <span className={styles.rowName}>{displayName(p)}</span>
                                                                <span className={styles.rowSub}>{p.email}</span>
                                                                {flagDisplay && (
                                                                    <span className={styles.rowFlagDetail} title={rawFlags ?? undefined}>
                                                                        {flagDisplay}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className={styles.rowTail}>
                                                                <span className={styles.rowTime}>
                                                                    {formatRelativeTime(p.appliedAt)}
                                                                </span>
                                                            </div>
                                                        </Link>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )}
                                </div>

                                {showQueueSeeAll && (
                                    <div className={styles.sectionFooter}>
                                        <Link href="/candidates" className={styles.seeAllLink}>
                                            View all applicants →
                                        </Link>
                                    </div>
                                )}
                            </section>

                            {/* ── Fosters ───────────────────────────────── */}
                            <section className={styles.briefingSection} aria-labelledby="foster-section-title">
                                <div className={styles.sectionHeader}>
                                    <div className={styles.sectionHeaderLeft}>
                                        <h2 id="foster-section-title" className={styles.sectionTitle}>
                                            Fosters
                                        </h2>
                                    </div>
                                </div>

                                <div className={styles.panelBody}>
                                    {!fosterQueueDataReady ? (
                                        <OverviewSkeletonRows label="Loading foster directory" />
                                    ) : dogs.length === 0 ? (
                                        <p className={styles.emptyState}>
                                            No active foster dogs returned from Shelter Manager.
                                        </p>
                                    ) : trackableFosterDogCount === 0 ? (
                                        <p className={styles.emptyState}>All caught up.</p>
                                    ) : taskQueue.length === 0 ? (
                                        <p className={styles.emptyState}>All caught up.</p>
                                    ) : (
                                        <ul className={`${styles.rowList} ${styles.fadeIn}`}>
                                            {taskQueue.map(row => {
                                                const href = `/fosters/${row.id}?from=overview`
                                                const badge = badgeForTaskRow(row, styles)
                                                const fromLanes = oldestHouseholdPhotoOrSurveyEstimate(row)
                                                const trigger = earliestOverdueTrigger(row, taskRowsByAnimalId)
                                                const displayDate = fromLanes ?? trigger.date
                                                const dateTitle = fromLanes
                                                    ? 'Earlier of this home’s estimated last photo upload vs. last survey (matches directory: completed date when set, else log email date minus 5 or 7 days).'
                                                    : 'No photo/survey “last touch” on file for both lanes; showing the earliest open-task date from the Task Log instead.'
                                                return (
                                                    <li key={row.id}>
                                                        <Link href={href} className={styles.row}>
                                                            <span
                                                                className={styles.avatar}
                                                                style={{ background: avatarBg(row.fosterEmail) }}
                                                                aria-hidden
                                                            >
                                                                {fosterInitials(row.fosterName, row.fosterEmail)}
                                                            </span>
                                                            <div className={styles.rowMain}>
                                                                <span className={styles.rowName}>{row.fosterName}</span>
                                                                <span className={styles.rowSub}>{dogListLabel(row.dogs)}</span>
                                                            </div>
                                                            <div className={`${styles.rowTail} ${styles.rowTailFoster}`}>
                                                                <span className={`${styles.badge} ${badge.cls}`}>
                                                                    {badge.label}
                                                                </span>
                                                                <div
                                                                    className={styles.rowDateBlock}
                                                                    title={dateTitle}
                                                                >
                                                                    <span className={styles.rowDateLabel}>
                                                                        Last submission
                                                                    </span>
                                                                    <span className={styles.rowDateValue}>
                                                                        {formatTaskLogDate(displayDate)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )}
                                </div>

                                {showTaskQueueSeeAll && (
                                    <div className={styles.sectionFooter}>
                                        <Link href="/fosters" className={styles.seeAllLink}>
                                            View all fosters →
                                        </Link>
                                    </div>
                                )}
                            </section>
                        </div>

                </div>
            </DashboardShell>
        </ProtectedRoute>
    )
}
