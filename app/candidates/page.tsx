'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import PersonModal from '@/app/components/PersonModal'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import FilterDropdown, { FilterState } from '@/app/components/FilterDropdown'
import type { Person } from '@/app/lib/peopleTypes'
import styles from './candidates.module.css'


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

export default function CandidatesPage() {
    const router = useRouter()
    const { people, isLoading, error, setStatus, toggleStar, setSignedDocument } = usePeople()
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
    const [orientationDates, setOrientationDates] = useState<Record<string, string>>({})
    const [confirmModalState, setConfirmModalState] = useState<{
        isOpen: boolean,
        action: 'accept' | 'reject' | null,
        person: Person | null,
        x: number,
        y: number
    }>({
        isOpen: false,
        action: null,
        person: null,
        x: 0,
        y: 0
    })
    const [acceptToast, setAcceptToast] = useState<{
        isOpen: boolean
        message: string
    }>({ isOpen: false, message: '' })

    const tableWrapperRef = useRef<HTMLDivElement>(null)
    const [itemsPerPage, setItemsPerPage] = useState(15)

    const [filters, setFilters] = useState<FilterState>({
        livingSituation: [],
        dogTypes: [],
        pastCurrentAnimals: [],
        experienceLevel: [],
        children: []
    })
    const [showStarredOnly, setShowStarredOnly] = useState(false)
    const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)

    // Filter people by status — candidates page shows only new and in-progress applicants
    // (current = active fosters, approved = already approved, rejected = removed)
    // Sorted newest-first by submission timestamp; falls back to rowIndex if timestamp missing.
    const allCandidates = useMemo(() => {
        return people
            .filter(p => {
                const s = p.status || 'new'
                return s === 'new' || s === 'in-progress'
            })
            .sort((a, b) => {
                const ta = a.appliedAt ? new Date(a.appliedAt).getTime() : (a.rowIndex ?? 0)
                const tb = b.appliedAt ? new Date(b.appliedAt).getTime() : (b.rowIndex ?? 0)
                return tb - ta // descending: newest first
            })
    }, [people])

    // Apply search filter and dropdown filters
    const filtered = useMemo(() => {
        let result = allCandidates

        // 1. Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(p => {
                const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase()
                return name.includes(q)
            })
        }

        // 2. Dropdown Filters
        if (filters.livingSituation.length > 0) {
            result = result.filter(p => {
                const val = String(p.raw?.['What is your living arrangement?'] || '').trim()
                return filters.livingSituation.includes(val)
            })
        }

        if (filters.experienceLevel.length > 0) {
            result = result.filter(p => {
                const val = String(p.raw?.['How would you rate your experience with dogs?'] || '').trim()
                return filters.experienceLevel.includes(val)
            })
        }

        if (filters.dogTypes.length > 0) {
            result = result.filter(p => {
                const sn = p.specialNeeds || []
                return filters.dogTypes.some(type => sn.includes(type))
            })
        }

        if (filters.pastCurrentAnimals.length > 0) {
            result = result.filter(p => {
                const currentStr = String(p.raw?.['Do you currently have any pets at home?'] || '').trim()
                const pastStr = String(p.raw?.['Have you ever owned a pet before?'] || '').trim()
                const noAnimals = currentStr.toLowerCase() === 'no' && pastStr.toLowerCase() === 'no'

                return filters.pastCurrentAnimals.some(opt => {
                    if (opt === 'Currently owns pets') return currentStr.toLowerCase() === 'yes'
                    if (opt === 'Previously owned pets') return pastStr.toLowerCase() === 'yes'
                    if (opt === 'No past/current animals') return noAnimals
                    return false
                })
            })
        }

        if (filters.children.length > 0) {
            result = result.filter(p => {
                const childStr = String(p.raw?.['How many children are in your home?'] || '').trim()
                const hasKids = childStr && childStr !== '0'
                const noKids = childStr === '0'

                return filters.children.some(opt => {
                    if (opt === 'Has children') return hasKids
                    if (opt === 'No children') return noKids
                    return false
                })
            })
        }

        if (showStarredOnly) {
            result = result.filter(p => p.starred)
        }

        if (showFlaggedOnly) {
            result = result.filter(p => {
                const flags = String(p.raw?.['Flags'] || '').trim().toLowerCase()
                return flags && flags !== 'ok' && flags !== 'none'
            })
        }

        return result
    }, [allCandidates, searchQuery, filters, showStarredOnly, showFlaggedOnly])

    const [currentPage, setCurrentPage] = useState(1)
    const totalPages = Math.ceil(filtered.length / itemsPerPage)
    const paginatedFiltered = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filtered.slice(start, start + itemsPerPage)
    }, [filtered, currentPage, itemsPerPage])

    const toggleSelect = (email: string | undefined) => {
        if (!email) return
        setSelectedEmails(prev => {
            const next = new Set(prev)
            if (next.has(email)) {
                next.delete(email)
            } else {
                next.add(email)
            }
            return next
        })
    }

    const getRedFlagsDisplay = (person: typeof people[0]) => {
        const raw = String(person.raw?.['Flags'] || '').trim()
        if (!raw || raw.toLowerCase() === 'ok') return 'None'
        return raw
    }

    const getRedFlagTokens = (person: typeof people[0]) => {
        const value = getRedFlagsDisplay(person)
        if (value === 'None') return []

        return value
            .split(/[;,|]/)
            .map(token => token.trim())
            .filter(Boolean)
    }

    const formatRedFlagLabel = (token: string) => {
        return token
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase())
    }

    const hasFlags = (person: typeof people[0]) => {
        const flags = getRedFlagsDisplay(person)
        return flags !== 'None'
    }

    // Maps API status values to human-readable display labels for the Status column.
    // API statuses on this page: 'new' | 'in-progress'
    // Note: the API auto-promotes 'new' applicants with no flags to 'in-progress'
    // so 'new' here means the person has flags pending review.
    const getStatusDisplay = (person: typeof people[0]): string => {
        switch (person.status) {
            case 'in-progress': return 'In Progress'
            case 'new': return 'New'
            default: return 'New'
        }
    }

    // Handle orientation date change — updates local state and can persist to backend
    async function handleOrientationDateChange(email: string, date: string) {
        setOrientationDates(prev => ({ ...prev, [email]: date }))
        // Uncomment and wire up when API route is ready:
        // await fetch('/api/people/update', {
        //   method: 'POST',
        //   body: JSON.stringify({ email, orientationDate: date }),
        //   headers: { 'Content-Type': 'application/json' }
        // })
    }

    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, filters, showStarredOnly, showFlaggedOnly])

    useEffect(() => {
        if (!acceptToast.isOpen) return
        const t = window.setTimeout(() => {
            setAcceptToast({ isOpen: false, message: '' })
        }, 4200)
        return () => window.clearTimeout(t)
    }, [acceptToast.isOpen])

    useEffect(() => {
        const el = tableWrapperRef.current
        if (!el) return
        function calc() {
            const firstRow = el!.querySelector('tbody tr') as HTMLElement | null
            const rowH = firstRow ? firstRow.getBoundingClientRect().height : 48
            // subtract: thead + pagination (~56px) + wrapper bottom padding (16px)
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
                            placeholder="Search"
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <div className={styles.searchIconWrap}>
                            <img src="/assets/Search.svg" alt="Search" width={16} height={16} />
                        </div>
                    </div>
                    <div className={styles.toolbarRight}>
                        <button className={styles.toolbarBtn}>Recently added</button>
                        <button
                            className={`${styles.toolbarBtn} ${styles.toolbarBtnStarred} ${showStarredOnly ? styles.toolbarBtnActive : ''}`}
                            onClick={() => setShowStarredOnly(v => !v)}
                        >Starred</button>
                        <button
                            className={`${styles.toolbarBtn} ${showFlaggedOnly ? styles.toolbarBtnActive : ''}`}
                            onClick={() => setShowFlaggedOnly(v => !v)}
                        >Red Flags</button>
                        <FilterDropdown people={people} filters={filters} setFilters={setFilters} />
                    </div>
                </div>

                {/* Loading / Error */}
                {isLoading && people.length === 0 && (
                    <div className={styles.loadingContainer}>Loading candidates...</div>
                )}
                {error && <div className={styles.errorText}>{error}</div>}

                <div className={styles.tableWrapper} ref={tableWrapperRef}>
                    <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Orientation Date</th>
                                        {/* TODO: Connect "Signed document" to actual sheet column when available */}
                                        <th>Signed Document</th>
                                        <th>Status</th>
                                        <th>Red Flags</th>
                                        <th style={{ textAlign: 'right', width: '180px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedFiltered.map((person, i) => {
                                        const email = person.email || String(i)
                                        const isSelected = selectedEmails.has(email)
                                        const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
                                        const flagTokens = getRedFlagTokens(person)
                                        const flagsDisplay = flagTokens.length > 0
                                            ? flagTokens.map(formatRedFlagLabel).join(', ')
                                            : 'None'
                                        const signedDocument = person.signedDocument ?? 'No'

                                        return (
                                            <tr
                                                key={person.rowIndex ?? `${email}-${i}`}
                                                className={isSelected ? styles.rowSelected : ''}
                                            >
                                                <td
                                                    className={styles.nameCell}
                                                    onClick={() => setSelectedPerson(person)}
                                                >{name}</td>
                                                <td>
                                                    <input
                                                        type="date"
                                                        value={orientationDates[email] || ''}
                                                        onChange={(e) => handleOrientationDateChange(email, e.target.value)}
                                                        className={styles.orientationDateInput}
                                                        aria-label={`Orientation date for ${name}`}
                                                    />
                                                </td>
                                                {/* TODO: Replace with person.raw?.['Signed document'] when column exists in sheet */}
                                                <td>
                                                    <select
                                                        className={styles.signedDocumentSelect}
                                                        value={signedDocument}
                                                        onChange={(e) => {
                                                            const value = e.target.value as 'Yes' | 'No'
                                                            setSignedDocument(email, value)
                                                        }}
                                                        aria-label={`Signed document for ${name}`}
                                                    >
                                                        <option value="No">No</option>
                                                        <option value="Yes">Yes</option>
                                                    </select>
                                                </td>
                                                <td>{getStatusDisplay(person)}</td>
                                                <td className={flagTokens.length > 0 ? styles.flagYes : styles.flagNone}>
                                                    {flagsDisplay}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div className={styles.rowActions}>
                                                        <button
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
                                                            className={`${styles.actionIconBtn} ${styles.actionIconAccept}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                const rect = e.currentTarget.getBoundingClientRect()
                                                                setConfirmModalState({ isOpen: true, action: 'accept', person, x: rect.left + rect.width / 2, y: rect.top })
                                                            }}
                                                            title="Accept"
                                                            aria-label={`Accept ${name}`}
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
                                                            className={`${styles.actionIconBtn} ${styles.actionIconReject}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                const rect = e.currentTarget.getBoundingClientRect()
                                                                setConfirmModalState({ isOpen: true, action: 'reject', person, x: rect.left + rect.width / 2, y: rect.top })
                                                            }}
                                                            title="Reject"
                                                            aria-label={`Reject ${name}`}
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
                                    <PageButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                        ‹ Previous
                                    </PageButton>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
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
                                    <PageButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                        Next ›
                                    </PageButton>
                                </div>
                            )}
                        </div>
                    </div>
            {/* Person detail modal */}
            <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />

            {/* Confirmation Modal */}
            {confirmModalState.isOpen && confirmModalState.person && (
                <>
                    <div className={styles.modalOverlayTransparent} onClick={() => setConfirmModalState(s => ({ ...s, isOpen: false }))}></div>
                    <div
                        className={styles.confirmModalPopover}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className={styles.confirmTitlePopover}>
                            Are you sure you want to {confirmModalState.action} this applicant?
                        </h2>
                        <div className={styles.confirmActions}>
                            <button
                                className={styles.confirmCancelBtn}
                                onClick={() => setConfirmModalState(s => ({ ...s, isOpen: false }))}
                            >
                                Cancel
                            </button>
                            <button
                                className={confirmModalState.action === 'accept' ? styles.confirmAcceptBtn : styles.confirmRejectBtn}
                                onClick={() => {
                                    const name =
                                        `${confirmModalState.person?.firstName ?? ''} ${confirmModalState.person?.lastName ?? ''}`.trim() ||
                                        confirmModalState.person?.email ||
                                        'This applicant'
                                    const email = confirmModalState.person?.email
                                    if (email) {
                                        const nextStatus = confirmModalState.action === 'accept' ? 'approved' : 'rejected'
                                        setStatus(email, nextStatus)
                                        if (nextStatus === 'approved') {
                                            router.push('/fosters')
                                        }
                                    }
                                    setConfirmModalState(s => ({ ...s, isOpen: false }))
                                    setExpandedEmail(null)

                                    if (confirmModalState.action === 'accept') {
                                        setAcceptToast({
                                            isOpen: true,
                                            message: `${name} has been accepted as a current foster. They are not currently fostering, and an email has been sent informing them they're a current foster.`
                                        })
                                    }
                                }}
                            >
                                Yes
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Accepted Toast */}
            {acceptToast.isOpen && (
                <div
                    className={styles.acceptToast}
                    role="status"
                    aria-live="polite"
                    onClick={() => setAcceptToast({ isOpen: false, message: '' })}
                >
                    <div className={styles.acceptToastTitle}>Accepted</div>
                    <div className={styles.acceptToastBody}>{acceptToast.message}</div>
                    <button
                        type="button"
                        className={styles.acceptToastClose}
                        onClick={(e) => {
                            e.stopPropagation()
                            setAcceptToast({ isOpen: false, message: '' })
                        }}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
            )}
        </DashboardShell>
        </ProtectedRoute>
    )
}
