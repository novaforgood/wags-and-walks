'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import FostersSubTabs from './FostersSubTabs'
import { buildFosterDirectory, formatDateShort, type DogRecord, type FosterStatus } from '@/app/lib/fosterDirectory'
import styles from '../candidates/candidates.module.css'

type DogsApiResponse = {
  success?: boolean
  dogs?: DogRecord[]
  error?: string
}

type TasksApiResponse = {
  success?: boolean
  taskStatusByAnimalId?: Record<string, 'Good' | 'Needs Review' | 'Overdue'>
}

function PageButton({ onClick, disabled, active, children }: {
  onClick: () => void, disabled?: boolean, active?: boolean, children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: '32px', height: '32px', borderRadius: '6px', border: 'none',
        background: active ? '#e8fbfe' : hovered && !disabled ? '#f0f0f0' : 'none',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '14px', padding: '0 8px',
        color: active ? '#05aaaf' : disabled ? '#ccc' : hovered ? '#333' : '#555',
        fontWeight: active ? '600' : '400',
        transition: 'background 0.15s, color 0.15s'
      }}
    >
      {children}
    </button>
  )
}

export default function FostersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | FosterStatus>('all')
  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [dogsError, setDogsError] = useState<string | null>(null)
  const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<Record<string, import('@/app/lib/fosterDirectory').FosterStatus>>({})

  const directoryRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const rows = buildFosterDirectory(dogs, taskStatusByAnimalId)
    return rows.filter(r => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      if (!matchesStatus) return false
      if (!q) return true
      return (
        r.fosterName.toLowerCase().includes(q) ||
        r.dogs.some(d => d.name.toLowerCase().includes(q)) ||
        r.status.toLowerCase().includes(q)
      )
    })
  }, [dogs, taskStatusByAnimalId, searchQuery, statusFilter])

  const tableWrapperRef = useRef<HTMLDivElement>(null)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return directoryRows.slice(start, start + itemsPerPage)
  }, [directoryRows, currentPage, itemsPerPage])

  const totalPages = Math.ceil(directoryRows.length / itemsPerPage)

  useEffect(() => {
    let active = true
    async function loadData() {
      setIsLoadingDogs(true)
      setDogsError(null)
      try {
        const [dogsRes, tasksRes] = await Promise.all([
          fetch('/api/dogs', { cache: 'no-store' }),
          fetch('/api/tasks', { cache: 'no-store' }).catch(() => null),
        ])
        const dogsData = (await dogsRes.json()) as DogsApiResponse
        if (!dogsRes.ok || !dogsData?.success || !Array.isArray(dogsData.dogs)) {
          throw new Error(dogsData?.error || 'Failed to load current directory from Shelter Manager')
        }
        if (!active) return
        setDogs(dogsData.dogs)
        if (tasksRes) {
          try {
            const tasksData = (await tasksRes.json()) as TasksApiResponse
            if (tasksData?.taskStatusByAnimalId) {
              setTaskStatusByAnimalId(tasksData.taskStatusByAnimalId)
            }
          } catch { /* tasks not available yet */ }
        }
      } catch (error) {
        if (!active) return
        setDogsError(error instanceof Error ? error.message : 'Failed to load current directory from Shelter Manager')
      } finally {
        if (active) setIsLoadingDogs(false)
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  useEffect(() => {
    const el = tableWrapperRef.current
    if (!el) return
    function calc() {
      const firstRow = el!.querySelector('tbody tr') as HTMLElement | null
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : 40
      const thead = el!.querySelector('thead') as HTMLElement | null
      const theadH = thead ? thead.getBoundingClientRect().height : 50
      // subtract: thead + pagination (~56px) + wrapper bottom padding (16px)
      const available = el!.clientHeight - theadH - 72
      setItemsPerPage(Math.max(5, Math.floor(available / rowH)))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])


  return (
    <ProtectedRoute>
      <DashboardShell>
          <div className={styles.topBar}>
            <h1 className={styles.topBarTitle}>Onboarded Fosters</h1>
            <div className={styles.topBarActions}>
              <NotificationPanel />
              <TopBarProfileMenu />
            </div>
          </div>

          <FostersSubTabs active="directory" />

          <div className={styles.toolbar}>
            <div className={styles.searchWrapper}>
              <input
                type="text"
                placeholder="Search foster, dog, or status"
                className={styles.searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className={styles.searchIconWrap}>
                <img src="/assets/Search.svg" alt="Search" width={16} height={16} />
              </div>
            </div>
            <div className={styles.toolbarRight}>
              <select
                className={`${styles.toolbarBtn} ${styles.statusFilterSelect}`}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as 'all' | FosterStatus)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="Good">Good</option>
                <option value="Needs Review">Needs Review</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          {isLoadingDogs && (
            <div className={styles.loadingContainer}>Loading current directory...</div>
          )}
          {dogsError && <div className={styles.errorText}>{dogsError}</div>}

          {!isLoadingDogs && (
            <div className={styles.tableWrapper} ref={tableWrapperRef}>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Foster Name</th>
                      <th>Dog(s) Fostering</th>
                      <th>Last update</th>
                      <th>Current Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map(row => (
                      <tr key={row.id}>
                        <td>
                          <Link href={`/fosters/${row.id}`} className={styles.nameLink}>
                            {row.fosterName}
                          </Link>
                        </td>
                        <td>{row.dogs.map(d => d.name).join(', ')}</td>
                        <td>{formatDateShort(row.lastUpdate)}</td>
                        <td>{row.status}</td>
                        <td>
                          <Link
                            href={`/fosters/${row.id}`}
                            className={styles.infoIconBtn}
                            aria-label={`View details for ${row.fosterName}`}
                            title={`View details for ${row.fosterName}`}
                          >
                            i
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {paginatedRows.length === 0 && !dogsError && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                          No directory rows found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', padding: '12px 16px' }}>
                    <PageButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      ‹ Previous
                    </PageButton>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                      .reduce<(number | '...')[]>((acc, page, idx, arr) => {
                        if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('...')
                        acc.push(page)
                        return acc
                      }, [])
                      .map((item, idx) =>
                        item === '...' ? (
                          <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#888', fontSize: '14px' }}>···</span>
                        ) : (
                          <PageButton key={item} onClick={() => setCurrentPage(item as number)} active={currentPage === item}>
                            {item}
                          </PageButton>
                        )
                      )}

                    <PageButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      Next ›
                    </PageButton>
                  </div>
                )}
              </div>
            </div>
          )}
      </DashboardShell>
    </ProtectedRoute>
  )
}

