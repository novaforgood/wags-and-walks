'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import { useAuth } from '@/app/components/AuthProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import FilterDropdown, { FilterState } from '@/app/components/FilterDropdown'
import PersonModal from '@/app/components/PersonModal'
import type { Person } from '@/app/lib/peopleTypes'
import styles from '../candidates/candidates.module.css'

export default function DirectoryPage() {
    const pathname = usePathname()
    const { people, isLoading, error } = usePeople()
    const { user, signOut } = useAuth()
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
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
    const [filters, setFilters] = useState<FilterState>({
        livingSituation: [],
        dogTypes: [],
        pastCurrentAnimals: [],
        experienceLevel: [],
        children: []
    })

    // All approved applicants from Sheets (Applicant Status → 'approved')
    const allApproved = useMemo(() => {
        return people
            .filter(p => {
                const normalizedStatus = String(p.status || '').trim().toLowerCase()
                const rawStatus = String(p.raw?.['Applicant Status'] || '').trim().toLowerCase()
                return normalizedStatus === 'approved' || rawStatus === 'approved'
            })
            .sort((a, b) => {
                const ta = a.appliedAt ? new Date(a.appliedAt).getTime() : (a.rowIndex ?? 0)
                const tb = b.appliedAt ? new Date(b.appliedAt).getTime() : (b.rowIndex ?? 0)
                return tb - ta
            })
    }, [people])

    const filtered = useMemo(() => {
        let result: Person[] = allApproved

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(p => {
                const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase()
                const email = (p.email ?? '').toLowerCase()
                return name.includes(q) || email.includes(q)
            })
        }

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
    }, [allApproved, searchQuery, filters])

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
        <div className={styles.pageWrapper} style={{ ['--app-sidebar-width' as any]: `${navWidth}px` }}>
            {/* ---- Left Sidebar ---- */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <Image src="/assets/logo.png" alt="Wags & Walks" width={160} height={60} priority />
                </div>

                <nav className={styles.sidebarNav}>
                    <Link href="/overview" className={styles.navItem}>
                        <img src="/assets/Overview.svg" alt="Overview" width={18} height={18} />
                        Overview
                    </Link>
                    <Link
                        href="/candidates"
                        className={`${styles.navItem} ${pathname === '/candidates' ? styles.navItemActive : ''}`}
                    >
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
                        className={`${styles.navItem} ${pathname?.startsWith('/fosters/') ? styles.navItemActive : ''}`}
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
                    <h1 className={styles.topBarTitle}>Directory</h1>
                </div>

                {/* Toolbar (same styling as Applicants) */}
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
                        <FilterDropdown people={people} filters={filters} setFilters={setFilters} />
                    </div>
                </div>

                {/* Loading / Error */}
                {isLoading && people.length === 0 && (
                    <div className={styles.loadingContainer}>Loading directory...</div>
                )}
                {error && <div className={styles.errorText}>{error}</div>}

                {/* Directory Table */}
                <div className={styles.tableWrapper}>
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Currently fostering</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((person, index) => {
                                    const email = person.email || `row-${index}`
                                    const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
                                    const currentlyFostering = String(person.status || '').toLowerCase() === 'current'

                                    return (
                                        <tr key={email}>
                                            <td
                                                className={styles.nameCell}
                                                onClick={() => setSelectedPerson(person)}
                                            >
                                                {name}
                                            </td>
                                            <td>{person.email || '—'}</td>
                                            <td>{person.phone || '—'}</td>
                                            <td>{currentlyFostering ? 'Yes' : 'No'}</td>
                                            <td>
                                                <button
                                                    className={styles.selectBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedPerson(person)
                                                    }}
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
        </ProtectedRoute>
    )
}

