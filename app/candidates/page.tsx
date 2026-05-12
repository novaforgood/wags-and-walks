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
import { formatRelativeTime } from '@/app/lib/formatRelativeTime'
import styles from './candidates.module.css'

const MAX_VISIBLE_FLAGS = 2
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

type QuickFilters = {
    flagged: boolean
    thisWeek: boolean
    starred: boolean
}

const EMPTY_QUICK_FILTERS: QuickFilters = {
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
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`${styles.paginationBtn} ${active ? styles.paginationBtnActive : ''}`}
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

    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
    const [quickFilters, setQuickFilters] = useState<QuickFilters>(EMPTY_QUICK_FILTERS)

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
        let flagged = 0
        let thisWeek = 0
        let starred = 0
        for (const p of allCandidates) {
            if (getRedFlagTokens(p).length > 0) flagged += 1
            if (appliedWithinLastWeek(p)) thisWeek += 1
            if (p.starred) starred += 1
        }
        return { flagged, thisWeek, starred }
    }, [allCandidates])

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
    }, [allCandidates, searchQuery, quickFilters, filters])

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
                        <QuickPill
                            label="Red Flags"
                            count={isLoading && people.length === 0 ? null : bucketCounts.flagged}
                            active={quickFilters.flagged}
                            tone="danger"
                            onClick={() =>
                                setQuickFilters((q) => ({ ...q, flagged: !q.flagged }))
                            }
                        />
                        <QuickPill
                            label="This Week"
                            count={isLoading && people.length === 0 ? null : bucketCounts.thisWeek}
                            active={quickFilters.thisWeek}
                            tone="neutral"
                            onClick={() =>
                                setQuickFilters((q) => ({ ...q, thisWeek: !q.thisWeek }))
                            }
                        />
                        <QuickPill
                            label="Donor"
                            count={isLoading && people.length === 0 ? null : bucketCounts.starred}
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

                {/* Loading / Error */}
                {isLoading && people.length === 0 && (
                    <div className={styles.loadingContainer}>Loading applicants…</div>
                )}
                {error && <div className={styles.errorText}>{error}</div>}

                <div className={styles.tableWrapper} ref={tableWrapperRef}>
                    <div className={styles.tableContainer}>
                        <div className={styles.tableScroll}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Red Flags</th>
                                        <th>Applied</th>
                                        <th style={{ textAlign: 'center', width: '80px' }}>Donor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                {paginatedFiltered.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={4} className={styles.emptyState}>
                                            {allCandidates.length === 0
                                                ? 'No applicants yet.'
                                                : 'No applicants match the current filters.'}
                                        </td>
                                    </tr>
                                )}

                                {paginatedFiltered.map((person, i) => {
                                    const email = person.email || String(i)
                                    const closed = isClosedStatus(person.status)
                                    const name =
                                        `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
                                    const flagTokens = getRedFlagTokens(person)
                                    const visibleFlags = flagTokens.slice(0, MAX_VISIBLE_FLAGS)
                                    const extraFlags = flagTokens.length - visibleFlags.length

                                    const rowClasses = [
                                        styles.row,
                                        closed ? styles.rowClosed : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')

                                    return (
                                        <tr
                                            key={person.rowIndex ?? `${email}-${i}`}
                                            className={rowClasses}
                                        >
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

                                            {/* Donor toggle */}
                                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                <button
                                                    type="button"
                                                    className={`${styles.actionIconBtn} ${person.starred ? styles.actionIconStarActive : styles.actionIconStar}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        toggleStar(person.email || '')
                                                    }}
                                                    title={person.starred ? 'Unmark donor' : 'Mark as donor'}
                                                    aria-label={person.starred ? `Unmark ${name} as donor` : `Mark ${name} as donor`}
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
                                            </td>
                                        </tr>
                                    )
                                })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className={styles.pagination}>
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
                                            <span key={`ellipsis-${idx}`} className={styles.paginationEllipsis}>···</span>
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
                    onClose={() => setSelectedPerson(null)}
                />
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
    /** `null` while applicant list is still loading (avoids showing 0 before data arrives). */
    count: number | null
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
            <span className={styles.quickPillCount} aria-busy={count === null}>
                {count === null ? '…' : count}
            </span>
        </button>
    )
}
