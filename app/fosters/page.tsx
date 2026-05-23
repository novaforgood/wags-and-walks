'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import DashboardTopBar from '@/app/components/DashboardTopBar'
import { DashboardShell } from '@/app/components/DashboardShell'
import BulkEmailBar from '@/app/components/BulkEmailBar'
import { formatDateShort, type DogRecord, type FosterStatus } from '@/app/lib/fosterDirectory'
import { authFetch } from '@/app/lib/authFetch'
import type { TaskRow } from '@/app/api/tasks/route'
import {
  compareNeedsAttentionPriority,
  enrichFosterDirectoryWithLanes,
  householdRollupDisplay,
  laneLabel,
  matchesTaskInboxFilter,
  type TaskInboxFilter,
} from '@/app/lib/fosterTaskEnrichment'
import styles from '../candidates/candidates.module.css'
import inboxStyles from './fosterTasks.module.css'

type DogsApiResponse = {
  success?: boolean
  dogs?: DogRecord[]
  updatedAt?: string
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
  { value: 'rollup_good', label: 'Household: Good (rollup)' },
  { value: 'rollup_needs_review', label: 'Household: Needs Review (rollup)' },
  { value: 'rollup_unknown', label: 'Household: Unknown (rollup)' },
  { value: 'photo_overdue', label: 'Photos: overdue' },
  { value: 'survey_overdue', label: 'Survey: overdue' },
  { value: 'photo_on_track', label: 'Photos: Good' },
  { value: 'survey_on_track', label: 'Survey: Good' },
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${styles.paginationBtn} ${active ? styles.paginationBtnActive : ''}`}
    >
      {children}
    </button>
  )
}

function isInteractiveTableCellTarget(target: EventTarget | null): boolean {
  return !!(target as HTMLElement | null)?.closest?.('a, button, input, select, textarea, label')
}

function FosterTableSkeletonRows() {
  return (
    <>
      <tr data-fosters-metrics-skip="">
        <td colSpan={7} className={inboxStyles.visuallyHidden} role="status" aria-live="polite">
          Loading foster directory
        </td>
      </tr>
      {Array.from({ length: 8 }).map((_, index) => (
        <tr key={index} className={inboxStyles.skeletonRow} aria-hidden="true">
          <td className={inboxStyles.checkboxCol} />
          <td><span className={`${inboxStyles.skeletonLine} ${inboxStyles.skeletonName}`} /></td>
          <td><span className={`${inboxStyles.skeletonLine} ${inboxStyles.skeletonDogs}`} /></td>
          <td>
            <span className={inboxStyles.skeletonStack}>
              <span className={`${inboxStyles.skeletonLine} ${inboxStyles.skeletonLane}`} />
              <span className={`${inboxStyles.skeletonLine} ${inboxStyles.skeletonDate}`} />
            </span>
          </td>
          <td>
            <span className={inboxStyles.skeletonStack}>
              <span className={`${inboxStyles.skeletonLine} ${inboxStyles.skeletonLane}`} />
              <span className={`${inboxStyles.skeletonLine} ${inboxStyles.skeletonDate}`} />
            </span>
          </td>
          <td><span className={`${inboxStyles.skeletonLine} ${inboxStyles.skeletonHousehold}`} /></td>
          <td><span className={inboxStyles.skeletonInfoBtn} /></td>
        </tr>
      ))}
    </>
  )
}

export default function FostersPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | FosterStatus>('all')
  const [queueFilter, setQueueFilter] = useState<TaskInboxFilter>('needs_attention')
  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [dogsUpdatedAt, setDogsUpdatedAt] = useState<string | undefined>()
  const [fetchKey, setFetchKey] = useState(0)
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [dogsError, setDogsError] = useState<string | null>(null)
  const [taskRows, setTaskRows] = useState<TaskRow[]>([])
  const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<
    Record<string, FosterStatus>
  >({})

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const enrichedRows = useMemo(
    () => enrichFosterDirectoryWithLanes(dogs, taskRows, taskStatusByAnimalId),
    [dogs, taskRows, taskStatusByAnimalId]
  )

  const selectedEmails = useMemo(() => {
    if (selectedIds.size === 0) return []
    return enrichedRows
      .filter(r => selectedIds.has(r.id) && r.fosterEmail)
      .map(r => r.fosterEmail!)
  }, [selectedIds, enrichedRows])

  const directoryRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const rows = enrichedRows.filter(r => {
      if (!matchesTaskInboxFilter(r, queueFilter)) return false
      if (statusFilter !== 'all' && r.householdRollup !== statusFilter) return false
      if (!q) return true
      const email = (r.fosterEmail ?? '').toLowerCase()
      const roll = householdRollupDisplay(r).toLowerCase()
      return (
        r.fosterName.toLowerCase().includes(q) ||
        email.includes(q) ||
        r.dogs.some(d => d.name.toLowerCase().includes(q)) ||
        r.householdRollup.toLowerCase().includes(q) ||
        roll.includes(q) ||
        r.photoHouseholdSheetLabel.toLowerCase().includes(q) ||
        r.surveyHouseholdSheetLabel.toLowerCase().includes(q) ||
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
  const initialFostersLoading = isLoadingDogs && dogs.length === 0

  useEffect(() => {
    let active = true
    async function loadData() {
      setIsLoadingDogs(true)
      setDogsError(null)
      try {
        const [dogsRes, tasksRes] = await Promise.all([
          authFetch('/api/dogs', { cache: 'no-store' }),
          authFetch('/api/tasks', { cache: 'no-store' }).catch(() => null),
        ])
        const dogsData = (await dogsRes.json()) as DogsApiResponse
        if (!dogsRes.ok || !dogsData?.success || !Array.isArray(dogsData.dogs)) {
          throw new Error(dogsData?.error || 'Failed to load current directory from Shelter Manager')
        }
        if (!active) return
        setDogs(dogsData.dogs)
        if (dogsData.updatedAt) setDogsUpdatedAt(dogsData.updatedAt)
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
  }, [fetchKey])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, queueFilter])

  useEffect(() => {
    const el = tableWrapperRef.current
    if (!el) return
    function calc() {
      const firstRow = el!.querySelector('tbody tr:not([data-fosters-metrics-skip])') as HTMLElement | null
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
        <DashboardTopBar
          title="Onboarded Fosters"
          syncUpdatedAt={dogsUpdatedAt}
          onSyncRefresh={() => setFetchKey(k => k + 1)}
        />

        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Search foster, dog, email, task status…"
              className={styles.searchInput}
              value={searchQuery}
              disabled={initialFostersLoading}
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
              disabled={initialFostersLoading}
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
              disabled={initialFostersLoading}
              onChange={e => setStatusFilter(e.target.value as 'all' | FosterStatus)}
              title="Worst status among open Task Log rows (Completed/Retired ignored). Cleared homes show as No open tasks."
            >
              <option value="all">Any household</option>
              <option value="Good">Good / No open tasks</option>
              <option value="Needs Review">Needs Review</option>
              <option value="Overdue">Overdue</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
        </div>

        {dogsError && <div className={styles.errorText}>{dogsError}</div>}

        {!dogsError && (
          <div className={styles.tableWrapper} ref={tableWrapperRef}>
            <div className={styles.tableContainer}>
              <div className={styles.tableScroll}>
                <table className={`${styles.table} ${inboxStyles.fostersTaskTable}`}>
                  <thead>
                    <tr>
                      <th className={inboxStyles.checkboxCol} />
                      <th>Foster name</th>
                      <th>Dog(s)</th>
                      <th title="Task Log status for PHOTOS_* (worst dog in the home). Second line: last photo activity—Completed date from the log when present, otherwise the latest estimated upload date (Task Log email date minus 5 days), scheduled send, or task retired. Follow-up sent is excluded.">
                        Photos
                      </th>
                      <th title="Task Log status for SURVEY_* (worst dog in the home). Second line: last survey activity—Completed when present, otherwise estimated last survey (Task Log email date minus 7 days), scheduled send, or retired. Follow-up sent is excluded.">
                        Survey
                      </th>
                      <th title="Worst status among open Task Log rows in this home (Completed and Retired are excluded). Cleared homes: No open tasks.">
                        Household
                      </th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialFostersLoading ? (
                      <FosterTableSkeletonRows />
                    ) : paginatedRows.map(row => (
                      <tr
                        key={row.id}
                        className={`${styles.tableRowClickable} ${inboxStyles.fadeIn} ${selectedIds.has(row.id) ? inboxStyles.selectedRow : ''}`}
                        tabIndex={0}
                        aria-label={`Open foster home: ${row.fosterName}`}
                        onClick={e => {
                          if (isInteractiveTableCellTarget(e.target)) return
                          router.push(`/fosters/${row.id}`)
                        }}
                        onKeyDown={e => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          if (isInteractiveTableCellTarget(e.target)) return
                          e.preventDefault()
                          router.push(`/fosters/${row.id}`)
                        }}
                      >
                        <td
                          className={inboxStyles.checkboxCol}
                          onClick={e => { e.stopPropagation(); toggleSelect(row.id) }}
                        >
                          <input
                            type="checkbox"
                            className={inboxStyles.rowCheckbox}
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                            onClick={e => e.stopPropagation()}
                            aria-label={`Select ${row.fosterName}`}
                          />
                        </td>
                        <td>
                          <Link href={`/fosters/${row.id}`} className={styles.nameLink}>
                            {row.fosterName}
                          </Link>
                        </td>
                        <td>{row.dogs.map(d => d.name).join(', ')}</td>
                        <td>
                          <div className={inboxStyles.laneCell}>
                            <span>{row.photoHouseholdSheetLabel}</span>
                            <span
                              className={inboxStyles.laneLastTouch}
                              title="Last photo touchpoint: completed date from the log, or estimated last upload (email date −5 days), scheduled, or retired. Not the raw Task Log email date."
                            >
                              {row.lastPhotoTaskActivityDate
                                ? formatDateShort(row.lastPhotoTaskActivityDate)
                                : '—'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className={inboxStyles.laneCell}>
                            <span>{row.surveyHouseholdSheetLabel}</span>
                            <span
                              className={inboxStyles.laneLastTouch}
                              title="Last survey touchpoint: completed from the log, or estimated last survey (email date −7 days), scheduled, or retired. Follow-up sent excluded."
                            >
                              {row.lastSurveyTaskActivityDate
                                ? formatDateShort(row.lastSurveyTaskActivityDate)
                                : '—'}
                            </span>
                          </div>
                        </td>
                        <td>{householdRollupDisplay(row)}</td>
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
                    {!initialFostersLoading && paginatedRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className={styles.emptyState}>
                          No directory rows found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className={styles.pagination}>
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
                        <span key={`ellipsis-${idx}`} className={styles.paginationEllipsis}>
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

        <BulkEmailBar
          selectedEmails={selectedEmails}
          onClear={() => setSelectedIds(new Set())}
        />
      </DashboardShell>
    </ProtectedRoute>
  )
}
