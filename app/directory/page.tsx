'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import PersonModal from '@/app/components/PersonModal'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import { prefetchFosterNotes } from '@/app/lib/fosterNotesClientCache'
import type { Person } from '@/app/lib/peopleTypes'
import type { FostererHistory } from '@/app/lib/asmFosterHistory'
import {
  buildApplicationsByEmail,
  buildAsmPeopleByEmail,
  buildDirectoryProfiles,
  buildPersonForModal,
  compareDirectoryDisplayNames,
  directoryDogNames,
  directoryPersonIsFlagged,
  directoryPhone,
  type DirectoryProfile,
  type GroupMember,
} from '@/app/lib/directoryPeople'
import styles from '../candidates/candidates.module.css'
import dirStyles from './directory.module.css'

type FostererApiResponse = {
  success?: boolean
  fosterers?: FostererHistory[]
  error?: string
}

type GroupApiResponse = {
  success?: boolean
  members?: GroupMember[]
  error?: string
}

type QuickFilter = 'all' | 'starred' | 'flagged' | 'current_foster' | 'available'
type SortOrder = 'az' | 'most_fostered'

type DirectoryRow = DirectoryProfile & {
  displayName: string
  phone: string
  currentlyFostering: boolean
  totalFostered: number
  starred: boolean
  flagged: boolean
}

function buildPageList(totalPages: number, currentPage: number): (number | 'ellipsis')[] {
  return Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
      if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
      acc.push(page)
      return acc
    }, [])
}

const QUICK_FILTERS: { id: QuickFilter; label: string; title: string }[] = [
  { id: 'all', label: 'All', title: 'Show all directory members' },
  { id: 'starred', label: 'Donor', title: 'Members marked as donors' },
  { id: 'flagged', label: 'Flagged', title: 'Members with a flag on their application' },
  { id: 'current_foster', label: 'Fostering now', title: 'Currently has a foster dog in Shelter Manager' },
  { id: 'available', label: 'Available', title: 'Has Shelter Manager history but is not currently fostering' },
]

function DirectorySkeletonRows() {
  return (
    <>
      <tr data-directory-metrics-skip="">
        <td colSpan={6} className={dirStyles.srOnly} role="status" aria-live="polite">
          Loading directory
        </td>
      </tr>
      {Array.from({ length: 10 }).map((_, index) => (
        <tr key={index} className={dirStyles.skeletonRow} aria-hidden="true">
          <td>
            <span className={`${dirStyles.skeletonLine} ${dirStyles.skeletonName}`} />
          </td>
          <td>
            <span className={`${dirStyles.skeletonLine} ${dirStyles.skeletonEmail}`} />
          </td>
          <td className={dirStyles.hideOnMobile}>
            <span className={`${dirStyles.skeletonLine} ${dirStyles.skeletonPhone}`} />
          </td>
          <td>
            <span className={`${dirStyles.skeletonLine} ${dirStyles.skeletonShort}`} />
          </td>
          <td className={dirStyles.hideOnTablet}>
            <span className={`${dirStyles.skeletonLine} ${dirStyles.skeletonTiny}`} />
          </td>
          <td>
            <span className={dirStyles.skeletonActions}>
              <span className={dirStyles.skeletonStar} />
              <span className={dirStyles.skeletonButton} />
            </span>
          </td>
        </tr>
      ))}
    </>
  )
}

function InlineSkeleton({ className = dirStyles.skeletonShort }: { className?: string }) {
  return <span className={`${dirStyles.skeletonLine} ${dirStyles.inlineSkeleton} ${className}`} aria-hidden="true" />
}

