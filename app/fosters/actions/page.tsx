'use client'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import { useAuth } from '@/app/components/AuthProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import type { ActionStatus } from '@/app/lib/fosterActions'
import {
  buildFosterOverview,
  countOpenActions,
  openCountForFoster,
  type FosterOverviewRow,
} from '@/app/lib/fosterActions'
import layoutStyles from '../../candidates/candidates.module.css'
import styles from './fosterActions.module.css'
import FostersSubTabs from '../FostersSubTabs'

type Selection =
  | { kind: 'foster'; fosterId: string }
  | { kind: 'dog'; fosterId: string; dogId: string }

function statusPill(status: ActionStatus): string {
  switch (status) {
    case 'done':
      return styles.pillDone
    case 'overdue':
      return styles.pillOverdue
    default:
      return styles.pillNeeded
  }
}

function statusLabel(status: ActionStatus): string {
  switch (status) {
    case 'done':
      return 'Done'
    case 'overdue':
      return 'Overdue'
    default:
      return 'Needed'
  }
}

export default function FosterActionsPage() {
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

  const realRows = useMemo(() => buildFosterOverview(people), [people])
  const rows = useMemo(() => {
    // Demo-friendly: ensure the UI shows multiple fosters even with sparse data
    const min = 4
    if (realRows.length >= min) return realRows
    const needed = min - realRows.length
    return [...realRows, ...buildMockRows().slice(0, needed)]
  }, [realRows])
  const totalOpen = useMemo(() => countOpenActions(rows), [rows])
  const overdueCount = useMemo(() => {
    let n = 0
    for (const r of rows) for (const d of r.dogs) for (const a of d.actions) if (a.status === 'overdue') n += 1
    return n
  }, [rows])

  const [rootOpen, setRootOpen] = useState(true)
  const [expandedFosters, setExpandedFosters] = useState<Set<string>>(new Set())
  const [expandedDogs, setExpandedDogs] = useState<Set<string>>(new Set())

  const [selection, setSelection] = useState<Selection | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('fosters_actions_sidebar_width_v1')
      const n = raw ? Number(raw) : NaN
      return Number.isFinite(n) ? Math.max(260, Math.min(420, n)) : 312
    } catch {
      return 312
    }
  })
  const [isResizing, setIsResizing] = useState(false)
  const dragStartXRef = useRef(0)
  const startWidthRef = useRef(312)

  const defaultFosterId = rows[0]?.id
  const defaultDogId = rows[0]?.dogs?.[0]?.id

  const effectiveExpandedFosters =
    expandedFosters.size > 0
      ? expandedFosters
      : defaultFosterId
        ? new Set([defaultFosterId])
        : new Set<string>()

  const effectiveExpandedDogs =
    expandedDogs.size > 0
      ? expandedDogs
      : defaultFosterId && defaultDogId
        ? new Set([`${defaultFosterId}::${defaultDogId}`])
        : new Set<string>()

  const effectiveSelection: Selection | null =
    selection ??
    (defaultFosterId
      ? defaultDogId
        ? { kind: 'dog', fosterId: defaultFosterId, dogId: defaultDogId }
        : { kind: 'foster', fosterId: defaultFosterId }
      : null)

  const toggleFoster = useCallback((id: string) => {
    setExpandedFosters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleDog = useCallback((fosterId: string, dogId: string) => {
    const key = `${fosterId}::${dogId}`
    setExpandedDogs(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'

    function onMove(e: PointerEvent) {
      const delta = e.clientX - dragStartXRef.current
      const next = Math.max(260, Math.min(420, startWidthRef.current + delta))
      setSidebarWidth(next)
    }

    function onUp() {
      setIsResizing(false)
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
  }, [isResizing])

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

  useEffect(() => {
    try {
      localStorage.setItem('fosters_actions_sidebar_width_v1', String(sidebarWidth))
    } catch {
      // ignore
    }
  }, [sidebarWidth])

  const selectedRow = effectiveSelection
    ? rows.find(r => r.id === effectiveSelection.fosterId)
    : undefined
  const selectedDog =
    effectiveSelection?.kind === 'dog' && selectedRow
      ? selectedRow.dogs.find(d => d.id === effectiveSelection.dogId)
      : undefined

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
            <NotificationPanel />
          </div>

          <FostersSubTabs active="overview" />

          {isLoading && people.length === 0 && (
            <div className={layoutStyles.loadingContainer}>Loading…</div>
          )}
          {error && <div className={layoutStyles.errorText}>{error}</div>}

          {!isLoading && (
            <div className={styles.pageInner}>
              <aside
                className={styles.treePane}
                aria-label="Foster tree"
                style={{ width: sidebarWidth }}
              >
                <div className={styles.treeHeader}>Action Items</div>
                <div className={styles.treeScroll}>
                  <div className={styles.treeSummary}>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>Open tasks</span>
                      <span className={styles.summaryValue}>{totalOpen}</span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>Overdue</span>
                      <span className={styles.summaryValue}>{overdueCount}</span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>Fosters</span>
                      <span className={styles.summaryValue}>{rows.length}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.treeRootBtn}
                    onClick={() => setRootOpen(o => !o)}
                  >
                    <span className={styles.chevron}>{rootOpen ? '▼' : '▶'}</span>
                    Foster homes
                    <span className={styles.badge}>{rows.length}</span>
                  </button>

                  {rootOpen &&
                    [...rows]
                      .sort((a, b) => openCountForFoster(b) - openCountForFoster(a))
                      .map(row => {
                      const fOpen = effectiveExpandedFosters.has(row.id)
                      const openN = openCountForFoster(row)
                      return (
                        <div key={row.id}>
                          <button
                            type="button"
                            className={`${styles.rowBtn} ${styles.indent1} ${
                              effectiveSelection?.fosterId === row.id && effectiveSelection.kind === 'foster'
                                ? styles.rowBtnSelected
                                : ''
                            }`}
                            onClick={() => setSelection({ kind: 'foster', fosterId: row.id })}
                          >
                            <span
                              role="presentation"
                              className={styles.chevron}
                              onClick={e => {
                                e.stopPropagation()
                                toggleFoster(row.id)
                              }}
                            >
                              {fOpen ? '▼' : '▶'}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>{row.fosterDisplayName}</span>
                            {openN > 0 ? (
                              <span className={`${styles.badge} ${styles.badgeWarn}`}>{openN} open</span>
                            ) : (
                              <span className={styles.badge}>All clear</span>
                            )}
                          </button>

                          {fOpen &&
                            row.dogs.map(dog => {
                              const dk = `${row.id}::${dog.id}`
                              const dOpen = effectiveExpandedDogs.has(dk)
                              const isDogSel =
                                effectiveSelection?.kind === 'dog' &&
                                effectiveSelection.fosterId === row.id &&
                                effectiveSelection.dogId === dog.id
                              return (
                                <div key={dog.id}>
                                  <button
                                    type="button"
                                    className={`${styles.rowBtn} ${styles.indent2} ${
                                      isDogSel ? styles.rowBtnSelected : ''
                                    }`}
                                    onClick={() =>
                                      setSelection({ kind: 'dog', fosterId: row.id, dogId: dog.id })
                                    }
                                  >
                                    <span
                                      role="presentation"
                                      className={styles.chevron}
                                      onClick={e => {
                                        e.stopPropagation()
                                        toggleDog(row.id, dog.id)
                                      }}
                                    >
                                      {dOpen ? '▼' : '▶'}
                                    </span>
                                    <span style={{ flex: 1, minWidth: 0 }}>{dog.name}</span>
                                  </button>

                                  {dOpen &&
                                    dog.actions
                                      .filter(a => a.status !== 'done')
                                      .map(act => (
                                      <div key={act.id} className={`${styles.actionLeaf} ${styles.indent3}`}>
                                        <span
                                          className={`${styles.statusDot} ${
                                            act.status === 'overdue' ? styles.statusOverdue : styles.statusNeeded
                                          }`}
                                        />
                                        <span>{act.title}</span>
                                      </div>
                                      ))}
                                </div>
                              )
                            })}
                        </div>
                      )
                    })}

                  {rootOpen && rows.length === 0 && !error && (
                    <div className={`${styles.actionLeaf} ${styles.indent1}`} style={{ color: '#888' }}>
                      No active fosters in the sheet.
                    </div>
                  )}
                </div>
              </aside>

              <div
                className={styles.resizeHandle}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  dragStartXRef.current = e.clientX
                  startWidthRef.current = sidebarWidth
                  setIsResizing(true)
                }}
              />

              <main className={styles.detailPane}>
                <p className={styles.detailHint}>
                  Select a foster (or dog) on the left to see outstanding action items.
                </p>

                {!effectiveSelection && (
                  <p className={styles.detailEmpty}>
                    Select a foster or dog in the tree to see action items. Expand folders with the arrows
                    (similar to OneNote).
                  </p>
                )}

                {effectiveSelection?.kind === 'foster' && selectedRow && (
                  <>
                    <h2 className={styles.detailTitle}>{selectedRow.fosterDisplayName}</h2>
                    <p className={styles.detailSubtitle}>
                      {selectedRow.email || 'No email'} · {selectedRow.dogs.length} dog
                      {selectedRow.dogs.length === 1 ? '' : 's'} listed
                    </p>
                    {selectedRow.dogs.map(dog => (
                      <div key={dog.id} className={styles.card}>
                        <div className={styles.cardTitle}>{dog.name}</div>
                        {dog.actions.map(act => (
                          <div key={act.id} className={styles.actionRow}>
                            <span className={`${styles.pill} ${statusPill(act.status)}`}>
                              {statusLabel(act.status)}
                            </span>
                            <div>
                              <div>{act.title}</div>
                              {act.detail && (
                                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                  {act.detail}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}

                {effectiveSelection?.kind === 'dog' && selectedRow && selectedDog && (
                  <>
                    <h2 className={styles.detailTitle}>{selectedDog.name}</h2>
                    <p className={styles.detailSubtitle}>
                      Foster: {selectedRow.fosterDisplayName}
                      {selectedRow.email ? ` · ${selectedRow.email}` : ''}
                    </p>
                    <div className={styles.card}>
                      <div className={styles.cardTitle}>Action Items</div>
                      {selectedDog.actions.map(act => (
                        <div key={act.id} className={styles.actionRow}>
                          <span className={`${styles.pill} ${statusPill(act.status)}`}>
                            {statusLabel(act.status)}
                          </span>
                          <div>
                            <div>{act.title}</div>
                            {act.detail && (
                              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                {act.detail}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </main>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

function buildMockRows(): FosterOverviewRow[] {
  const mk = (id: string, foster: string, email: string, dog: string, overdue = false): FosterOverviewRow => ({
    id,
    fosterDisplayName: foster,
    email,
    person: { email, firstName: foster.split(' ')[0], lastName: foster.split(' ')[1] || '', status: 'current' } as any,
    dogs: [
      {
        id: `${id}-dog-0`,
        name: dog,
        actions: [
          {
            id: `${id}-photos`,
            title: 'Upload foster photos',
            status: overdue ? 'overdue' : 'needed',
            detail: overdue ? 'Photo update is past due' : 'Needs photo upload',
          },
          { id: `${id}-weekly`, title: 'Weekly check-in', status: 'needed' },
          { id: `${id}-vet`, title: 'Submit vet records', status: 'needed' },
          { id: `${id}-orientation`, title: 'Orientation / paperwork', status: 'done' },
        ],
      },
    ],
  })

  return [
    mk('mock-brenda', 'Brenda S.', 'brenda@example.com', 'Spot', true),
    mk('mock-marcus', 'Marcus T.', 'marcus@example.com', 'Bella'),
    mk('mock-olivia', 'Olivia Q.', 'olivia@example.com', 'Fido'),
    mk('mock-sarah', 'Sarah K.', 'sarah@example.com', 'Luna'),
  ]
}
