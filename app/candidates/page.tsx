'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import { useAuth } from '@/app/components/AuthProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import PersonModal from '@/app/components/PersonModal'
import NotificationPanel from '@/app/components/NotificationPanel'
import FilterDropdown, { FilterState } from '@/app/components/FilterDropdown'
import type { Person } from '@/app/lib/peopleTypes'
import styles from './candidates.module.css'

type Tab = 'candidates' | 'redflags'

export default function CandidatesPage() {
    const pathname = usePathname()
    const router = useRouter()
    const { people, isLoading, error, setStatus } = usePeople()
    const { user, signOut } = useAuth()
    const [activeTab, setActiveTab] = useState<Tab>('candidates')
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
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

    const [navWidth, setNavWidth] = useState<number>(() => {
        try {
            const raw = localStorage.getItem('app_nav_sidebar_width_v1')
            const n = raw ? Number(raw) : NaN
            return Number.isFinite(n) ? Math.max(180, Math.min(280, n)) : 208
        } catch {
            return 208
        }
    })
    const [isResizingNav, setIsResizingNav] = useState(false)
    const navStartXRef = useRef(0)
    const navStartWRef = useRef(208)
    const [filters, setFilters] = useState<FilterState>({
        livingSituation: [],
        dogTypes: [],
        pastCurrentAnimals: [],
        experienceLevel: [],
        children: []
    })

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

        return result
    }, [allCandidates, searchQuery, filters])

    // For Red Flags tab: only show people who have flags
    const flaggedPeople = useMemo(() => {
        return filtered.filter(p => {
            const flags = String(p.raw?.['Flags'] || '').trim().toLowerCase()
            return flags && flags !== 'ok' && flags !== 'none'
        })
    }, [filtered])

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

    useEffect(() => {
        if (!acceptToast.isOpen) return
        const t = window.setTimeout(() => {
            setAcceptToast({ isOpen: false, message: '' })
        }, 4200)
        return () => window.clearTimeout(t)
    }, [acceptToast.isOpen])

    useEffect(() => {
        try {
            localStorage.setItem('app_nav_sidebar_width_v1', String(navWidth))
        } catch {
            // ignore
        }
    }, [navWidth])

    useEffect(() => {
        if (!isResizingNav) return
        const prevUserSelect = document.body.style.userSelect
        document.body.style.userSelect = 'none'

        function onMove(e: PointerEvent) {
            const delta = e.clientX - navStartXRef.current
            const next = Math.max(180, Math.min(280, navStartWRef.current + delta))
            setNavWidth(next)
        }

        function onUp() {
            setIsResizingNav(false)
        }

        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        return () => {
            document.body.style.userSelect = prevUserSelect
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onUp)
        }
    }, [isResizingNav])

    return (
        <ProtectedRoute>
        <div
            className={styles.pageWrapper}
            style={{ ['--app-sidebar-width' as any]: `${navWidth}px` }}
        >
            {/* ---- Left Sidebar ---- */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <Image src="/assets/logo.svg" alt="Wags & Walks" width={160} height={60} priority />
                </div>

                <nav className={styles.sidebarNav}>
                    <Link href="/overview" className={styles.navItem}>
                        <img src="/assets/Overview.svg" alt="Overview" width={18} height={18} />
                        Overview
                    </Link>
                    <Link href="/candidates" className={`${styles.navItem} ${styles.navItemActive}`}>
                        <img src="/assets/candidates.svg" alt="Applicants" width={18} height={18} />
                        Applicants
                    </Link>
                    <Link
                        href="/directory"
                        className={`${styles.navItem} ${pathname === '/directory' ? styles.navItemActive : ''}`}
                    >
                        <img src="/assets/Search.svg" alt="Directory" width={18} height={18} />
                        Directory
                    </Link>
                    <Link
                        href="/fosters/overview"
                        className={`${styles.navItem} ${pathname?.startsWith('/fosters') ? styles.navItemActive : ''}`}
                    >
                        <img src="/assets/fosters.svg" alt="Fosters" width={18} height={18} />
                        Fosters
                    </Link>
                </nav>

                <div className={styles.sidebarProfile}>
                    <div className={styles.profileAvatar}>
                        {user?.email && user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.profileInfo}>
                        <span className={styles.profileName}>
                            {user?.displayName || user?.email?.split('@')[0] || 'User'}
                        </span>
                        <a href="#" className={styles.profileEmail}>{user?.email}</a>
                        <button className={styles.profileLogout} onClick={signOut}>Log Out</button>
                    </div>
                </div>
            </aside>

            <div
                className={styles.navResizeHandle}
                onPointerDown={(e) => {
                    e.preventDefault()
                    e.currentTarget.setPointerCapture(e.pointerId)
                    navStartXRef.current = e.clientX
                    navStartWRef.current = navWidth
                    setIsResizingNav(true)
                }}
            />

            {/* ---- Main Content ---- */}
            <div className={styles.mainContent}>
                {/* Top bar */}
                <div className={styles.topBar}>
                    <h1 className={styles.topBarTitle}>Foster Applicants</h1>
                    <NotificationPanel />
                </div>

                {/* Tabs */}
                <div className={styles.tabSection}>
                    <div className={styles.tabRow}>
                        <button
                            className={`${styles.tab} ${activeTab === 'candidates' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('candidates')}
                        >
                            Applicants
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'redflags' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('redflags')}
                        >
                            Red Flags
                        </button>
                        <div className={styles.tabUnderlineFull} />
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
                        <button className={`${styles.toolbarBtn} ${styles.toolbarBtnStarred}`}>Starred</button>
                        <FilterDropdown people={people} filters={filters} setFilters={setFilters} />
                    </div>
                </div>

                {/* Loading / Error */}
                {isLoading && people.length === 0 && (
                    <div className={styles.loadingContainer}>Loading candidates...</div>
                )}
                {error && <div className={styles.errorText}>{error}</div>}

                {/* ---- Applicants Tab ---- */}
                {activeTab === 'candidates' && (
                    <div className={styles.tableWrapper}>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        {/* TODO: Connect "Orientation date" to actual sheet column when available */}
                                        <th>Orientation Date</th>
                                        {/* TODO: Connect "Signed document" to actual sheet column when available */}
                                        <th>Signed Document</th>
                                        <th>Status</th>
                                        <th>Red Flags</th>
                                        <th style={{ textAlign: 'right', width: '180px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((person, i) => {
                                        const email = person.email || String(i)
                                        const isSelected = selectedEmails.has(email)
                                        const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
                                        const flagsDisplay = getRedFlagsDisplay(person)

                                        return (
                                            <tr
                                                key={email}
                                                className={isSelected ? styles.rowSelected : ''}
                                            >
                                                <td
                                                    className={styles.nameCell}
                                                    onClick={() => setSelectedPerson(person)}
                                                >{name}</td>
                                                {/* TODO: Replace with person.raw?.['Orientation date'] when column exists in sheet */}
                                                <td>TBD</td>
                                                {/* TODO: Replace with person.raw?.['Signed document'] when column exists in sheet */}
                                                <td>No</td>
                                                <td>{getStatusDisplay(person)}</td>
                                                <td className={hasFlags(person) ? styles.flagYes : styles.flagNone}>
                                                    {flagsDisplay === 'None' ? 'None' : 'Yes'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div className={styles.rowActions}>
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
                        </div>
                    </div>
                )}

                {/* ---- Red Flags Tab ---- */}
                {activeTab === 'redflags' && (
                    <div className={styles.redFlagsLayout}>
                        {/* Table column */}
                        <div className={`${styles.redFlagsTableCol} ${expandedEmail ? styles.redFlagsTableColWithPanel : ''}`}>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Red flags</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {flaggedPeople.map((person, i) => {
                                            const email = person.email || String(i)
                                            const isSelected = selectedEmails.has(email)
                                            const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
                                            const flagsText = getRedFlagsDisplay(person)

                                            return (
                                                <tr
                                                    key={email}
                                                    className={isSelected ? styles.rowSelected : ''}
                                                    onClick={() => setExpandedEmail(expandedEmail === email ? null : email)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <td>{name}</td>
                                                    <td className={styles.flagText}>{flagsText}</td>
                                                    <td>
                                                        <button
                                                            className={styles.selectBtn}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleSelect(person.email)
                                                            }}
                                                        >
                                                            Select
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Side panel — shown only when a row is selected */}
                        {expandedEmail && (() => {
                                const person = flaggedPeople.find(p => p.email === expandedEmail)
                                if (!person) return null
                                const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
                                const flagTokens = getRedFlagTokens(person)
                                return (
                                    <div className={styles.sidePanel}>
                                        <div className={styles.sidePanelTopBlock}>
                                            <div className={styles.sidePanelNameTitle}>{name}</div>
                                        </div>
                                        <div className={styles.sidePanelContent}>
                                            {flagTokens.map(flag => (
                                                <span key={flag} className={styles.redFlagBadge}>
                                                    {formatRedFlagLabel(flag)}
                                                </span>
                                            ))}
                                        </div>
                                        <button
                                            className={styles.viewMoreBtn}
                                            onClick={() => setSelectedPerson(person)}
                                        >
                                            View more
                                        </button>
                                        <div className={styles.actionButtons}>
                                            <button
                                                className={styles.acceptBtn}
                                                onClick={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect()
                                                    setConfirmModalState({ isOpen: true, action: 'accept', person, x: rect.left + rect.width / 2, y: rect.top })
                                                }}
                                            >Accept</button>
                                            <button
                                                className={styles.rejectBtn}
                                                onClick={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect()
                                                    setConfirmModalState({ isOpen: true, action: 'reject', person, x: rect.left + rect.width / 2, y: rect.top })
                                                }}
                                            >Reject</button>
                                        </div>
                                    </div>
                                )
                            })()}
                    </div>
                )}
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
                                            message: `${name} has been accepted as a current foster. They are not currently fostering, and an email has been sent informing them they’re a current foster.`
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
        </div>
        </ProtectedRoute>
    )
}
