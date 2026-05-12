'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import FilterDropdown, { FilterState } from '@/app/components/FilterDropdown'
import PersonModal from '@/app/components/PersonModal'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import type { Person } from '@/app/lib/peopleTypes'
import type { FostererHistory } from '@/app/lib/asmFosterHistory'
import styles from '../candidates/candidates.module.css'
import dirStyles from './directory.module.css'

type FostererApiResponse = {
    success?: boolean
    fosterers?: FostererHistory[]
    error?: string
}

type DirectoryRow = {
    fosterer: FostererHistory
    person: Person | null
    displayName: string
    email: string
    phone: string
    currentlyFostering: boolean
    totalFostered: number
    starred: boolean
    hasApplication: boolean
}

// ASM occasionally returns names in "LAST, FIRST" format. Normalize to "First Last".
function splitFostererName(fullName: string): { firstName: string; lastName: string } {
    const raw = (fullName || '').trim()
    if (!raw) return { firstName: '', lastName: '' }

    if (raw.includes(',')) {
        const [last, first] = raw.split(',').map(s => s.trim())
        return { firstName: first || '', lastName: last || '' }
    }

    const parts = raw.split(/\s+/)
    if (parts.length === 1) return { firstName: parts[0], lastName: '' }
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function formatFostererDisplayName(fullName: string): string {
    const { firstName, lastName } = splitFostererName(fullName)
    return `${firstName} ${lastName}`.trim() || (fullName || '').trim() || 'Unknown'
}

// For ASM-only fosterers (no matching Sheet row) we still want the same modal
// experience. Build a minimal Person — PersonModal will show "No Application
// on File" in the application tab and still render notes / foster history.
function buildSyntheticPerson(fosterer: FostererHistory): Person {
    const { firstName, lastName } = splitFostererName(fosterer.fostererName || '')
    const address = [fosterer.address, fosterer.town, fosterer.county, fosterer.postcode]
        .filter(Boolean)
        .join(', ')
    return {
        firstName,
        lastName,
        email: fosterer.email,
        phone: fosterer.mobilePhone || fosterer.homePhone,
        address: address || undefined,
        status: fosterer.currentFosters.length > 0 ? 'current' : 'approved',
        source: 'ASM',
        raw: {},
    }
}

// Build the compact "[1] 2 ... 9 [10]" page-number list around the current page.
function buildPageList(totalPages: number, currentPage: number): (number | 'ellipsis')[] {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
        .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
            if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
            acc.push(page)
            return acc
        }, [])
}

