'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import FilterDropdown, { FilterState } from '@/app/components/FilterDropdown'
import PersonModal from '@/app/components/PersonModal'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import type { Person } from '@/app/lib/peopleTypes'
import styles from '../candidates/candidates.module.css'

export default function DirectoryPage() {
    const { people, isLoading, error, toggleStar } = usePeople()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
    const [showStarredOnly, setShowStarredOnly] = useState(false)
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

        if (showStarredOnly) {
            result = result.filter(p => p.starred)
        }

        return result
    }, [allApproved, searchQuery, filters, showStarredOnly])

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
                        <button
                            className={`${styles.toolbarBtn} ${styles.toolbarBtnStarred} ${showStarredOnly ? styles.toolbarBtnActive : ''}`}
                            onClick={() => setShowStarredOnly(v => !v)}
                        >Starred</button>
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
                                    <th>Actively fostering</th>
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
                                                        className={styles.selectBtn}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setSelectedPerson(person)
                                                        }}
                                                    >
                                                        View
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
                <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
        </DashboardShell>
        </ProtectedRoute>
    )
}

