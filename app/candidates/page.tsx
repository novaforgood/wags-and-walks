'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import ApplicantSlideOver from '@/app/components/ApplicantSlideOver'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import FilterDropdown, { FilterState } from '@/app/components/FilterDropdown'
import type { Person, PersonStatus } from '@/app/lib/peopleTypes'
import { normalizeEmailKey } from '@/app/lib/peopleTypes'
import { formatRelativeTime } from '@/app/lib/formatRelativeTime'
import {
    getTriageMap,
    setTriageOutcome,
    setManyTriageOutcome,
    clearTriageOutcome,
    clearManyTriageOutcome,
    type TriageOutcome,
} from '@/app/lib/applicantTriage'
import styles from './candidates.module.css'

const MAX_VISIBLE_FLAGS = 2
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Filter pill state for the local-only mark dropdown. "unmarked" = no tag set. */
type MarkState = 'unmarked' | 'approved' | 'rejected'

const MARK_STATE_OPTIONS: { value: MarkState; label: string }[] = [
    { value: 'approved', label: 'Marked Approved' },
    { value: 'rejected', label: 'Marked Rejected' },
    { value: 'unmarked', label: 'No Mark' },
]

type QuickFilters = {
    markStates: Set<MarkState>
    flagged: boolean
    thisWeek: boolean
    starred: boolean
}

const EMPTY_QUICK_FILTERS: QuickFilters = {
    markStates: new Set(),
    flagged: false,
    thisWeek: false,
    starred: false,
}

function submissionTooltip(person: Person): string {
    if (person.appliedAt) {
        const d = new Date(person.appliedAt)
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        }
    }
    const raw = String(person.raw?.['Submitted On'] || '').trim()
    return raw || 'Submission time unknown'
}

function PageButton({ onClick, disabled, active, children }: {
    onClick: () => void, disabled?: boolean, active?: boolean, children: React.ReactNode
}) {
    const [hovered, setHovered] = useState(false)
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                minWidth: '32px', height: '32px', borderRadius: '6px', border: 'none',
                background: active ? '#e8fbfe' : hovered && !disabled ? '#f0f0f0' : 'none',
                cursor: disabled ? 'default' : 'pointer',
                fontSize: '14px', padding: '0 8px',
                color: active ? '#05aaaf' : disabled ? '#ccc' : hovered ? '#333' : '#555',
                fontWeight: active ? '600' : '400',
                transition: 'background 0.15s, color 0.15s'
            }}
        >
            {children}
        </button>
    )
}

function getRedFlagTokens(person: Person): string[] {
    const raw = String(person.raw?.['Flags'] || '').trim()
    if (!raw || raw.toLowerCase() === 'ok' || raw.toLowerCase() === 'none') return []
    return raw
        .split(/[;,|]/)
        .map((t) => t.trim())
        .filter(Boolean)
}