export default function DirectoryPage() {
    const { people, isLoading: peopleLoading, error: peopleError, toggleStar } = usePeople()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
    const [showStarredOnly, setShowStarredOnly] = useState(false)
    const [showCurrentOnly, setShowCurrentOnly] = useState(false)
    const [fosterers, setFosterers] = useState<FostererHistory[]>([])
    const [isLoadingFosterers, setIsLoadingFosterers] = useState(true)
    const [fostererError, setFostererError] = useState<string | null>(null)
    const [filters, setFilters] = useState<FilterState>({
        livingSituation: [],
        dogTypes: [],
        pastCurrentAnimals: [],
        experienceLevel: [],
        children: []
    })

    const tableWrapperRef = useRef<HTMLDivElement>(null)
    const [itemsPerPage, setItemsPerPage] = useState(15)
    const [currentPage, setCurrentPage] = useState(1)

    useEffect(() => {
        let active = true
        async function load() {
            setIsLoadingFosterers(true)
            setFostererError(null)
            try {
                const res = await fetch('/api/foster-history', { cache: 'no-store' })
                const data = (await res.json()) as FostererApiResponse
                if (!res.ok || !data?.success || !Array.isArray(data.fosterers)) {
                    throw new Error(data?.error || 'Failed to load fosterers from Shelter Manager')
                }
                if (!active) return
                setFosterers(data.fosterers)
            } catch (e) {
                if (!active) return
                setFostererError(e instanceof Error ? e.message : 'Failed to load fosterers')
            } finally {
                if (active) setIsLoadingFosterers(false)
            }
        }
        load()
        return () => { active = false }
    }, [])

    const peopleByEmail = useMemo(() => {
        const map = new Map<string, Person>()
        for (const p of people) {
            const k = String(p.email || '').trim().toLowerCase()
            if (k) map.set(k, p)
        }
        return map
    }, [people])

    const rows = useMemo<DirectoryRow[]>(() => {
        return fosterers
            .map(f => {
                const emailKey = String(f.email || '').trim().toLowerCase()
                const person = emailKey ? peopleByEmail.get(emailKey) ?? null : null
                const fallbackName = `${person?.firstName ?? ''} ${person?.lastName ?? ''}`.trim()
                const displayName = formatFostererDisplayName(f.fostererName) || fallbackName || 'Unknown'
                return {
                    fosterer: f,
                    person,
                    displayName,
                    email: f.email || person?.email || '',
                    phone: f.mobilePhone || f.homePhone || person?.phone || '',
                    currentlyFostering: f.currentFosters.length > 0,
                    totalFostered: f.currentFosters.length + f.pastFosters.length,
                    starred: !!person?.starred,
                    hasApplication: !!person,
                }
            })
            .sort((a, b) => {
                if (a.currentlyFostering !== b.currentlyFostering) {
                    return a.currentlyFostering ? -1 : 1
                }
                return a.displayName.localeCompare(b.displayName)
            })
    }, [fosterers, peopleByEmail])

    const filtered = useMemo(() => {
        let result = rows

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(r =>
                r.displayName.toLowerCase().includes(q) ||
                r.email.toLowerCase().includes(q)
            )
        }

        if (showCurrentOnly) {
            result = result.filter(r => r.currentlyFostering)
        }

        if (showStarredOnly) {
            result = result.filter(r => r.starred)
        }

        const filtersActive =
            filters.livingSituation.length > 0 ||
            filters.experienceLevel.length > 0 ||
            filters.dogTypes.length > 0 ||
            filters.pastCurrentAnimals.length > 0 ||
            filters.children.length > 0

        if (filtersActive) {
            // Applicant-side filters can only apply when a Sheets row exists.
            result = result.filter(r => {
                const p = r.person
                if (!p) return false

                if (filters.livingSituation.length > 0) {
                    const v = String(p.raw?.['What is your living arrangement?'] || '').trim()
                    if (!filters.livingSituation.includes(v)) return false
                }

                if (filters.experienceLevel.length > 0) {
                    const v = String(p.raw?.['How would you rate your experience with dogs?'] || '').trim()
                    if (!filters.experienceLevel.includes(v)) return false
                }

                if (filters.dogTypes.length > 0) {
                    const sn = p.specialNeeds || []
                    if (!filters.dogTypes.some(t => sn.includes(t))) return false
                }

                if (filters.pastCurrentAnimals.length > 0) {
                    const currentStr = String(p.raw?.['Do you currently have any pets at home?'] || '').trim()
                    const pastStr = String(p.raw?.['Have you ever owned a pet before?'] || '').trim()
                    const noAnimals = currentStr.toLowerCase() === 'no' && pastStr.toLowerCase() === 'no'
                    const ok = filters.pastCurrentAnimals.some(opt => {
                        if (opt === 'Currently owns pets') return currentStr.toLowerCase() === 'yes'
                        if (opt === 'Previously owned pets') return pastStr.toLowerCase() === 'yes'
                        if (opt === 'No past/current animals') return noAnimals
                        return false
                    })
                    if (!ok) return false
                }

                if (filters.children.length > 0) {
                    const childStr = String(p.raw?.['How many children are in your home?'] || '').trim()
                    const hasKids = childStr !== '' && childStr !== '0'
                    const noKids = childStr === '0'
                    const ok = filters.children.some(opt => {
                        if (opt === 'Has children') return hasKids
                        if (opt === 'No children') return noKids
                        return false
                    })
                    if (!ok) return false
                }

                return true
            })
        }

        return result
    }, [rows, searchQuery, showCurrentOnly, showStarredOnly, filters])

    const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(itemsPerPage, 1)))

    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filtered.slice(start, start + itemsPerPage)
    }, [filtered, currentPage, itemsPerPage])

    // Reset to page 1 whenever the result set effectively changes.
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, showStarredOnly, showCurrentOnly, filters, fosterers])

    // Clamp current page if items-per-page shrinks past the current total.
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages)
    }, [currentPage, totalPages])

    // Auto-size pagination to fit the viewport (matches the /fosters pattern).
    useEffect(() => {
        const el = tableWrapperRef.current
        if (!el) return
        function calc() {
            const wrapper = el!
            const firstRow = wrapper.querySelector('tbody tr') as HTMLElement | null
            const rowH = firstRow ? firstRow.getBoundingClientRect().height : 40
            const thead = wrapper.querySelector('thead') as HTMLElement | null
            const theadH = thead ? thead.getBoundingClientRect().height : 50
            const available = wrapper.clientHeight - theadH - 72
            const next = Math.max(20, Math.floor(available / Math.max(rowH, 1)))
            setItemsPerPage(prev => (prev === next ? prev : next))
        }
        calc()
        const ro = new ResizeObserver(calc)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const isLoading = isLoadingFosterers || (peopleLoading && people.length === 0)
    const error = fostererError ?? peopleError
    const pageList = totalPages > 1 ? buildPageList(totalPages, currentPage) : []

    return (
        <ProtectedRoute>
        <DashboardShell>
                <div className={styles.topBar}>
                    <h1 className={styles.topBarTitle}>Directory</h1>
                    <div className={styles.topBarActions}>
                        <NotificationPanel />
                        <TopBarProfileMenu />
                    </div>
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.searchWrapper}>
                        <input
                            type="text"
                            placeholder="Search by name or email"
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <div className={styles.searchIconWrap}>
                            <img src="/assets/Search.svg" alt="Search" width={16} height={16} />
                        </div>
                    </div>
                    <div className={styles.toolbarRight}>
                        <button
                            className={`${styles.toolbarBtn} ${showCurrentOnly ? styles.toolbarBtnActive : ''}`}
                            onClick={() => setShowCurrentOnly(v => !v)}
                            title="Show only fosterers with an active foster placement in Shelter Manager"
                        >Currently fostering</button>
                        <button
                            className={`${styles.toolbarBtn} ${styles.toolbarBtnStarred} ${showStarredOnly ? styles.toolbarBtnActive : ''}`}
                            onClick={() => setShowStarredOnly(v => !v)}
                        >Starred</button>
                        <FilterDropdown people={people} filters={filters} setFilters={setFilters} />
                    </div>
                </div>

                {!isLoading && !error && (
                    <div className={dirStyles.resultsRow}>
                        <span className={dirStyles.resultsCount}>
                            {filtered.length} {filtered.length === 1 ? 'fosterer' : 'fosterers'}
                            {filtered.length !== rows.length && (
                                <span className={dirStyles.resultsHint}> of {rows.length}</span>
                            )}
                        </span>
                        {totalPages > 1 && (
                            <span className={dirStyles.resultsHint}>
                                Page {currentPage} of {totalPages}
                            </span>
                        )}
                    </div>
                )}

                {isLoading && rows.length === 0 && (
                    <div className={styles.loadingContainer}>Loading directory...</div>
                )}
                {error && <div className={styles.errorText}>{error}</div>}

                <div className={styles.tableWrapper} ref={tableWrapperRef}>
                    <div className={styles.tableContainer}>
                        <table className={`${styles.table} ${dirStyles.directoryTable}`}>
                            <colgroup>
                                <col className={dirStyles.colName} />
                                <col className={dirStyles.colEmail} />
                                <col className={dirStyles.colPhone} />
                                <col className={dirStyles.colCurrent} />
                                <col className={dirStyles.colTotal} />
                                <col className={dirStyles.colActions} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th className={dirStyles.hideOnMobile}>Phone</th>
                                    <th>Currently fostering</th>
                                    <th className={dirStyles.hideOnTablet}>Total fostered</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRows.map((r, index) => {
                                    const key = r.fosterer.fostererId || r.email || `${r.displayName}-${index}`
                                    const personForModal = r.person ?? buildSyntheticPerson(r.fosterer)
                                    return (
                                        <tr key={key}>
                                            <td
                                                className={styles.nameCell}
                                                onClick={() => setSelectedPerson(personForModal)}
                                            >
                                                {r.displayName}
                                            </td>
                                            <td>{r.email || '—'}</td>
                                            <td className={dirStyles.hideOnMobile}>{r.phone || '—'}</td>
                                            <td>{r.currentlyFostering ? 'Yes' : 'No'}</td>
                                            <td className={dirStyles.hideOnTablet}>{r.totalFostered}</td>
                                            <td>
                                                <div className={styles.rowActions}>
                                                    {r.hasApplication ? (
                                                        <button
                                                            className={`${styles.actionIconBtn} ${r.starred ? styles.actionIconStarActive : styles.actionIconStar} ${dirStyles.starSlot}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleStar(r.person!.email || '')
                                                            }}
                                                            title={r.starred ? 'Unstar' : 'Star'}
                                                            aria-label={r.starred ? `Unstar ${r.displayName}` : `Star ${r.displayName}`}
                                                        >
                                                            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIconSvg}>
                                                                <path
                                                                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                                    fill={r.starred ? 'currentColor' : 'none'}
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            </svg>
                                                        </button>
                                                    ) : (
                                                        <span
                                                            className={`${dirStyles.starSlot} ${dirStyles.starSlotDisabled}`}
                                                            title="No application on file — star unavailable"
                                                            aria-hidden="true"
                                                        >
                                                            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIconSvg}>
                                                                <path
                                                                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            </svg>
                                                        </span>
                                                    )}
                                                    <button
                                                        className={`${styles.selectBtn} ${dirStyles.selectBtnCompact}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setSelectedPerson(personForModal)
                                                        }}
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {!isLoading && filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className={dirStyles.emptyRow}>
                                            No fosterers found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className={dirStyles.paginationBar}>
                                <button
                                    className={dirStyles.pageBtn}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    aria-label="Previous page"
                                >
                                    ‹ Previous
                                </button>

                                {pageList.map((item, idx) =>
                                    item === 'ellipsis' ? (
                                        <span key={`ellipsis-${idx}`} className={dirStyles.pageEllipsis}>···</span>
                                    ) : (
                                        <button
                                            key={item}
                                            className={`${dirStyles.pageBtn} ${currentPage === item ? dirStyles.pageBtnActive : ''}`}
                                            onClick={() => setCurrentPage(item)}
                                            aria-current={currentPage === item ? 'page' : undefined}
                                            aria-label={`Go to page ${item}`}
                                        >
                                            {item}
                                        </button>
                                    )
                                )}

                                <button
                                    className={dirStyles.pageBtn}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    aria-label="Next page"
                                >
                                    Next ›
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
        </DashboardShell>
        </ProtectedRoute>
    )
}
