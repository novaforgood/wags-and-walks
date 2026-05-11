'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import FostersSubTabs from '../FostersSubTabs'
import FosterDataSourcesNote from '../components/FosterDataSourcesNote'
import type { FosterStatus } from '@/app/lib/fosterDirectory'
import type { DogRecord } from '@/app/lib/fosterDirectory'
import type { TaskRow } from '@/app/api/tasks/route'
import {
  enrichFosterDirectoryWithLanes,
  laneLabel,
  matchesTaskInboxFilter,
  type TaskInboxFilter,
} from '@/app/lib/fosterTaskEnrichment'
import { formatDateShort } from '@/app/lib/fosterDirectory'
import styles from '@/app/candidates/candidates.module.css'
import inboxStyles from '../fosterTasks.module.css'

const QUEUE_FILTERS: { value: TaskInboxFilter; label: string }[] = [
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'all', label: 'All fosters' },
  { value: 'rollup_overdue', label: 'Rollup Overdue' },
  { value: 'rollup_good', label: 'Rollup Good' },
  { value: 'rollup_unknown', label: 'Rollup Unknown' },
  { value: 'photo_overdue', label: 'Photos: overdue' },
  { value: 'survey_overdue', label: 'Survey: overdue' },
  { value: 'photo_on_track', label: 'Photos: on track' },
  { value: 'survey_on_track', label: 'Survey: on track' },
  { value: 'photo_missing_log', label: 'Photos: missing row' },
  { value: 'survey_missing_log', label: 'Survey: missing row' },
]

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