function formatFlagLabel(token: string): string {
    return token
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

function isRejectedStatus(s?: PersonStatus): boolean {
    if (!s) return false
    if (s === 'rejected') return true
    return s.startsWith('rejected_')
}

function isClosedStatus(s?: PersonStatus): boolean {
    return s === 'approved' || s === 'current' || isRejectedStatus(s)
}

function appliedWithinLastWeek(p: Person): boolean {
    if (!p.appliedAt) return false
    const t = new Date(p.appliedAt).getTime()
    if (Number.isNaN(t)) return false
    return Date.now() - t <= ONE_WEEK_MS
}

export default function CandidatesPage() {
    const { people, isLoading, error, toggleStar } = usePeople()

    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
    const [quickFilters, setQuickFilters] = useState<QuickFilters>(EMPTY_QUICK_FILTERS)

    const [triageMap, setTriageMap] = useState<Map<string, TriageOutcome>>(new Map())
    useEffect(() => {
        setTriageMap(getTriageMap())
    }, [])

    const [bulkMarkConfirm, setBulkMarkConfirm] = useState<{
        isOpen: boolean
        outcome: TriageOutcome | null
    }>({ isOpen: false, outcome: null })

    const tableWrapperRef = useRef<HTMLDivElement>(null)
    const [itemsPerPage, setItemsPerPage] = useState(15)

    const [filters, setFilters] = useState<FilterState>({
        livingSituation: [],
        dogTypes: [],
        pastCurrentAnimals: [],
        experienceLevel: [],
        children: [],
    })

    /* ── Visible pipeline (all applicants — sheet decisions never hide rows) */
    const allCandidates = useMemo(() => {
        return [...people].sort((a, b) => {
            // Pipeline rows first (newest applied first), then closed rows beneath
            const aClosed = isClosedStatus(a.status)
            const bClosed = isClosedStatus(b.status)
            if (aClosed !== bClosed) return aClosed ? 1 : -1
            const ta = a.appliedAt ? new Date(a.appliedAt).getTime() : (a.rowIndex ?? 0)
            const tb = b.appliedAt ? new Date(b.appliedAt).getTime() : (b.rowIndex ?? 0)
            return tb - ta
        })
    }, [people])

    /* ── Bucket counts for the pill labels ─────────────────────────────── */
    const bucketCounts = useMemo(() => {
        let approved = 0
        let rejected = 0
        let unmarked = 0
        let flagged = 0
        let thisWeek = 0
        let starred = 0
        for (const p of allCandidates) {
            const key = normalizeEmailKey(p.email)
            const mark = triageMap.get(key)
            if (mark === 'approved') approved += 1
            else if (mark === 'rejected') rejected += 1
            else unmarked += 1
            if (getRedFlagTokens(p).length > 0) flagged += 1
            if (appliedWithinLastWeek(p)) thisWeek += 1
            if (p.starred) starred += 1
        }
        return { approved, rejected, unmarked, flagged, thisWeek, starred }
    }, [allCandidates, triageMap])

    /* ── Apply search + pills + advanced filters ───────────────────────── */
    const filtered = useMemo(() => {
        let result = allCandidates

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter((p) => {
                const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase()
                const email = (p.email || '').toLowerCase()
                return name.includes(q) || email.includes(q)
            })
        }

        if (quickFilters.markStates.size > 0) {
            result = result.filter((p) => {
                const key = normalizeEmailKey(p.email)
                const mark = triageMap.get(key)
                if (quickFilters.markStates.has('approved') && mark === 'approved') return true
                if (quickFilters.markStates.has('rejected') && mark === 'rejected') return true
                if (quickFilters.markStates.has('unmarked') && !mark) return true
                return false
            })
        }
        if (quickFilters.flagged) {
            result = result.filter((p) => getRedFlagTokens(p).length > 0)
        }
        if (quickFilters.thisWeek) {
            result = result.filter(appliedWithinLastWeek)
        }
        if (quickFilters.starred) {
            result = result.filter((p) => !!p.starred)
        }

        if (filters.livingSituation.length > 0) {
            result = result.filter((p) => {
                const val = String(p.raw?.['What is your living arrangement?'] || '').trim()
                return filters.livingSituation.includes(val)
            })
        }
        if (filters.experienceLevel.length > 0) {
            result = result.filter((p) => {
                const val = String(p.raw?.['How would you rate your experience with dogs?'] || '').trim()
                return filters.experienceLevel.includes(val)
            })
        }
        if (filters.dogTypes.length > 0) {
            result = result.filter((p) => {
                const sn = p.specialNeeds || []
                return filters.dogTypes.some((type) => sn.includes(type))
            })
        }
        if (filters.pastCurrentAnimals.length > 0) {
            result = result.filter((p) => {
                const currentStr = String(p.raw?.['Do you currently have any pets at home?'] || '').trim()
                const pastStr = String(p.raw?.['Have you ever owned a pet before?'] || '').trim()
                const noAnimals = currentStr.toLowerCase() === 'no' && pastStr.toLowerCase() === 'no'
                return filters.pastCurrentAnimals.some((opt) => {
                    if (opt === 'Currently owns pets') return currentStr.toLowerCase() === 'yes'
                    if (opt === 'Previously owned pets') return pastStr.toLowerCase() === 'yes'
                    if (opt === 'No past/current animals') return noAnimals
                    return false
                })
            })
        }
        if (filters.children.length > 0) {
            result = result.filter((p) => {
                const childStr = String(p.raw?.['How many children are in your home?'] || '').trim()
                const hasKids = childStr && childStr !== '0'
                const noKids = childStr === '0'
                return filters.children.some((opt) => {
                    if (opt === 'Has children') return hasKids
                    if (opt === 'No children') return noKids
                    return false
                })
            })
        }

        return result
    }, [allCandidates, searchQuery, quickFilters, filters, triageMap])

    const [currentPage, setCurrentPage] = useState(1)
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
    const paginatedFiltered = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filtered.slice(start, start + itemsPerPage)
    }, [filtered, currentPage, itemsPerPage])

    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, filters, quickFilters])

    useEffect(() => {
        const el = tableWrapperRef.current
        if (!el) return
        function calc() {
            const firstRow = el!.querySelector('tbody tr') as HTMLElement | null
            const rowH = firstRow ? firstRow.getBoundingClientRect().height : 48
            const thead = el!.querySelector('thead') as HTMLElement | null
            const theadH = thead ? thead.getBoundingClientRect().height : 50
            const available = el!.clientHeight - theadH - 72
            setItemsPerPage(Math.max(5, Math.floor(available / rowH)))
        }
        calc()
        const ro = new ResizeObserver(calc)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    /* ── Selection helpers ──────────────────────────────────────────────── */

    const toggleSelect = (email: string | undefined) => {
        if (!email) return
        setSelectedEmails((prev) => {
            const next = new Set(prev)
            if (next.has(email)) next.delete(email)
            else next.add(email)
            return next
        })
    }

    const allSelectableOnPage = useMemo(
        () => paginatedFiltered.map((p) => p.email).filter((e): e is string => !!e),
        [paginatedFiltered]
    )

    const isAllOnPageSelected =
        allSelectableOnPage.length > 0 &&
        allSelectableOnPage.every((e) => selectedEmails.has(e))

    function toggleSelectAllOnPage() {
        setSelectedEmails((prev) => {
            const next = new Set(prev)
            if (isAllOnPageSelected) {
                for (const e of allSelectableOnPage) next.delete(e)
            } else {
                for (const e of allSelectableOnPage) next.add(e)
            }
            return next
        })
    }

    function clearSelection() {
        setSelectedEmails(new Set())
    }

    /* ── Mark handlers (local-only tag) ─────────────────────────────────── */

    /** Toggle the row's mark — clicking the same outcome again clears it. */
    function applyRowMark(person: Person, outcome: TriageOutcome) {
        const key = normalizeEmailKey(person.email)
        const current = triageMap.get(key)
        const m =
            current === outcome
                ? clearTriageOutcome(person.email)
                : setTriageOutcome(person.email, outcome)
        setTriageMap(new Map(m))
    }

    function applyBulkMark(outcome: TriageOutcome) {
        const emails = [...selectedEmails]
        const m = setManyTriageOutcome(emails, outcome)
        setTriageMap(new Map(m))
        clearSelection()
        setBulkMarkConfirm({ isOpen: false, outcome: null })
    }

    function applyBulkUnmark() {
        const emails = [...selectedEmails]
        const m = clearManyTriageOutcome(emails)
        setTriageMap(new Map(m))
        clearSelection()
    }

    /* ── Render ─────────────────────────────────────────────────────────── */

    return (
        <ProtectedRoute>
            <DashboardShell>
                <div className={styles.topBar}>
                    <h1 className={styles.topBarTitle}>Foster Applicants</h1>
                    <div className={styles.topBarActions}>
                        <NotificationPanel />
                        <TopBarProfileMenu />
                    </div>
                </div>

                {/* Toolbar */}
                <div className={styles.toolbar}>
                    <div className={styles.searchWrapper}>
                        <input
                            type="text"
                            placeholder="Search name or email"
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <div className={styles.searchIconWrap}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/assets/Search.svg" alt="Search" width={16} height={16} />
                        </div>
                    </div>

                    {/* Quick-filter pills */}
                    <div className={styles.quickPills} role="group" aria-label="Quick filters">
                        <MarkStateDropdown
                            states={quickFilters.markStates}
                            counts={{
                                approved: bucketCounts.approved,
                                rejected: bucketCounts.rejected,
                                unmarked: bucketCounts.unmarked,
                            }}
                            onToggle={(state) =>
                                setQuickFilters((q) => {
                                    const next = new Set(q.markStates)
                                    if (next.has(state)) next.delete(state)
                                    else next.add(state)
                                    return { ...q, markStates: next }
                                })
                            }
                            onClear={() =>
                                setQuickFilters((q) => ({ ...q, markStates: new Set() }))
                            }
                        />
                        <QuickPill
                            label="Red Flags"
                            count={bucketCounts.flagged}
                            active={quickFilters.flagged}
                            tone="danger"
                            onClick={() =>
                                setQuickFilters((q) => ({ ...q, flagged: !q.flagged }))
                            }
                        />
                        <QuickPill
                            label="This Week"
                            count={bucketCounts.thisWeek}
                            active={quickFilters.thisWeek}
                            tone="neutral"
                            onClick={() =>
                                setQuickFilters((q) => ({ ...q, thisWeek: !q.thisWeek }))
                            }
                        />
                        <QuickPill
                            label="Starred"
                            count={bucketCounts.starred}
                            active={quickFilters.starred}
                            tone="neutral"
                            onClick={() =>
                                setQuickFilters((q) => ({ ...q, starred: !q.starred }))
                            }
                        />
                    </div>

                    <div className={styles.toolbarRight}>
                        <FilterDropdown people={people} filters={filters} setFilters={setFilters} />
                    </div>
                </div>

                {/* Bulk action bar — local-only marks */}
                {selectedEmails.size > 0 && (
                    <div className={styles.bulkBar} role="region" aria-label="Bulk actions">
                        <div className={styles.bulkBarLeft}>
                            <strong>{selectedEmails.size}</strong> selected
                            <span className={styles.bulkBarHint}>
                                — marks are local to this browser
                            </span>
                        </div>
                        <div className={styles.bulkBarActions}>
                            <button
                                type="button"
                                className={`${styles.bulkBtn} ${styles.bulkBtnTriageAccept}`}
                                onClick={() => setBulkMarkConfirm({ isOpen: true, outcome: 'approved' })}
                            >
                                Mark Approved
                            </button>
                            <button
                                type="button"
                                className={`${styles.bulkBtn} ${styles.bulkBtnTriageReject}`}
                                onClick={() => setBulkMarkConfirm({ isOpen: true, outcome: 'rejected' })}
                            >
                                Mark Rejected
                            </button>
                            <button type="button" className={styles.bulkBtn} onClick={applyBulkUnmark}>
                                Unmark
                            </button>
                            <button type="button" className={styles.bulkBtnGhost} onClick={clearSelection}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading / Error */}
                {isLoading && people.length === 0 && (
                    <div className={styles.loadingContainer}>Loading applicants…</div>
                )}
                {error && <div className={styles.errorText}>{error}</div>}

                <div className={styles.tableWrapper} ref={tableWrapperRef}>
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.colDot} aria-label="Mark indicator" />
                                    <th className={styles.colCheck}>
                                        <input
                                            type="checkbox"
                                            checked={isAllOnPageSelected}
                                            onChange={toggleSelectAllOnPage}
                                            aria-label="Select all on this page"
                                        />
                                    </th>
                                    <th>Name</th>
                                    <th>Red Flags</th>
                                    <th>Applied</th>
                                    <th style={{ textAlign: 'right', width: '200px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedFiltered.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={6} className={styles.emptyState}>
                                            {allCandidates.length === 0
                                                ? 'No applicants yet.'
                                                : 'No applicants match the current filters.'}
                                        </td>
                                    </tr>
                                )}

                                {paginatedFiltered.map((person, i) => {
                                    const email = person.email || String(i)
                                    const isSelected = selectedEmails.has(email)
                                    const markKey = normalizeEmailKey(person.email)
                                    const closed = isClosedStatus(person.status)
                                    const mark = triageMap.get(markKey)
                                    const rejected = isRejectedStatus(person.status)
                                    const sheetApproved = !rejected && closed
                                    const name =
                                        `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
                                    const flagTokens = getRedFlagTokens(person)
                                    const visibleFlags = flagTokens.slice(0, MAX_VISIBLE_FLAGS)
                                    const extraFlags = flagTokens.length - visibleFlags.length

                                    const rowClasses = [
                                        styles.row,
                                        isSelected ? styles.rowSelected : '',
                                        closed ? styles.rowClosed : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')

                                    return (
                                        <tr
                                            key={person.rowIndex ?? `${email}-${i}`}
                                            className={rowClasses}
                                        >
                                            {/* Indicator: local mark (preferred) or pipeline status */}
                                            <td className={styles.cellDot}>
                                                {mark === 'approved' && (
                                                    <span
                                                        className={`${styles.statusDot} ${styles.statusDotApproved}`}
                                                        title="Marked Approved (local only)"
                                                        aria-label="Marked approved"
                                                    >
                                                        ✓
                                                    </span>
                                                )}
                                                {mark === 'rejected' && (
                                                    <span
                                                        className={`${styles.statusDot} ${styles.statusDotRejected}`}
                                                        title="Marked Rejected (local only)"
                                                        aria-label="Marked rejected"
                                                    >
                                                        ✕
                                                    </span>
                                                )}
                                                {!mark && closed && sheetApproved && (
                                                    <span
                                                        className={`${styles.statusDot} ${styles.statusDotApproved}`}
                                                        title="Approved in pipeline"
                                                        aria-label="Approved in pipeline"
                                                    >
                                                        ✓
                                                    </span>
                                                )}
                                                {!mark && closed && rejected && (
                                                    <span
                                                        className={`${styles.statusDot} ${styles.statusDotRejected}`}
                                                        title="Rejected in pipeline"
                                                        aria-label="Rejected in pipeline"
                                                    >
                                                        ✕
                                                    </span>
                                                )}
                                                {!mark && !closed && (
                                                    <span className={styles.statusDot} aria-hidden />
                                                )}
                                            </td>

                                            {/* Bulk-select checkbox */}
                                            <td className={styles.cellCheck}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(person.email)}
                                                    aria-label={`Select ${name}`}
                                                />
                                            </td>

                                            {/* Name */}
                                            <td
                                                className={styles.nameCell}
                                                onClick={() => setSelectedPerson(person)}
                                            >
                                                <button
                                                    type="button"
                                                    className={styles.nameButton}
                                                    onClick={() => setSelectedPerson(person)}
                                                >
                                                    {name}
                                                </button>
                                                {person.email && (
                                                    <span className={styles.rowEmail}>{person.email}</span>
                                                )}
                                            </td>

                                            {/* Red flags as chips */}
                                            <td>
                                                {flagTokens.length === 0 ? (
                                                    <span className={styles.flagNone}>—</span>
                                                ) : (
                                                    <div className={styles.flagChips}>
                                                        {visibleFlags.map((t) => (
                                                            <span
                                                                key={t}
                                                                className={styles.flagChip}
                                                                title={formatFlagLabel(t)}
                                                            >
                                                                {formatFlagLabel(t)}
                                                            </span>
                                                        ))}
                                                        {extraFlags > 0 && (
                                                            <span
                                                                className={styles.flagChipMore}
                                                                title={flagTokens
                                                                    .slice(MAX_VISIBLE_FLAGS)
                                                                    .map(formatFlagLabel)
                                                                    .join(', ')}
                                                            >
                                                                +{extraFlags}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Applied (relative) */}
                                            <td
                                                className={styles.submittedRelative}
                                                title={submissionTooltip(person)}
                                            >
                                                {formatRelativeTime(person.appliedAt)}
                                            </td>

                                            {/* Row actions */}
                                            <td style={{ textAlign: 'right' }}>
                                                <div className={styles.rowActions}>
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconBtn} ${person.starred ? styles.actionIconStarActive : styles.actionIconStar}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            toggleStar(person.email || '')
                                                        }}
                                                        title={person.starred ? 'Unstar' : 'Star'}
                                                        aria-label={person.starred ? `Unstar ${name}` : `Star ${name}`}
                                                    >
                                                        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIconSvg}>
                                                            <path
                                                                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                                fill={person.starred ? 'currentColor' : 'none'}
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconBtn} ${styles.actionIconAccept} ${mark === 'approved' ? styles.actionIconTriageSelected : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            applyRowMark(person, 'approved')
                                                        }}
                                                        title={mark === 'approved' ? 'Unmark (was Approved)' : 'Mark Approved (local only)'}
                                                        aria-label={mark === 'approved' ? `Unmark ${name}` : `Mark ${name} approved`}
                                                        aria-pressed={mark === 'approved'}
                                                    >
                                                        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIconSvg}>
                                                            <path
                                                                d="M20 6L9 17l-5-5"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2.4"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconBtn} ${styles.actionIconReject} ${mark === 'rejected' ? styles.actionIconTriageSelected : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            applyRowMark(person, 'rejected')
                                                        }}
                                                        title={mark === 'rejected' ? 'Unmark (was Rejected)' : 'Mark Rejected (local only)'}
                                                        aria-label={mark === 'rejected' ? `Unmark ${name}` : `Mark ${name} rejected`}
                                                        aria-pressed={mark === 'rejected'}
                                                    >
                                                        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIconSvg}>
                                                            <path
                                                                d="M7 7l10 10M17 7L7 17"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2.2"
                                                                strokeLinecap="round"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', padding: '12px 16px' }}>
                                <PageButton onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                    ‹ Previous
                                </PageButton>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                                    .reduce<(number | '...')[]>((acc, page, idx, arr) => {
                                        if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('...')
                                        acc.push(page)
                                        return acc
                                    }, [])
                                    .map((item, idx) =>
                                        item === '...' ? (
                                            <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#888', fontSize: '14px' }}>···</span>
                                        ) : (
                                            <PageButton key={item} onClick={() => setCurrentPage(item as number)} active={currentPage === item}>
                                                {item}
                                            </PageButton>
                                        )
                                    )}
                                <PageButton onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                    Next ›
                                </PageButton>
                            </div>
                        )}
                    </div>
                </div>

                {/* Slide-over detail panel */}
                <ApplicantSlideOver
                    person={selectedPerson}
                    mark={
                        selectedPerson
                            ? triageMap.get(normalizeEmailKey(selectedPerson.email))
                            : undefined
                    }
                    onClose={() => setSelectedPerson(null)}
                    onSetMark={(outcome) => {
                        if (!selectedPerson) return
                        const m = setTriageOutcome(selectedPerson.email, outcome)
                        setTriageMap(new Map(m))
                    }}
                    onClearMark={() => {
                        if (!selectedPerson) return
                        const m = clearTriageOutcome(selectedPerson.email)
                        setTriageMap(new Map(m))
                    }}
                />

                {/* Bulk mark confirm — local-only, stored on this device */}
                {bulkMarkConfirm.isOpen && bulkMarkConfirm.outcome && (
                    <div
                        className={styles.bulkConfirmBackdrop}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setBulkMarkConfirm({ isOpen: false, outcome: null })
                        }}
                    >
                        <div className={styles.bulkConfirmModal} role="dialog" aria-modal="true">
                            <h2 className={styles.bulkConfirmTitle}>
                                Mark {selectedEmails.size} applicant{selectedEmails.size === 1 ? '' : 's'} as{' '}
                                {bulkMarkConfirm.outcome === 'approved' ? 'Approved' : 'Rejected'}?
                            </h2>
                            <p className={styles.bulkConfirmBody}>
                                This is a personal tag stored on your browser. It does not change anything in
                                the Google Sheet or notify the applicants.
                            </p>
                            <div className={styles.bulkConfirmFooter}>
                                <button
                                    type="button"
                                    className={styles.confirmCancelBtn}
                                    onClick={() => setBulkMarkConfirm({ isOpen: false, outcome: null })}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className={
                                        bulkMarkConfirm.outcome === 'approved'
                                            ? styles.confirmAcceptBtn
                                            : styles.confirmRejectBtn
                                    }
                                    onClick={() => applyBulkMark(bulkMarkConfirm.outcome!)}
                                >
                                    {bulkMarkConfirm.outcome === 'approved' ? 'Mark Approved' : 'Mark Rejected'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </DashboardShell>
        </ProtectedRoute>
    )
}

/* ── Quick-filter pill (used in the toolbar) ────────────────────────────── */

function QuickPill({
    label,
    count,
    active,
    tone,
    onClick,
}: {
    label: string
    count: number
    active: boolean
    tone: 'accent' | 'danger' | 'neutral'
    onClick: () => void
}) {
    const toneClass =
        tone === 'accent'
            ? styles.quickPillAccent
            : tone === 'danger'
                ? styles.quickPillDanger
                : ''
    return (
        <button
            type="button"
            className={`${styles.quickPill} ${toneClass} ${active ? styles.quickPillActive : ''}`}
            onClick={onClick}
            aria-pressed={active}
        >
            <span className={styles.quickPillLabel}>{label}</span>
            <span className={styles.quickPillCount}>{count}</span>
        </button>
    )
}

/* ── Mark dropdown (multi-select Approved / Rejected / No Mark) ─────────── */

function MarkStateDropdown({
    states,
    counts,
    onToggle,
    onClear,
}: {
    states: Set<MarkState>
    counts: Record<MarkState, number>
    onToggle: (state: MarkState) => void
    onClear: () => void
}) {
    const [open, setOpen] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        function onDocClick(e: MouseEvent) {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDocClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDocClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const activeCount = states.size
    const label =
        activeCount === 0
            ? 'Mark'
            : activeCount === 1
                ? MARK_STATE_OPTIONS.find((o) => states.has(o.value))!.label
                : `${activeCount} Marks`

    const totalActive = activeCount === 0
        ? 0
        : MARK_STATE_OPTIONS
            .filter((o) => states.has(o.value))
            .reduce((sum, o) => sum + counts[o.value], 0)

    return (
        <div className={styles.reviewDropdownWrap} ref={wrapRef}>
            <button
                type="button"
                className={`${styles.quickPill} ${activeCount > 0 ? styles.quickPillActive : ''}`}
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={styles.quickPillLabel}>{label}</span>
                {activeCount > 0 && (
                    <span className={styles.quickPillCount}>{totalActive}</span>
                )}
                <svg
                    className={`${styles.reviewDropdownChevron} ${open ? styles.reviewDropdownChevronOpen : ''}`}
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden
                >
                    <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {open && (
                <div className={styles.reviewDropdownMenu} role="listbox" aria-label="Filter by mark">
                    {MARK_STATE_OPTIONS.map((opt) => {
                        const checked = states.has(opt.value)
                        return (
                            <label
                                key={opt.value}
                                className={`${styles.reviewDropdownOption} ${checked ? styles.reviewDropdownOptionChecked : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    className={styles.reviewDropdownCheckbox}
                                    checked={checked}
                                    onChange={() => onToggle(opt.value)}
                                />
                                <span className={styles.reviewDropdownOptionLabel}>{opt.label}</span>
                                <span className={styles.reviewDropdownOptionCount}>{counts[opt.value]}</span>
                            </label>
                        )
                    })}
                    <button
                        type="button"
                        className={styles.reviewDropdownClear}
                        onClick={onClear}
                        disabled={activeCount === 0}
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    )
}
