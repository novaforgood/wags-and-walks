'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import { useAuth } from '@/app/components/AuthProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
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

  const rows = useMemo(() => buildFosterOverview(people), [people])
  const totalOpen = useMemo(() => countOpenActions(rows), [rows])

  const [rootOpen, setRootOpen] = useState(true)
  const [expandedFosters, setExpandedFosters] = useState<Set<string>>(new Set())
  const [expandedDogs, setExpandedDogs] = useState<Set<string>>(new Set())

  const [selection, setSelection] = useState<Selection | null>(null)

  useEffect(() => {
    if (rows.length === 0) return
    setExpandedFosters(prev => {
      if (prev.size > 0) return prev
      return new Set([rows[0].id])
    })
    setExpandedDogs(prev => {
      if (prev.size > 0) return prev
      const d0 = rows[0].dogs[0]
      if (!d0) return prev
      return new Set([`${rows[0].id}::${d0.id}`])
    })
    setSelection(sel => {
      if (sel) return sel
      const d0 = rows[0].dogs[0]
      if (d0) return { kind: 'dog', fosterId: rows[0].id, dogId: d0.id }
      return { kind: 'foster', fosterId: rows[0].id }
    })
  }, [rows])

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

  const selectedRow = selection
    ? rows.find(r => r.id === selection.fosterId)
    : undefined
  const selectedDog =
    selection?.kind === 'dog' && selectedRow
      ? selectedRow.dogs.find(d => d.id === selection.dogId)
      : undefined

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
            <h1 className={layoutStyles.topBarTitle}>Foster action items</h1>
          </div>

          <FostersSubTabs active="actions" />

          {isLoading && people.length === 0 && (
            <div className={layoutStyles.loadingContainer}>Loading…</div>
          )}
          {error && <div className={layoutStyles.errorText}>{error}</div>}

          {!isLoading && (
            <div className={styles.pageInner}>
              <aside className={styles.treePane} aria-label="Foster tree">
                <div className={styles.treeHeader}>Pipeline</div>
                <div className={styles.treeScroll}>
                  <button
                    type="button"
                    className={styles.treeRootBtn}
                    onClick={() => setRootOpen(o => !o)}
                  >
                    <span className={styles.chevron}>{rootOpen ? '▼' : '▶'}</span>
                    Active fosters
                    <span className={styles.badge}>{rows.length}</span>
                  </button>

                  {rootOpen &&
                    rows.map(row => {
                      const fOpen = expandedFosters.has(row.id)
                      const openN = openCountForFoster(row)
                      return (
                        <div key={row.id}>
                          <button
                            type="button"
                            className={`${styles.rowBtn} ${styles.indent1} ${
                              selection?.fosterId === row.id && selection.kind === 'foster'
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
                              <span className={`${styles.badge} ${styles.badgeWarn}`}>{openN}</span>
                            ) : (
                              <span className={styles.badge}>0</span>
                            )}
                          </button>

                          {fOpen &&
                            row.dogs.map(dog => {
                              const dk = `${row.id}::${dog.id}`
                              const dOpen = expandedDogs.has(dk)
                              const isDogSel =
                                selection?.kind === 'dog' &&
                                selection.fosterId === row.id &&
                                selection.dogId === dog.id
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
                                    dog.actions.map(act => (
                                      <div key={act.id} className={`${styles.actionLeaf} ${styles.indent3}`}>
                                        <span
                                          className={`${styles.statusDot} ${
                                            act.status === 'done'
                                              ? styles.statusDone
                                              : act.status === 'overdue'
                                                ? styles.statusOverdue
                                                : styles.statusNeeded
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

              <main className={styles.detailPane}>
                <div className={styles.summaryStrip}>
                  <div className={styles.summaryChip}>
                    Open tasks
                    <strong>{totalOpen}</strong>
                  </div>
                  <div className={styles.summaryChip}>
                    Active fosters
                    <strong>{rows.length}</strong>
                  </div>
                </div>

                {!selection && (
                  <p className={styles.detailEmpty}>
                    Select a foster or dog in the tree to see action items. Expand folders with the arrows
                    (similar to OneNote).
                  </p>
                )}

                {selection?.kind === 'foster' && selectedRow && (
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

                {selection?.kind === 'dog' && selectedRow && selectedDog && (
                  <>
                    <h2 className={styles.detailTitle}>{selectedDog.name}</h2>
                    <p className={styles.detailSubtitle}>
                      Foster: {selectedRow.fosterDisplayName}
                      {selectedRow.email ? ` · ${selectedRow.email}` : ''}
                    </p>
                    <div className={styles.card}>
                      <div className={styles.cardTitle}>Action items</div>
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
