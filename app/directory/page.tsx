'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import PersonModal from '@/app/components/PersonModal'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
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
  { id: 'starred', label: 'Starred', title: 'Admin-marked members' },
  { id: 'flagged', label: 'Flagged', title: 'Members with a flag on their application' },
  { id: 'current_foster', label: 'Fostering now', title: 'Currently has a foster dog in Shelter Manager' },
  { id: 'available', label: 'Available', title: 'Has Shelter Manager history but is not currently fostering' },
]

export default function DirectoryPage() {
  const { people, isLoading: peopleLoading, error: peopleError, toggleStar } = usePeople()
  const [searchQuery, setSearchQuery] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('az')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
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
      const firstRow = wrapper.querySelector('tbody tr') as HTMLElement | null
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

  const isLoading =
    isLoadingGroup || isLoadingFosterers || (peopleLoading && people.length === 0 && !groupError)
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
                  onChange={e => setSortOrder(e.target.value as SortOrder)}
                  aria-label="Sort directory"
                >
                  <option value="az">A – Z</option>
                  <option value="most_fostered">Most fostered</option>
                </select>
              </label>
            </div>
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
                  <tr>
                    <td colSpan={6} className={dirStyles.tableStateWarn} role="alert">
                      {error}
                    </td>
                  </tr>
                )}
                {isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={dirStyles.tableStateLoading}>
                      Loading directory…
                    </td>
                  </tr>
                ) : error && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={dirStyles.tableStateError} role="alert">
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={dirStyles.emptyRow}>
                      No Google Group members returned for this directory.
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedRows.map((r, index) => {
                      const key = r.asmProfile?.fostererId || r.email || `${r.displayName}-${index}`
                      const personForModal = buildPersonForModal(r)
                      return (
                        <tr key={key} className={r.flagged ? dirStyles.rowFlagged : undefined}>
                          <td
                            className={styles.nameCell}
                            onClick={() => setSelectedPerson(personForModal)}
                          >
                            {r.displayName}
                          </td>
                          <td>{r.email || '—'}</td>
                          <td className={`${dirStyles.hideOnMobile} ${dirStyles.phoneCell}`}>
                            {r.phone || '—'}
                          </td>
                          <td>{r.hasASMProfile ? (r.currentlyFostering ? 'Yes' : 'No') : '—'}</td>
                          <td className={dirStyles.hideOnTablet}>
                            {r.hasASMProfile ? r.totalFostered : '—'}
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              {r.hasApplication ? (
                                <button
                                  className={`${styles.actionIconBtn} ${r.starred ? styles.actionIconStarActive : styles.actionIconStar} ${dirStyles.starSlot}`}
                                  onClick={e => {
                                    e.stopPropagation()
                                    toggleStar(r.application!.email || '')
                                  }}
                                  title={r.starred ? 'Unstar' : 'Star'}
                                  aria-label={r.starred ? `Unstar ${r.displayName}` : `Star ${r.displayName}`}
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
                                  title="No application on file — star unavailable"
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
                                  setSelectedPerson(personForModal)
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
                      <tr>
                        <td colSpan={6} className={dirStyles.emptyRow}>
                          No fosterers match your filters.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>

            {totalPages > 1 && rows.length > 0 && (
              <div className={dirStyles.paginationBar}>
                <button
                  className={dirStyles.pageBtn}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  ‹ Previous
                </button>

                {pageList.map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className={dirStyles.pageEllipsis}>···</span>
                  ) : (
                    <button
                      key={item}
                      className={`${dirStyles.pageBtn} ${currentPage === item ? dirStyles.pageBtnActive : ''}`}
                      onClick={() => setCurrentPage(item)}
                      aria-current={currentPage === item ? 'page' : undefined}
                      aria-label={`Go to page ${item}`}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  className={dirStyles.pageBtn}
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
        <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      </DashboardShell>
    </ProtectedRoute>
  )
}
