'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePeople } from '@/app/components/PeopleProvider'
import FilterDropdown, { FilterState } from '@/app/components/FilterDropdown'
import PersonModal from '@/app/components/PersonModal'
import type { Person } from '@/app/lib/peopleTypes'
import NotificationPanel from '@/app/components/NotificationPanel'
import styles from '../candidates/candidates.module.css'

export default function FostersPage() {
    const { people, isLoading, error } = usePeople()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
    const [filters, setFilters] = useState<FilterState>({
        livingSituation: [],
        dogTypes: [],
        pastCurrentAnimals: [],
        experienceLevel: [],
        children: []
    })

    const allFosters = useMemo(() => {
        // Only show people that are actively fostering
        return people
            .filter(p => !!p.email && p.status === 'current')
            .sort((a, b) => {
                const ta = a.appliedAt ? new Date(a.appliedAt).getTime() : (a.rowIndex ?? 0)
                const tb = b.appliedAt ? new Date(b.appliedAt).getTime() : (b.rowIndex ?? 0)
                return tb - ta
            })
    }, [people])

    const filtered = useMemo(() => {
        return allFosters.filter(p => {
            const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase()
            const email = (p.email || '').toLowerCase()
            const q = searchQuery.toLowerCase()

            if (q && !name.includes(q) && !email.includes(q)) return false

            const raw = p.raw || {}

            // Living Situation
            if (filters.livingSituation.length > 0) {
                const val = String(raw['What is your living arrangement?'] || '').trim()
                if (!filters.livingSituation.includes(val)) return false
            }

            // Experience Level
            if (filters.experienceLevel.length > 0) {
                const val = String(raw['How would you rate your experience with dogs?'] || '').trim()
                if (!filters.experienceLevel.includes(val)) return false
            }

            // Children in home
            if (filters.children.length > 0) {
                const childrenCount = String(raw['How many children are in your home?'] || '0').trim()
                const hasChildren = childrenCount !== '0' && childrenCount !== ''
                const wantsHasChildren = filters.children.includes('Has children')
                const wantsNoChildren = filters.children.includes('No children')

                if (wantsHasChildren && !wantsNoChildren && !hasChildren) return false
                if (wantsNoChildren && !wantsHasChildren && hasChildren) return false
            }

            // Dog Types
            if (filters.dogTypes.length > 0) {
                const hasMatch = filters.dogTypes.some(type => p.specialNeeds?.includes(type))
                if (!hasMatch) return false
            }

            // Past/Current Animals
            if (filters.pastCurrentAnimals.length > 0) {
                const currentPets = String(raw['Do you currently have any pets at home?'] || '').toLowerCase()
                const pastPets = String(raw['Have you ever owned a pet before?'] || '').toLowerCase()

                let matchesPetsFilter = false
                if (filters.pastCurrentAnimals.includes('Currently owns pets') && currentPets.includes('yes')) {
                    matchesPetsFilter = true
                }
                if (filters.pastCurrentAnimals.includes('Previously owned pets') && pastPets.includes('yes')) {
                    matchesPetsFilter = true
                }
                if (filters.pastCurrentAnimals.includes('No past/current animals') &&
                    !currentPets.includes('yes') && !pastPets.includes('yes')) {
                    matchesPetsFilter = true
                }

                if (!matchesPetsFilter) return false
            }

            return true
        })
    }, [allFosters, searchQuery, filters])

    return (
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
                    <Link href="/candidates" className={styles.navItem}>
                        <img src="/assets/candidates.svg" alt="Candidates" width={18} height={18} />
                        Candidates
                    </Link>
                    <Link href="/fosters" className={`${styles.navItem} ${styles.navItemActive}`}>
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
                        <button className={styles.profileLogout}>Log Out</button>
                    </div>
                </div>
            </aside>

            {/* ---- Main Content ---- */}
            <div className={styles.mainContent}>
                {/* Top bar */}
                <div className={styles.topBar}>
                    <h1 className={styles.topBarTitle}>Onboarded fosters</h1>
                    <NotificationPanel />
                </div>

                {/* Title area (matching Candidates tab spacing) */}
                <div className={styles.tabSection}>
                    <div className={styles.tabRow}>
                        <span
                            className={`${styles.tab} ${styles.tabActive}`}
                            style={{ borderBottomColor: 'transparent', cursor: 'default', display: 'inline-block' }}
                        >
                            Select a foster
                        </span>
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
                    <div className={styles.loadingContainer}>Loading fosters...</div>
                )}
                {error && <div className={styles.errorText}>{error}</div>}

                {/* ---- Table ---- */}
                {!isLoading && (
                    <div className={styles.tableWrapper}>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Location</th>
                                        <th>Last update</th>
                                        <th>Currently fostering</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((person, i) => {
                                        const email = person.email || String(i)
                                        const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'

                                        const city = person.raw?.['City']?.trim() || 'Unknown'
                                        const state = person.raw?.['State']?.trim() || ''
                                        let location = state ? `${city}, ${state}` : city
                                        // For mock testing when not present
                                        if (location === 'Unknown') location = 'Westwood, CA'

                                        const lastUpdateDate = person.appliedAt ? new Date(person.appliedAt) : new Date()
                                        const lastUpdate = `${lastUpdateDate.getMonth() + 1}/${lastUpdateDate.getDate()}/${lastUpdateDate.getFullYear().toString().slice(-2)}`

                                        // Currently fostering YES hardcoded per instructions
                                        return (
                                            <tr key={email}>
                                                <td
                                                    className={styles.nameCell}
                                                    onClick={() => setSelectedPerson(person)}
                                                >{name}</td>
                                                <td>{location}</td>
                                                <td>{lastUpdate}</td>
                                                <td>Yes</td>
                                                <td>
                                                    <button className={styles.tableSelectBtn}>Select</button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {filtered.length === 0 && !error && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                                                No fosters found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Person detail modal */}
            <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
        </div>
    )
}
