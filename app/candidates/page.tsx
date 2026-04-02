'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePeople } from '@/app/components/PeopleProvider'
import { useAuth } from '@/app/components/AuthProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import PersonModal from '@/app/components/PersonModal'
import FilterDropdown, { FilterState } from '@/app/components/FilterDropdown'
import type { Person } from '@/app/lib/peopleTypes'
import NotificationPanel from '@/app/components/NotificationPanel'
import styles from './candidates.module.css'

type Tab = 'candidates' | 'redflags'

export default function CandidatesPage() {
    const { people, isLoading, error, setStatus } = usePeople()
    const { signOut } = useAuth()
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

    return (
        <ProtectedRoute>
        <div className={styles.pageWrapper}>
            {/* ---- Left Sidebar ---- */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <Image src="/assets/logo.png" alt="Wags & Walks" width={160} height={60} priority />
                </div>

                <nav className={styles.sidebarNav}>
                    <div className={styles.navItem}>
                        <img src="/assets/Overview.svg" alt="Overview" width={18} height={18} />
                        Overview
                    </div>
                    <Link href="/candidates" className={`${styles.navItem} ${styles.navItemActive}`}>
                        <img src="/assets/candidates.svg" alt="Candidates" width={18} height={18} />
                        Candidates
                    </Link>
                    <Link href="/fosters" className={styles.navItem}>
                        <img src="/assets/fosters.svg" alt="Fosters" width={18} height={18} />
                        Fosters
                    </Link>
                    <div className={styles.navItem}>
                        <img src="/assets/Notif.svg" alt="Notifications" width={18} height={18} />
                        Notifications
                    </div>
                </nav>

                <div className={styles.sidebarProfile}>
                    <div className={styles.profileAvatar} />
                    <div className={styles.profileInfo}>
                        <span className={styles.profileName}>Olivia Qi</span>
                        <a href="#" className={styles.profileEmail}>oliviaqi@ww.com</a>
                        <button className={styles.profileLogout} onClick={signOut}>Log Out</button>
                    </div>
                </div>
            </aside>

            {/* ---- Main Content ---- */}
            <div className={styles.mainContent}>
                {/* Top bar */}
                <div className={styles.topBar}>
                    <h1 className={styles.topBarTitle}>Foster candidates</h1>
                    <NotificationPanel />
                </div>

                {/* Tabs */}
                <div className={styles.tabSection}>
                    <div className={styles.tabRow}>
                        <button
                            className={`${styles.tab} ${activeTab === 'candidates' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('candidates')}
                        >
                            Candidates
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

                {/* ---- Candidates Tab ---- */}
                {activeTab === 'candidates' && (
                    <div className={styles.tableWrapper}>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        {/* TODO: Connect "Orientation date" to actual sheet column when available */}
                                        <th>Orientation date</th>
                                        {/* TODO: Connect "Signed document" to actual sheet column when available */}
                                        <th>Signed document</th>
                                        <th>Status</th>
                                        <th>Red flags</th>
                                        <th></th>
                                        <th style={{ width: '40px' }}></th>
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
                                                <td>
                                                    <button
                                                        className={styles.selectBtn}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            const rect = e.currentTarget.getBoundingClientRect()
                                                            setConfirmModalState({ isOpen: true, action: 'accept', person, x: rect.left + rect.width / 2, y: rect.top })
                                                        }}
                                                    >
                                                        Accept
                                                    </button>
                                                </td>
                                                <td style={{ textAlign: 'right', paddingLeft: 0, paddingRight: '24px' }}>
                                                    <button
                                                        className={styles.actionRejectBtn}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            const rect = e.currentTarget.getBoundingClientRect()
                                                            setConfirmModalState({ isOpen: true, action: 'reject', person, x: rect.left + rect.width / 2, y: rect.top })
                                                        }}
                                                        title="Reject"
                                                    >
                                                        ✕
                                                    </button>
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
                        <div className={`${styles.redFlagsTableCol}`}>
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

                        {/* Side panel — always visible; fills with info when a row is clicked */}
                        <div className={styles.sidePanel}>
                            {expandedEmail ? (() => {
                                const person = flaggedPeople.find(p => p.email === expandedEmail)
                                if (!person) return <div className={styles.sidePanelTitle}>Select a candidate</div>
                                const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
                                const flagsText = getRedFlagsDisplay(person)
                                return (
                                    <>
                                        <div className={styles.sidePanelTopBlock}>
                                            <div className={styles.sidePanelNameTitle}>{name}</div>
                                        </div>
                                        <div className={styles.sidePanelContent}>{flagsText}</div>
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
                                    </>
                                )
                            })() : (
                                <div className={styles.sidePanelTitle}>Select a candidate</div>
                            )}
                        </div>
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
                        style={{ left: confirmModalState.x, top: confirmModalState.y }}
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
                                    if (confirmModalState.person?.email) {
                                        setStatus(
                                            confirmModalState.person.email,
                                            confirmModalState.action === 'accept' ? 'in-progress' : 'rejected'
                                        )
                                    }
                                    setConfirmModalState(s => ({ ...s, isOpen: false }))
                                    setExpandedEmail(null)
                                }}
                            >
                                Yes
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
        </ProtectedRoute>
    )
}
