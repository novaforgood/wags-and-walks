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
import { normalizeEmailKey } from '@/app/lib/peopleTypes'
import styles from '../candidates/candidates.module.css'

type DogRecord = {
    id?: number
    name?: string
    foster?: {
        name?: string
        firstName?: string
        lastName?: string
        town?: string
        county?: string
        phone?: string
        email?: string
    }
}

type DogsApiResponse = {
    success?: boolean
    dogs?: DogRecord[]
    error?: string
}

type FosterListItem = {
    key: string
    person: Person | null
    email?: string
    phone?: string
    firstName?: string
    lastName?: string
    location: string
    dogCount: number
    dogNames: string[]
    lastUpdate?: string
}

function normalizeWhitespace(value?: string) {
    return String(value || '')
        .replace(/^[^A-Za-z0-9]+/, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function formatNameToken(token: string) {
    return token
        .split(/([-'])/)
        .map(part => {
            if (part === '-' || part === "'") return part
            if (!part) return part
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        })
        .join('')
}

function toDisplayName(value?: string) {
    const normalized = normalizeWhitespace(value)
    if (!normalized) return ''

    return normalized
        .split(' ')
        .filter(Boolean)
        .map(formatNameToken)
        .join(' ')
}

function parseFosterName(foster?: DogRecord['foster']) {
    const explicitFirst = toDisplayName(foster?.firstName)
    const explicitLast = toDisplayName(foster?.lastName)

    if (explicitFirst || explicitLast) {
        return {
            firstName: explicitFirst || undefined,
            lastName: explicitLast || undefined,
            fullName: [explicitFirst, explicitLast].filter(Boolean).join(' ').trim() || undefined
        }
    }

    const rawFullName = normalizeWhitespace(foster?.name)
    if (!rawFullName) {
        return { firstName: undefined, lastName: undefined, fullName: undefined }
    }

    if (rawFullName.includes(',')) {
        const [lastPart, firstPart] = rawFullName.split(',').map(part => toDisplayName(part))
        return {
            firstName: firstPart || undefined,
            lastName: lastPart || undefined,
            fullName: [firstPart, lastPart].filter(Boolean).join(' ').trim() || undefined
        }
    }

    const fullName = toDisplayName(rawFullName)
    const parts = fullName.split(' ').filter(Boolean)
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: undefined, fullName }
    }

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
        fullName
    }
}

function normalizeDogName(value?: string) {
    return toDisplayName(value)
}

function parseDogDate(value?: string) {
    if (!value) return undefined
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? undefined : d
}

function formatShortDate(value?: string) {
    const d = parseDogDate(value)
    if (!d) return 'Unknown'
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`
}

function getDisplayName(item: FosterListItem) {
    return `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || item.email || 'Unknown'
}

export default function FostersPage() {
    const pathname = usePathname()
    const { people } = usePeople()
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
    const [dogs, setDogs] = useState<DogRecord[]>([])
    const [isLoadingDogs, setIsLoadingDogs] = useState(true)
    const [dogsError, setDogsError] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        async function loadDogs() {
            setIsLoadingDogs(true)
            setDogsError(null)

            try {
                const response = await fetch('/api/dogs', { method: 'GET', cache: 'no-store' })
                const data = (await response.json()) as DogsApiResponse

                if (!response.ok || !data?.success || !Array.isArray(data.dogs)) {
                    throw new Error(data?.error || 'Failed to load fosters from Shelter Manager')
                }

                if (!active) return
                setDogs(data.dogs)
            } catch (error) {
                if (!active) return
                setDogsError(error instanceof Error ? error.message : 'Failed to load fosters from Shelter Manager')
            } finally {
                if (active) setIsLoadingDogs(false)
            }
        }

        loadDogs()
        return () => {
            active = false
        }
    }, [])

    const peopleByEmail = useMemo(() => {
        const map = new Map<string, Person>()
        for (const person of people) {
            const key = normalizeEmailKey(person.email)
            if (key) map.set(key, person)
        }
        return map
    }, [people])

    const allFosters = useMemo(() => {
        const grouped = new Map<string, FosterListItem & { lastUpdateDate?: number }>()

        for (const dog of dogs) {
            const foster = dog.foster
            if (!foster) continue

            const parsedName = parseFosterName(foster)
            const emailKey = normalizeEmailKey(foster.email)
            const key = emailKey || parsedName.fullName
            if (!key) continue

            const matchedPerson = emailKey ? peopleByEmail.get(emailKey) ?? null : null
            const town = normalizeWhitespace(foster.town) || matchedPerson?.raw?.['City']?.trim() || 'Unknown'
            const county = normalizeWhitespace(foster.county) || matchedPerson?.raw?.['State']?.trim() || ''
            const location = county ? `${town}, ${county}` : town
            const nextUpdateDate = parseDogDate(matchedPerson?.appliedAt)?.getTime()
            const dogName = normalizeDogName(dog.name)

            const existing = grouped.get(key)
            if (existing) {
                existing.dogCount += 1
                if (dogName) existing.dogNames.push(dogName)
                if (!existing.person && matchedPerson) existing.person = matchedPerson
                if (!existing.email && foster.email) existing.email = foster.email.trim()
                if (!existing.phone && foster.phone) existing.phone = foster.phone.trim()
                if ((!existing.firstName || !existing.lastName) && matchedPerson) {
                    existing.firstName = existing.firstName || matchedPerson.firstName
                    existing.lastName = existing.lastName || matchedPerson.lastName
                }
                if (!existing.firstName && parsedName.firstName) existing.firstName = parsedName.firstName
                if (!existing.lastName && parsedName.lastName) existing.lastName = parsedName.lastName
                if (nextUpdateDate && (!existing.lastUpdateDate || nextUpdateDate > existing.lastUpdateDate)) {
                    existing.lastUpdateDate = nextUpdateDate
                    existing.lastUpdate = matchedPerson?.appliedAt
                }
                continue
            }

            grouped.set(key, {
                key,
                person: matchedPerson,
                email: foster.email?.trim() || matchedPerson?.email,
                phone: foster.phone?.trim() || matchedPerson?.phone,
                firstName: matchedPerson?.firstName || parsedName.firstName,
                lastName: matchedPerson?.lastName || parsedName.lastName,
                location,
                dogCount: 1,
                dogNames: dogName ? [dogName] : [],
                lastUpdate: matchedPerson?.appliedAt,
                lastUpdateDate: nextUpdateDate
            })
        }

        return Array.from(grouped.values()).map(({ lastUpdateDate, ...item }) => ({
            ...item,
            dogNames: Array.from(new Set(item.dogNames)).sort((a, b) => a.localeCompare(b))
        }))
    }, [dogs, peopleByEmail])

    const filterablePeople = useMemo(
        () => allFosters.map(item => item.person).filter((person): person is Person => Boolean(person)),
        [allFosters]
    )

    const filtered = useMemo(() => {
        const visible = allFosters.filter(item => {
            const name = getDisplayName(item).toLowerCase()
            const email = (item.email || '').toLowerCase()
            const q = searchQuery.toLowerCase()

            if (q && !name.includes(q) && !email.includes(q) && !item.dogNames.some(dogName => dogName.toLowerCase().includes(q))) {
                return false
            }

            const raw = item.person?.raw || {}

            if (filters.livingSituation.length > 0) {
                const val = String(raw['What is your living arrangement?'] || '').trim()
                if (!filters.livingSituation.includes(val)) return false
            }

            if (filters.experienceLevel.length > 0) {
                const val = String(raw['How would you rate your experience with dogs?'] || '').trim()
                if (!filters.experienceLevel.includes(val)) return false
            }

            if (filters.children.length > 0) {
                const childrenCount = String(raw['How many children are in your home?'] || '0').trim()
                const hasChildren = childrenCount !== '0' && childrenCount !== ''
                const wantsHasChildren = filters.children.includes('Has children')
                const wantsNoChildren = filters.children.includes('No children')

                if (wantsHasChildren && !wantsNoChildren && !hasChildren) return false
                if (wantsNoChildren && !wantsHasChildren && hasChildren) return false
            }

            if (filters.dogTypes.length > 0) {
                const hasMatch = filters.dogTypes.some(type => item.person?.specialNeeds?.includes(type))
                if (!hasMatch) return false
            }

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

        return [...visible].sort((a, b) => {
            const ta = parseDogDate(a.lastUpdate)?.getTime() || 0
            const tb = parseDogDate(b.lastUpdate)?.getTime() || 0
            if (tb !== ta) return tb - ta
            return getDisplayName(a).localeCompare(getDisplayName(b))
        })
    }, [allFosters, searchQuery, filters])

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
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <Image src="/assets/logo.png" alt="Wags & Walks" width={160} height={60} priority />
                </div>

                <nav className={styles.sidebarNav}>
                    <Link href="/overview" className={styles.navItem}>
                        <img src="/assets/Overview.svg" alt="Overview" width={18} height={18} />
                        Overview
                    </Link>
                    <Link href="/candidates" className={styles.navItem}>
                        <img src="/assets/candidates.svg" alt="Applicants" width={18} height={18} />
                        Applicants
                    </Link>
                    <Link
                        href="/fosters"
                        className={`${styles.navItem} ${pathname === '/fosters' ? styles.navItemActive : ''}`}
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

            <div className={styles.mainContent}>
                <div className={styles.topBar}>
                    <h1 className={styles.topBarTitle}>Onboarded Fosters</h1>
                </div>

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
                        <button type="button" className={`${styles.toolbarBtn} ${styles.toolbarBtnStarred}`}>Recently added</button>
                        <button className={`${styles.toolbarBtn} ${styles.toolbarBtnStarred}`}>Starred</button>
                        <FilterDropdown people={filterablePeople} filters={filters} setFilters={setFilters} />
                    </div>
                </div>

                {isLoadingDogs && allFosters.length === 0 && (
                    <div className={styles.loadingContainer}>Loading fosters...</div>
                )}
                {dogsError && <div className={styles.errorText}>{dogsError}</div>}

                {!isLoadingDogs && (
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
                                    {filtered.map(item => {
                                        const displayName = getDisplayName(item)
                                        const [city = '', state = ''] = item.location.split(',').map(part => part.trim())
                                        const personForModal = item.person || {
                                            firstName: item.firstName,
                                            lastName: item.lastName,
                                            email: item.email,
                                            phone: item.phone,
                                            status: 'current',
                                            raw: {
                                                City: city,
                                                State: state,
                                                'Currently fostering dogs': item.dogNames.join(', ')
                                            }
                                        }

                                        return (
                                            <tr key={item.key}>
                                                <td
                                                    className={styles.nameCell}
                                                    onClick={() => setSelectedPerson(personForModal)}
                                                >{displayName}</td>
                                                <td>{item.location}</td>
                                                <td>{formatShortDate(item.lastUpdate)}</td>
                                                <td>{item.dogCount > 0 ? 'Yes' : 'No'}</td>
                                                <td>
                                                    <button
                                                        className={styles.tableSelectBtn}
                                                        onClick={() => setSelectedPerson(personForModal)}
                                                    >
                                                        Select
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    )}
                                    {filtered.length === 0 && !dogsError && (
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

            <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
        </div>
        </ProtectedRoute>
    )
}
