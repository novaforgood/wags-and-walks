'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import { buildFosterDirectory, fosterSlug, formatDateShort } from '@/app/lib/fosterDirectory'
import layoutStyles from '../../candidates/candidates.module.css'
import styles from './fostersOverview.module.css'
import FostersSubTabs from '../FostersSubTabs'

type DogRecord = {
  id?: number
  name?: string
  photo?: {
    imageUrl?: string
  }
  movement?: {
    daysInFoster?: number
    date?: string
  }
  foster?: {
    name?: string
    firstName?: string
    lastName?: string
    email?: string
  }
}

type DogsApiResponse = {
  success?: boolean
  dogs?: DogRecord[]
  error?: string
}

type UpdateRow = {
  id: string
  fosterName: string
  dogName: string
  uploadedPhoto: boolean
  status: 'Good' | 'Needs Review' | 'Overdue'
  daysInFoster?: number
  lastUpdate?: string
  fosterId: string
}

function nameOf(foster?: DogRecord['foster']) {
  const first = foster?.firstName?.trim() || ''
  const last = foster?.lastName?.trim() || ''
  const full = `${first} ${last}`.trim()
  return full || foster?.name?.trim() || 'Unknown Foster'
}

function dogName(dog?: DogRecord) {
  return dog?.name?.trim() || 'Unknown Dog'
}