export default function DirectoryPage() {
  const { people, isLoading: peopleLoading, error: peopleError, toggleStar } = usePeople()
  const [searchQuery, setSearchQuery] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('az')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [selectedFosterHistory, setSelectedFosterHistory] = useState<FostererHistory | null>(null)
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [isLoadingGroup, setIsLoadingGroup] = useState(true)
  const [groupError, setGroupError] = useState<string | null>(null)
  const [fosterers, setFosterers] = useState<FostererHistory[]>([])
  const [isLoadingFosterers, setIsLoadingFosterers] = useState(true)
  const [fostererError, setFostererError] = useState<string | null>(null)

  const tableWrapperRef = useRef<HTMLDivElement>(null)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let active = true
    async function loadGroup() {
      setIsLoadingGroup(true)
      setGroupError(null)
      try {
        const res = await fetch('/api/google-group-members', { cache: 'no-store' })
        const data = (await res.json()) as GroupApiResponse
        if (!res.ok || !data?.success || !Array.isArray(data.members)) {
          throw new Error(data?.error || 'Failed to load Google Group members')
        }
        if (!active) return
        setGroupMembers(data.members)
      } catch (e) {
        if (!active) return
        setGroupError(e instanceof Error ? e.message : 'Failed to load Google Group members')
        setGroupMembers([])
      } finally {
        if (active) setIsLoadingGroup(false)
      }
    }
    loadGroup()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setIsLoadingFosterers(true)
      setFostererError(null)
      try {
        const res = await fetch('/api/foster-history', { cache: 'no-store' })
        const data = (await res.json()) as FostererApiResponse
        if (!res.ok || !data?.success || !Array.isArray(data.fosterers)) {
          throw new Error(data?.error || 'Failed to load fosterers from Shelter Manager')
        }
        if (!active) return
        setFosterers(data.fosterers)
      } catch (e) {
        if (!active) return
        setFostererError(e instanceof Error ? e.message : 'Failed to load fosterers')
      } finally {
        if (active) setIsLoadingFosterers(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const asmByEmail = useMemo(() => buildAsmPeopleByEmail(fosterers), [fosterers])
  const applicationsByEmail = useMemo(() => buildApplicationsByEmail(people), [people])

  const directoryProfiles = useMemo(
    () => buildDirectoryProfiles(groupMembers, applicationsByEmail, asmByEmail),
    [groupMembers, applicationsByEmail, asmByEmail]
  )

  const rows = useMemo<DirectoryRow[]>(() => {
    return directoryProfiles.map(p => {
      const asm = p.asmProfile
      const currentlyFostering = (asm?.currentFosters.length ?? 0) > 0
      const totalFostered = (asm?.currentFosters.length ?? 0) + (asm?.pastFosters.length ?? 0)
      return {
        ...p,
        displayName: p.name,
        phone: directoryPhone(p),
        currentlyFostering,
        totalFostered,
        starred: !!p.application?.starred,
        flagged: p.application ? directoryPersonIsFlagged(p.application) : false,
      }
    })
  }, [directoryProfiles])

  const filtered = useMemo(() => {
    let result = rows

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r => {
        const dogs = directoryDogNames(r)
        return (
          r.displayName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          dogs.includes(q)
        )
      })
    }

    switch (quickFilter) {
      case 'starred':
        result = result.filter(r => r.starred)
        break
      case 'flagged':
        result = result.filter(r => r.flagged)
        break
      case 'current_foster':
        result = result.filter(r => r.currentlyFostering)
        break
      case 'available':
        result = result.filter(r => r.hasASMProfile && !r.currentlyFostering)
        break
      default:
        break
    }

    if (sortOrder === 'most_fostered') {
      return [...result].sort((a, b) => {
        if (b.totalFostered !== a.totalFostered) return b.totalFostered - a.totalFostered
        return compareDirectoryDisplayNames(a.displayName, b.displayName)
      })
    }

    return [...result].sort((a, b) => compareDirectoryDisplayNames(a.displayName, b.displayName))
  }, [rows, searchQuery, quickFilter, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(itemsPerPage, 1)))

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, quickFilter, sortOrder, groupMembers])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  useEffect(() => {
    const el = tableWrapperRef.current
    if (!el) return
    function calc() {
      const wrapper = el!
      const firstRow = wrapper.querySelector(
        'tbody tr:not([data-directory-metrics-skip])'
      ) as HTMLElement | null
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : 40
      const thead = wrapper.querySelector('thead') as HTMLElement | null
      const theadH = thead ? thead.getBoundingClientRect().height : 50
      const available = wrapper.clientHeight - theadH - 72
      const next = Math.max(20, Math.floor(available / Math.max(rowH, 1)))
      setItemsPerPage(prev => (prev === next ? prev : next))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (paginatedRows.length === 0) return
    const id = window.setTimeout(() => {
      for (const row of paginatedRows.slice(0, 12)) {
        void prefetchFosterNotes(row.email)
      }
    }, 250)
    return () => window.clearTimeout(id)
  }, [paginatedRows])

  const peoplePending = peopleLoading && people.length === 0 && !peopleError
  const fosterersPending = isLoadingFosterers && fosterers.length === 0 && !fostererError
  const initialDirectoryLoading = isLoadingGroup && rows.length === 0
  const error = groupError ?? fostererError ?? peopleError
  const pageList = totalPages > 1 ? buildPageList(totalPages, currentPage) : []

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

        <div className={`${styles.toolbar} ${dirStyles.directoryToolbar}`}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Search by name, email, phone, or dog name"
              className={styles.searchInput}
              value={searchQuery}
              disabled={initialDirectoryLoading}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div className={styles.searchIconWrap}>
              <img src="/assets/Search.svg" alt="Search" width={16} height={16} />
            </div>
          </div>
        </div>

        <div className={styles.tableWrapper} ref={tableWrapperRef}>
          <div className={`${styles.tableContainer} ${dirStyles.directoryTableContainer}`}>
            <div className={dirStyles.directoryFilterBar}>
              <div className={dirStyles.chipGroup} role="group" aria-label="Filter directory">
                {QUICK_FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`${dirStyles.chip} ${quickFilter === f.id ? dirStyles.chipActive : ''}`}
                    onClick={() => setQuickFilter(f.id)}
                    disabled={
                      initialDirectoryLoading ||
                      ((f.id === 'starred' || f.id === 'flagged') && peoplePending) ||
                      ((f.id === 'current_foster' || f.id === 'available') && fosterersPending)
                    }
                    title={f.title}
                    aria-pressed={quickFilter === f.id}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <label className={dirStyles.sortWrap}>
                <span className={dirStyles.sortLabel}>Sort</span>
                <select
                  className={dirStyles.sortSelect}
                  value={sortOrder}
                  disabled={initialDirectoryLoading}
                  onChange={e => setSortOrder(e.target.value as SortOrder)}
                  aria-label="Sort directory"
                >
                  <option value="az">A – Z</option>
                  <option value="most_fostered" disabled={fosterersPending}>Most fostered</option>
                </select>
              </label>
            </div>
            <div className={styles.tableScroll}>
            <table className={`${styles.table} ${dirStyles.directoryTable}`}>
              <colgroup>
                <col className={dirStyles.colName} />
                <col className={dirStyles.colEmail} />
                <col className={dirStyles.colPhone} />
                <col className={dirStyles.colCurrent} />
                <col className={dirStyles.colTotal} />
                <col className={dirStyles.colActions} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col" className={dirStyles.hideOnMobile}>Phone</th>
                  <th scope="col" title="Whether they have an active foster placement in Shelter Manager">
                    Fostering
                  </th>
                  <th
                    scope="col"
                    className={dirStyles.hideOnTablet}
                    title="Number of dogs in Shelter Manager foster history (past + current)"
                  >
                    Dogs
                  </th>
                  <th scope="col" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {error && rows.length > 0 && (
                  <tr data-directory-metrics-skip="">
                    <td colSpan={6} className={dirStyles.tableStateWarn} role="alert">
                      {error}
                    </td>
                  </tr>
                )}
                {initialDirectoryLoading ? (
                  <DirectorySkeletonRows />
                ) : error && rows.length === 0 ? (
                  <tr data-directory-metrics-skip="">
                    <td colSpan={6} className={dirStyles.tableStateError} role="alert">
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr data-directory-metrics-skip="">
                    <td colSpan={6} className={styles.emptyState}>
                      No Google Group members returned for this directory.
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedRows.map((r, index) => {
                      const key = r.asmProfile?.fostererId || r.email || `${r.displayName}-${index}`
                      const personForModal = buildPersonForModal(r)
                      const openPerson = () => {
                        setSelectedPerson(personForModal)
                        setSelectedFosterHistory(r.asmProfile)
                      }
                      return (
                        <tr
                          key={key}
                          className={[r.flagged ? dirStyles.rowFlagged : '', styles.tableRowClickable, dirStyles.fadeIn]
                            .filter(Boolean)
                            .join(' ')}
                          tabIndex={0}
                          aria-label={`Open directory entry for ${r.displayName}`}
                          onClick={e => {
                            if ((e.target as HTMLElement).closest('button')) return
                            openPerson()
                          }}
                          onKeyDown={e => {
                            if (e.key !== 'Enter' && e.key !== ' ') return
                            if ((e.target as HTMLElement).closest('button')) return
                            e.preventDefault()
                            openPerson()
                          }}
                        >
                          <td className={styles.nameCell}>{r.displayName}</td>
                          <td>{r.email || '—'}</td>
                          <td className={`${dirStyles.hideOnMobile} ${dirStyles.phoneCell}`}>
                            {r.phone ? (
                              <span className={dirStyles.fadeIn}>{r.phone}</span>
                            ) : peoplePending || fosterersPending ? (
                              <InlineSkeleton className={dirStyles.skeletonPhone} />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {fosterersPending ? (
                              <InlineSkeleton />
                            ) : r.hasASMProfile ? (
                              <span className={dirStyles.fadeIn}>{r.currentlyFostering ? 'Yes' : 'No'}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className={dirStyles.hideOnTablet}>
                            {fosterersPending ? (
                              <InlineSkeleton className={dirStyles.skeletonTiny} />
                            ) : r.hasASMProfile ? (
                              <span className={dirStyles.fadeIn}>{r.totalFostered}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              {peoplePending ? (
                                <span className={`${dirStyles.skeletonStar} ${dirStyles.starSlot}`} aria-hidden="true" />
                              ) : r.hasApplication ? (
                                <button
                                  className={`${styles.actionIconBtn} ${r.starred ? styles.actionIconStarActive : styles.actionIconStar} ${dirStyles.starSlot}`}
                                  onClick={e => {
                                    e.stopPropagation()
                                    toggleStar(r.application!.email || '')
                                  }}
                                  title={r.starred ? 'Unmark donor' : 'Mark as donor'}
                                  aria-label={r.starred ? `Unmark ${r.displayName} as donor` : `Mark ${r.displayName} as donor`}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIconSvg}>
                                    <path
                                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                      fill={r.starred ? 'currentColor' : 'none'}
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              ) : (
                                <span
                                  className={`${styles.actionIconBtn} ${styles.actionIconStar} ${dirStyles.starSlot} ${dirStyles.starDisabledWrap}`}
                                  title="No application on file — donor flag unavailable"
                                  aria-hidden="true"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIconSvg}>
                                    <path
                                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </span>
                              )}
                              <button
                                className={`${styles.selectBtn} ${dirStyles.selectBtnCompact}`}
                                onClick={e => {
                                  e.stopPropagation()
                                  openPerson()
                                }}
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {rows.length > 0 && filtered.length === 0 && (
                      <tr data-directory-metrics-skip="">
                        <td colSpan={6} className={styles.emptyState}>
                          No fosterers match your filters.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
            </div>

            {totalPages > 1 && rows.length > 0 && (
              <div className={styles.pagination}>
                <button
                  className={styles.paginationBtn}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  ‹ Previous
                </button>

                {pageList.map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className={styles.paginationEllipsis}>···</span>
                  ) : (
                    <button
                      key={item}
                      className={`${styles.paginationBtn} ${currentPage === item ? styles.paginationBtnActive : ''}`}
                      onClick={() => setCurrentPage(item)}
                      aria-current={currentPage === item ? 'page' : undefined}
                      aria-label={`Go to page ${item}`}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  className={styles.paginationBtn}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next ›
                </button>
              </div>
            )}
          </div>
        </div>
        <PersonModal
          person={selectedPerson}
          fosterHistory={selectedFosterHistory}
          onClose={() => {
            setSelectedPerson(null)
            setSelectedFosterHistory(null)
          }}
        />
      </DashboardShell>
    </ProtectedRoute>
  )
}
