'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import { formatDateShort, type DogRecord, type FosterStatus } from '@/app/lib/fosterDirectory'
import type { TaskRow } from '@/app/api/tasks/route'
import {
  compareNeedsAttentionPriority,
  enrichFosterDirectoryWithLanes,
  laneLabel,
  matchesTaskInboxFilter,
  type TaskInboxFilter,
} from '@/app/lib/fosterTaskEnrichment'
import styles from '../candidates/candidates.module.css'
import inboxStyles from './fosterTasks.module.css'

type DogsApiResponse = {
  success?: boolean
  dogs?: DogRecord[]
  error?: string
}

type TasksApiResponse = {
  success?: boolean
  rows?: TaskRow[]
  taskStatusByAnimalId?: Record<string, FosterStatus>
}

/** Combined queue filters; default opens on needs-attention (priority sort applies). */
const QUEUE_FILTERS: { value: TaskInboxFilter; label: string }[] = [
  { value: 'all', label: 'All (work queue)' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'rollup_overdue', label: 'Household: overdue' },
  { value: 'rollup_good', label: 'Household: good' },
  { value: 'rollup_unknown', label: 'Household: unknown' },
  { value: 'photo_overdue', label: 'Photos: overdue' },
  { value: 'survey_overdue', label: 'Survey: overdue' },
  { value: 'photo_on_track', label: 'Photos: on track' },
  { value: 'survey_on_track', label: 'Survey: on track' },
  { value: 'photo_missing_log', label: 'Photos: missing row' },
  { value: 'survey_missing_log', label: 'Survey: missing row' },
]

function PageButton({
  onClick,
  disabled,
  active,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: '32px',
        height: '32px',
        borderRadius: '6px',
        border: 'none',
        background: active ? '#e8fbfe' : hovered && !disabled ? '#f0f0f0' : 'none',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '14px',
        padding: '0 8px',
        color: active ? '#05aaaf' : disabled ? '#ccc' : hovered ? '#333' : '#555',
        fontWeight: active ? '600' : '400',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

export default function FostersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | FosterStatus>('all')
  const [queueFilter, setQueueFilter] = useState<TaskInboxFilter>('needs_attention')
  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [dogsError, setDogsError] = useState<string | null>(null)
  const [taskRows, setTaskRows] = useState<TaskRow[]>([])
  const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<
    Record<string, FosterStatus>
  >({})

  const enrichedRows = useMemo(
    () => enrichFosterDirectoryWithLanes(dogs, taskRows, taskStatusByAnimalId),
    [dogs, taskRows, taskStatusByAnimalId]
  )

  const directoryRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const rows = enrichedRows.filter(r => {
      if (!matchesTaskInboxFilter(r, queueFilter)) return false
      if (statusFilter !== 'all' && r.householdRollup !== statusFilter) return false
      if (!q) return true
      const email = (r.fosterEmail ?? '').toLowerCase()
      return (
        r.fosterName.toLowerCase().includes(q) ||
        email.includes(q) ||
        r.dogs.some(d => d.name.toLowerCase().includes(q)) ||
        r.householdRollup.toLowerCase().includes(q) ||
        laneLabel(r.photoWorst).toLowerCase().includes(q) ||
        laneLabel(r.surveyWorst).toLowerCase().includes(q)
      )
    })
    if (queueFilter === 'needs_attention') {
      rows.sort(compareNeedsAttentionPriority)
    }
    return rows
  }, [enrichedRows, searchQuery, statusFilter, queueFilter])

  const tableWrapperRef = useRef<HTMLDivElement>(null)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return directoryRows.slice(start, start + itemsPerPage)
  }, [directoryRows, currentPage, itemsPerPage])

  const totalPages = Math.ceil(directoryRows.length / Math.max(itemsPerPage, 1))

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
            setTaskRows(Array.isArray(tasksData?.rows) ? tasksData.rows : [])
          } catch {
            /* tasks not available yet */
          }
        } else {
          setTaskRows([])
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
  }, [searchQuery, statusFilter, queueFilter])

  useEffect(() => {
    const el = tableWrapperRef.current
    if (!el) return
    function calc() {
      const firstRow = el!.querySelector('tbody tr') as HTMLElement | null
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : 40
      const thead = el!.querySelector('thead') as HTMLElement | null
      const theadH = thead ? thead.getBoundingClientRect().height : 50
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

        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Search foster, dog, email, task lanes…"
              className={styles.searchInput}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search foster directory"
            />
            <div className={styles.searchIconWrap}>
              <img src="/assets/Search.svg" alt="" width={16} height={16} />
            </div>
          </div>
          <div className={styles.toolbarRight}>
            <label htmlFor="dir-queue-filter" className={inboxStyles.visuallyHidden}>
              Queue
            </label>
            <select
              id="dir-queue-filter"
              className={`${styles.toolbarBtn} ${styles.statusFilterSelect} ${inboxStyles.fostersToolbarSelect}`}
              value={queueFilter}
              onChange={e => setQueueFilter(e.target.value as TaskInboxFilter)}
              title="Filter by Task Log lanes (photos / survey)"
            >
              {QUEUE_FILTERS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label htmlFor="dir-household-status-filter" className={inboxStyles.visuallyHidden}>
              Household status
            </label>
            <select
              id="dir-household-status-filter"
              className={`${styles.toolbarBtn} ${styles.statusFilterSelect} ${inboxStyles.fostersToolbarSelect}`}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | FosterStatus)}
              title="Overall Task Log status for the home—the worst status among dogs there"
            >
              <option value="all">Any status</option>
              <option value="Good">Good</option>
              <option value="Overdue">Overdue</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
        </div>

        {isLoadingDogs && (
          <div className={styles.loadingContainer}>Loading current directory...</div>
        )}
        {dogsError && <div className={styles.errorText}>{dogsError}</div>}

        {!isLoadingDogs && !dogsError && (
          <div className={styles.tableWrapper} ref={tableWrapperRef}>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Foster name</th>
                    <th>Dog(s)</th>
                    <th title="Latest movement date from Shelter Manager (not Task Log deadlines)">Movement</th>
                    <th title="Overall Task Log status for this home (worst dog wins)">Household status</th>
                    <th>Photos (log)</th>
                    <th>Survey (log)</th>
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
                      <td>{row.householdRollup}</td>
                      <td>
                        <div className={inboxStyles.laneCell}>
                          <span>{laneLabel(row.photoWorst)}</span>
                        </div>
                      </td>
                      <td>
                        <div className={inboxStyles.laneCell}>
                          <span>{laneLabel(row.surveyWorst)}</span>
                        </div>
                      </td>
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
                  {paginatedRows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                        No directory rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '12px 16px',
                  }}
                >
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
                        <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#888', fontSize: '14px' }}>
                          ···
                        </span>
                      ) : (
                        <PageButton
                          key={item}
                          onClick={() => setCurrentPage(item as number)}
                          active={currentPage === item}
                        >
                          {item}
                        </PageButton>
                      )
                    )}

                  <PageButton
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
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