export default function FostersSectionOverviewPage() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [dogsError, setDogsError] = useState<string | null>(null)
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

  useEffect(() => {
    let active = true
    async function loadDogs() {
      setIsLoadingDogs(true)
      setDogsError(null)
      try {
        const response = await fetch('/api/dogs', { method: 'GET', cache: 'no-store' })
        const data = (await response.json()) as DogsApiResponse
        if (!response.ok || !data?.success || !Array.isArray(data.dogs)) {
          throw new Error(data?.error || 'Failed to load overview from Shelter Manager')
        }
        if (!active) return
        setDogs(data.dogs)
      } catch (error) {
        if (!active) return
        setDogsError(error instanceof Error ? error.message : 'Failed to load overview from Shelter Manager')
      } finally {
        if (active) setIsLoadingDogs(false)
      }
    }
    loadDogs()
    return () => {
      active = false
    }
  }, [])

  const updates = useMemo(() => {
    return dogs.map((dog, idx) => {
      const uploadedPhoto = Boolean(dog.photo?.imageUrl)
      const days = dog.movement?.daysInFoster
      const overdue = (days ?? 0) > 30 && !uploadedPhoto
      const needsReview = !overdue && ((days ?? 0) > 14 || !uploadedPhoto)
      const fosterName = nameOf(dog.foster)
      return {
        id: `${dog.id ?? idx}`,
        fosterName,
        dogName: dogName(dog),
        uploadedPhoto,
        status: overdue ? 'Overdue' : needsReview ? 'Needs Review' : 'Good',
        daysInFoster: days,
        lastUpdate: dog.movement?.date,
        fosterId: fosterSlug(fosterName, dog.foster?.email),
      } satisfies UpdateRow
    })
  }, [dogs])

  const overdueCount = useMemo(() => updates.filter(r => r.status === 'Overdue').length, [updates])
  const needsReviewCount = useMemo(() => updates.filter(r => r.status === 'Needs Review').length, [updates])
  const noPhotoCount = useMemo(() => updates.filter(r => !r.uploadedPhoto).length, [updates])
  const activeFosters = useMemo(() => buildFosterDirectory(dogs).length, [dogs])
  const priorityQueue = useMemo(() => {
    return [...updates]
      .filter(r => r.status !== 'Good')
      .sort((a, b) => {
        const rank = (s: UpdateRow['status']) => (s === 'Overdue' ? 2 : 1)
        if (rank(b.status) !== rank(a.status)) return rank(b.status) - rank(a.status)
        return (b.daysInFoster ?? 0) - (a.daysInFoster ?? 0)
      })
      .slice(0, 8)
  }, [updates])

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
      <div className={layoutStyles.pageWrapper} style={{ ['--app-sidebar-width' as any]: `${navWidth}px` }}>
        <aside className={layoutStyles.sidebar}>
          <div className={layoutStyles.sidebarLogo}>
            <Image src="/assets/logo.png" alt="Wags & Walks" width={160} height={60} priority />
          </div>

          <nav className={layoutStyles.sidebarNav}>
            <Link href="/overview" className={layoutStyles.navItem}>
              <img src="/assets/Overview.svg" alt="" width={18} height={18} />
              Overview
            </Link>
            <Link href="/candidates" className={layoutStyles.navItem}>
              <img src="/assets/candidates.svg" alt="" width={18} height={18} />
              Applicants
            </Link>
            <Link
              href="/directory"
              className={`${layoutStyles.navItem} ${pathname === '/directory' ? layoutStyles.navItemActive : ''}`}
            >
              <img src="/assets/Search.svg" alt="" width={18} height={18} />
              Directory
            </Link>
            <Link
              href="/fosters/overview"
              className={`${layoutStyles.navItem} ${pathname?.startsWith('/fosters') ? layoutStyles.navItemActive : ''}`}
            >
              <img src="/assets/fosters.svg" alt="" width={18} height={18} />
              Fosters
            </Link>
          </nav>

          <div className={layoutStyles.sidebarProfile}>
            <div className={layoutStyles.profileAvatar}>
              {user?.email && user.email.charAt(0).toUpperCase()}
            </div>
            <div className={layoutStyles.profileInfo}>
              <span className={layoutStyles.profileName}>
                {user?.displayName || user?.email?.split('@')[0] || 'User'}
              </span>
              <a href="#" className={layoutStyles.profileEmail}>{user?.email}</a>
              <button type="button" className={layoutStyles.profileLogout} onClick={signOut}>
                Log Out
              </button>
            </div>
          </div>
        </aside>

        <div
          className={layoutStyles.navResizeHandle}
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            navStartXRef.current = e.clientX
            navStartWRef.current = navWidth
            setIsResizingNav(true)
          }}
        />

        <div className={layoutStyles.mainContent}>
          <div className={layoutStyles.topBar}>
            <h1 className={layoutStyles.topBarTitle}>Onboarded Fosters</h1>
            <NotificationPanel />
          </div>

          <FostersSubTabs active="overview" />

          {isLoadingDogs && <div className={layoutStyles.loadingContainer}>Loading overview...</div>}
          {dogsError && <div className={layoutStyles.errorText}>{dogsError}</div>}

          {!isLoadingDogs && (
            <div className={styles.wrap}>
              <section className={styles.heroPanel}>
                <p className={styles.intro}>
                  Action overview for active fosters. Prioritize overdue photo updates first, then dogs
                  that are trending toward overdue.
                </p>
              </section>

              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Overdue tasks</span>
                  <span className={styles.statValue}>{overdueCount}</span>
                  <span className={styles.statHint}>Past 30 days with no photo update</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Needs review soon</span>
                  <span className={styles.statValue}>{needsReviewCount}</span>
                  <span className={styles.statHint}>14-30 days or missing updates</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>No photo updates</span>
                  <span className={styles.statValue}>{noPhotoCount}</span>
                  <span className={styles.statHint}>Dogs currently missing photo evidence</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Active foster homes</span>
                  <span className={styles.statValue}>{activeFosters}</span>
                  <span className={styles.statHint}>Distinct foster households in ASM</span>
                </div>
              </div>

              <section className={styles.sectionPanel}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Priority Follow-Up Queue</h2>
                  <span className={styles.sectionCount}>{priorityQueue.length} highest priority</span>
                </div>

                {priorityQueue.length === 0 && !dogsError ? (
                  <p className={styles.empty}>No records found yet.</p>
                ) : (
                  <div className={styles.rosterList}>
                    {priorityQueue.map(row => (
                      <article key={row.id} className={styles.rosterCard}>
                        <div className={styles.rosterMain}>
                          <div className={styles.rosterName}>
                            <Link href={`/fosters/${row.fosterId}?from=overview`} className={styles.fosterLink}>
                              {row.fosterName}
                            </Link>
                          </div>
                          <div className={styles.rosterDogs}>
                            <strong>Dog:</strong> {row.dogName}
                          </div>
                          <div className={styles.rosterMeta}>
                            Last update: {formatDateShort(row.lastUpdate)} ·{' '}
                            {typeof row.daysInFoster === 'number' ? `${row.daysInFoster} days in foster` : 'Days unknown'}
                          </div>
                          <div className={styles.rosterMeta}>
                            Photo status: {row.uploadedPhoto ? 'Received' : 'Missing'}
                          </div>
                        </div>
                        <div className={styles.rosterSide}>
                          {row.status === 'Overdue' ? (
                            <span className={styles.badgeOpen}>Overdue</span>
                          ) : row.status === 'Needs Review' ? (
                            <span className={styles.badgeWarn}>Needs Review</span>
                          ) : (
                            <span className={styles.badgeClear}>Good</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