function PageButton(props: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const { onClick, disabled, active, children } = props
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

function RollupBadge({ status }: { status: FosterStatus }) {
  const c =
    status === 'Overdue'
      ? inboxStyles.badgeRollupOverdue
      : status === 'Unknown'
        ? inboxStyles.badgeRollupUnknown
        : inboxStyles.badgeRollupGood
  return <span className={c}>{status}</span>
}

export default function FostersTasksInboxPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [rollupFilter, setRollupFilter] = useState<'all' | FosterStatus>('all')
  const [queueFilter, setQueueFilter] = useState<TaskInboxFilter>('needs_attention')

  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [taskRows, setTaskRows] = useState<TaskRow[]>([])
  const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<
    Record<string, FosterStatus>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [dogsRes, tasksRes] = await Promise.all([
          fetch('/api/dogs', { cache: 'no-store' }),
          fetch('/api/tasks', { cache: 'no-store' }).catch(() => null),
        ])
        const dogsData = (await dogsRes.json()) as DogsApiResponse
        if (!dogsRes.ok || !dogsData?.success || !Array.isArray(dogsData.dogs)) {
          throw new Error(dogsData?.error || 'Could not load dogs')
        }
        if (!active) return
        setDogs(dogsData.dogs)
        if (tasksRes?.ok) {
          const tasksJson = (await tasksRes.json()) as TasksApiResponse
          setTaskRows(Array.isArray(tasksJson.rows) ? tasksJson.rows : [])
          setTaskStatusByAnimalId(tasksJson.taskStatusByAnimalId ?? {})
        } else {
          setTaskRows([])
          setTaskStatusByAnimalId({})
        }
      } catch (e) {
        if (!active) return
        setLoadError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const enriched = useMemo(
    () => enrichFosterDirectoryWithLanes(dogs, taskRows, taskStatusByAnimalId),
    [dogs, taskRows, taskStatusByAnimalId]
  )

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return enriched.filter(row => {
      if (!matchesTaskInboxFilter(row, queueFilter)) return false
      if (rollupFilter !== 'all' && row.householdRollup !== rollupFilter) return false
      if (!q) return true
      if (row.fosterName.toLowerCase().includes(q)) return true
      const email = (row.fosterEmail ?? '').toLowerCase()
      if (email.includes(q)) return true
      if (row.dogs.some(d => d.name.toLowerCase().includes(q))) return true
      return laneLabel(row.photoWorst).toLowerCase().includes(q) ||
        laneLabel(row.surveyWorst).toLowerCase().includes(q)
    })
  }, [enriched, searchQuery, queueFilter, rollupFilter])

  const tableWrapperRef = useRef<HTMLDivElement>(null)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredRows.slice(start, start + itemsPerPage)
  }, [filteredRows, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredRows.length / Math.max(itemsPerPage, 1))

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, queueFilter, rollupFilter])

  useEffect(() => {
    const el = tableWrapperRef.current
    if (!el) return
    function calc() {
      const firstRow = el!.querySelector('tbody tr') as HTMLElement | null
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : 42
      const thead = el!.querySelector('thead') as HTMLElement | null
      const theadH = thead ? thead.getBoundingClientRect().height : 46
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
          <h1 className={styles.topBarTitle}>Task inbox</h1>
          <div className={styles.topBarActions}>
            <NotificationPanel />
            <TopBarProfileMenu />
          </div>
        </div>

        <FostersSubTabs active="tasks" />

        <FosterDataSourcesNote />

        <div className={inboxStyles.toolbarStack}>
          <div className={inboxStyles.toolbarSearchRow}>
            <div className={`${styles.searchWrapper} ${inboxStyles.wideSearchWrap}`}>
              <input
                type="search"
                placeholder="Search foster, dog, email, or lane labels"
                className={`${styles.searchInput} ${inboxStyles.wideSearchInput}`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Search task inbox"
              />
              <div className={styles.searchIconWrap}>
                <img src="/assets/Search.svg" alt="" width={16} height={16} />
              </div>
            </div>
          </div>
          <div className={inboxStyles.toolbarFilterRow}>
            <div className={inboxStyles.filterField}>
              <span className={inboxStyles.filterFieldLabel} id="inbox-queue-label">
                Queue
              </span>
              <label className={inboxStyles.visuallyHidden} htmlFor="fosters-queue-filter">
                Work queue
              </label>
              <select
                id="fosters-queue-filter"
                className={`${styles.toolbarBtn} ${styles.statusFilterSelect}`}
                value={queueFilter}
                onChange={e => setQueueFilter(e.target.value as TaskInboxFilter)}
                title="Prioritize by Task Log photo/survey lanes"
                aria-labelledby="inbox-queue-label"
              >
                {QUEUE_FILTERS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.value === 'needs_attention' ? `${o.label} (recommended)` : o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={inboxStyles.filterField}>
              <span className={inboxStyles.filterFieldLabel} id="inbox-rollup-label">
                Rollup
              </span>
              <label className={inboxStyles.visuallyHidden} htmlFor="fosters-rollup-filter">
                Household rollup filter
              </label>
              <select
                id="fosters-rollup-filter"
                className={`${styles.toolbarBtn} ${styles.statusFilterSelect}`}
                value={rollupFilter}
                onChange={e => setRollupFilter(e.target.value as 'all' | FosterStatus)}
                title="Worst-case Task Log rollup across dogs in the home"
                aria-labelledby="inbox-rollup-label"
              >
                <option value="all">Any rollup</option>
                <option value="Good">Good only</option>
                <option value="Overdue">Overdue only</option>
                <option value="Unknown">Unknown only</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading && <div className={styles.loadingContainer}>Loading task inbox…</div>}
        {loadError && <div className={styles.errorText}>{loadError}</div>}

        {!isLoading && !loadError && (
          <div className={styles.tableWrapper} ref={tableWrapperRef}>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Foster</th>
                    <th>Dog(s)</th>
                    <th title="Latest movement date from Shelter Manager (not Task Log deadlines)">Movement</th>
                    <th title="Worst Task Log status among dogs in this foster home">Rollup</th>
                    <th>Photos (Task Log)</th>
                    <th>Survey (Task Log)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(row => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/fosters/${row.id}`} className={styles.nameLink}>
                          {row.fosterName}
                        </Link>
                        {row.fosterEmail ? (
                          <div className={inboxStyles.stackHint}>{row.fosterEmail}</div>
                        ) : null}
                      </td>
                      <td>{row.dogs.map(d => d.name).join(', ')}</td>
                      <td>{formatDateShort(row.lastUpdate)}</td>
                      <td>
                        <RollupBadge status={row.householdRollup} />
                      </td>
                      <td>
                        <div className={inboxStyles.laneCell}>
                          <strong>{laneLabel(row.photoWorst)}</strong>
                          {row.dogs.length > 1
                            ? row.dogs.map(d => (
                              <span key={d.id} className={inboxStyles.perDogLane}>
                                {d.name}: {laneLabel(d.photoLane)}
                              </span>
                              ))
                            : null}
                        </div>
                      </td>
                      <td>
                        <div className={inboxStyles.laneCell}>
                          <strong>{laneLabel(row.surveyWorst)}</strong>
                          {row.dogs.length > 1
                            ? row.dogs.map(d => (
                              <span key={d.id} className={inboxStyles.perDogLane}>
                                {d.name}: {laneLabel(d.surveyLane)}
                              </span>
                              ))
                            : null}
                        </div>
                      </td>
                      <td>
                        <Link
                          href={`/fosters/${row.id}?from=tasks&tab=tasks`}
                          className={styles.nameLink}
                          style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
                          aria-label={`Open tasks for ${row.fosterName}`}
                          title="Opens foster detail on Tasks tab"
                        >
                          Open tasks
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                        No fosters match these filters.
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
                  <PageButton
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ‹ Previous
                  </PageButton>
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
