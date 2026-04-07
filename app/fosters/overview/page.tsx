'use client'

import { useMemo } from 'react'
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

  const rows = useMemo(() => buildFosterOverview(people), [people])
  const totalOpen = useMemo(() => countOpenActions(rows), [rows])
  const overdue = useMemo(() => countOverdue(rows), [rows])

  return (
    <ProtectedRoute>
      <div className={layoutStyles.pageWrapper}>
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
              <a href="#" className={layoutStyles.profileEmail}>
                {user?.email}
              </a>
              <button type="button" className={layoutStyles.profileLogout} onClick={signOut}>
                Log Out
              </button>
            </div>
          </div>
        </aside>

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
              <p className={styles.intro}>
                High-level view of your active foster homes: headcount, outstanding tasks, and who is
                caring for which dogs. Use Directory for the full table and Action items for the task
                tree.
              </p>

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

              <h2 className={styles.sectionTitle}>Roster at a glance</h2>
              {rows.length === 0 && !error ? (
                <p className={styles.empty}>No active fosters yet.</p>
              ) : (
                <div className={styles.rosterList}>
                  {rows.map(row => {
                    const open = openCountForFoster(row)
                    const dogLine = row.dogs.map(d => d.name).join(', ')
                    return (
                      <div key={row.id} className={styles.rosterCard}>
                        <div>
                          <div className={styles.rosterName}>{row.fosterDisplayName}</div>
                          {row.email && (
                            <div className={styles.rosterMeta}>{row.email}</div>
                          )}
                          <div className={styles.rosterDogs}>
                            <strong>Dogs:</strong> {dogLine}
                          </div>
                        </div>
                        {open > 0 ? (
                          <span className={styles.badgeOpen}>{open} open</span>
                        ) : (
                          <span className={styles.badgeClear}>All clear</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
