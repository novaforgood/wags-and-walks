'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import { useAuth } from '@/app/components/AuthProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { buildFosterOverview, countOpenActions, openCountForFoster } from '@/app/lib/fosterActions'
import layoutStyles from '../../candidates/candidates.module.css'
import styles from './fostersOverview.module.css'
import FostersSubTabs from '../FostersSubTabs'

function countOverdue(rows: ReturnType<typeof buildFosterOverview>): number {
  let n = 0
  for (const row of rows) {
    for (const dog of row.dogs) {
      for (const a of dog.actions) {
        if (a.status === 'overdue') n += 1
      }
    }
  }
  return n
}

export default function FostersSectionOverviewPage() {
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

  const rows = useMemo(() => buildFosterOverview(people), [people])
  const totalOpen = useMemo(() => countOpenActions(rows), [rows])
  const overdue = useMemo(() => countOverdue(rows), [rows])

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
              href="/fosters"
              className={`${layoutStyles.navItem} ${pathname === '/fosters' ? layoutStyles.navItemActive : ''}`}
            >
              <img src="/assets/Search.svg" alt="" width={18} height={18} />
              Directory
            </Link>
            <Link
              href="/fosters/overview"
              className={`${layoutStyles.navItem} ${pathname?.startsWith('/fosters/') ? layoutStyles.navItemActive : ''}`}
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
              <a href="#" className={layoutStyles.profileEmail}>
                {user?.email}
              </a>
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
          </div>

          <FostersSubTabs active="overview" />

          {isLoading && people.length === 0 && (
            <div className={layoutStyles.loadingContainer}>Loading…</div>
          )}
          {error && <div className={layoutStyles.errorText}>{error}</div>}

          {!isLoading && (
            <div className={styles.wrap}>
              <section className={styles.heroPanel}>
                <p className={styles.intro}>
                  Snapshot of your active foster homes: headcount, outstanding tasks, and who is
                  currently caring for each dog. Use Directory for full records and Action items for
                  the task tree.
                </p>
              </section>

              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Active foster homes</span>
                  <span className={styles.statValue}>{rows.length}</span>
                  <span className={styles.statHint}>Applicants with status &quot;current&quot;</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Open tasks</span>
                  <span className={styles.statValue}>{totalOpen}</span>
                  <span className={styles.statHint}>Items still marked needed or overdue</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Overdue items</span>
                  <span className={styles.statValue}>{overdue}</span>
                  <span className={styles.statHint}>Across all fosters and dogs</span>
                </div>
              </div>

              <section className={styles.sectionPanel}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Roster at a glance</h2>
                  <span className={styles.sectionCount}>{rows.length} foster homes</span>
                </div>

                {rows.length === 0 && !error ? (
                  <p className={styles.empty}>No active fosters yet.</p>
                ) : (
                  <div className={styles.rosterList}>
                    {[...rows]
                      .sort((a, b) => openCountForFoster(b) - openCountForFoster(a))
                      .map(row => {
                        const open = openCountForFoster(row)
                        const dogLine = row.dogs.map(d => d.name).join(', ')
                        return (
                          <article key={row.id} className={styles.rosterCard}>
                            <div className={styles.rosterMain}>
                              <div className={styles.rosterName}>{row.fosterDisplayName}</div>
                              {row.email && <div className={styles.rosterMeta}>{row.email}</div>}
                              <div className={styles.rosterDogs}>
                                <strong>Dogs:</strong> {dogLine}
                              </div>
                            </div>
                            <div className={styles.rosterSide}>
                              <span className={styles.dogCount}>
                                {row.dogs.length} dog{row.dogs.length === 1 ? '' : 's'}
                              </span>
                              {open > 0 ? (
                                <span className={styles.badgeOpen}>{open} open</span>
                              ) : (
                                <span className={styles.badgeClear}>All clear</span>
                              )}
                            </div>
                          </article>
                        )
                      })}
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
