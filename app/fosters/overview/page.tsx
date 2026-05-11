'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import {
  buildFosterDirectory,
  fosterSlug,
  formatDateShort,
  type FosterStatus,
} from '@/app/lib/fosterDirectory'
import type { TasksDataQuality, TasksGetMetrics } from '@/app/api/tasks/route'
import layoutStyles from '../../candidates/candidates.module.css'
import styles from './fostersOverview.module.css'
import FostersSubTabs from '../FostersSubTabs'
import FosterDataSourcesNote from '../components/FosterDataSourcesNote'

type DogRecord = {
  id?: number
  name?: string
  movement?: {
    daysInFoster?: number
    date?: string
  }
  foster?: {
    name?: string
    firstName?: string
    lastName?: string
    email?: string
  }
}

type DogsApiResponse = {
  success?: boolean
  dogs?: DogRecord[]
  error?: string
}

type TasksApiResponse = {
  success?: boolean
  taskStatusByAnimalId?: Record<string, FosterStatus>
  metrics?: TasksGetMetrics
  dataQuality?: TasksDataQuality
}

type UpdateRow = {
  id: string
  fosterName: string
  dogName: string
  status: FosterStatus
  daysInFoster?: number
  lastUpdate?: string
  fosterId: string
}

function nameOf(foster?: DogRecord['foster']) {
  const first = foster?.firstName?.trim() || ''
  const last = foster?.lastName?.trim() || ''
  const full = `${first} ${last}`.trim()
  return full || foster?.name?.trim() || 'Unknown Foster'
}

function dogName(dog?: DogRecord) {
  return dog?.name?.trim() || 'Unknown Dog'
}

export default function FostersSectionOverviewPage() {
  const [activeFosterCount, setActiveFosterCount] = useState<number | null>(null)
  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [dogsError, setDogsError] = useState<string | null>(null)
  const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<Record<string, FosterStatus>>({})
  const [taskMetrics, setTaskMetrics] = useState<TasksGetMetrics | null>(null)
  const [dataQuality, setDataQuality] = useState<TasksDataQuality | null>(null)
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
          throw new Error(dogsData?.error || 'Could not load foster data')
        }
        if (!active) return
        setDogs(dogsData.dogs)
        if (tasksRes) {
          try {
            const tasksData = (await tasksRes.json()) as TasksApiResponse
            if (tasksData?.taskStatusByAnimalId) {
              setTaskStatusByAnimalId(tasksData.taskStatusByAnimalId)
            }
            if (tasksData?.metrics) setTaskMetrics(tasksData.metrics)
            if (tasksData?.dataQuality) setDataQuality(tasksData.dataQuality)
          } catch { /* tasks not available yet */ }
        }
      } catch (error) {
        if (!active) return
        setDogsError(error instanceof Error ? error.message : 'Could not load foster data')
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
    let active = true
    async function loadFosterCount() {
      try {
        const res = await fetch('/api/fosters', { method: 'GET', cache: 'no-store' })
        const data = await res.json()
        if (!active) return
        if (typeof data?.count === 'number') {
          setActiveFosterCount(data.count)
        }
      } catch {
        // silently fail — the stat card will just show the fallback
      }
    }
    loadFosterCount()
    return () => { active = false }
  }, [])

  const updates = useMemo(() => {
    return dogs.map((dog, idx) => {
      const days = dog.movement?.daysInFoster
      const fosterName = nameOf(dog.foster)
      const animalId = String(dog.id ?? '')
      const taskStatus = taskStatusByAnimalId[animalId]
      const status: UpdateRow['status'] = taskStatus ?? 'Good'
      return {
        id: `${dog.id ?? idx}`,
        fosterName,
        dogName: dogName(dog),
        status,
        daysInFoster: days,
        lastUpdate: dog.movement?.date,
        fosterId: fosterSlug(fosterName, dog.foster?.email),
      } satisfies UpdateRow
    })
  }, [dogs, taskStatusByAnimalId])

  const overdueFollowUpRows = taskMetrics?.activeOverdueTaskRows ?? 0
  const unknownStatusRows = taskMetrics?.unknownStatusRowCount ?? 0
  const activeFosters = useMemo(
    () => buildFosterDirectory(dogs, taskStatusByAnimalId).length,
    [dogs, taskStatusByAnimalId]
  )
  const priorityQueue = useMemo(() => {
    const rank = (s: FosterStatus) =>
      s === 'Unknown' ? 3 : s === 'Overdue' ? 2 : 1
    return [...updates]
      .filter(r => r.status !== 'Good')
      .sort((a, b) => {
        if (rank(b.status) !== rank(a.status)) return rank(b.status) - rank(a.status)
        return (b.daysInFoster ?? 0) - (a.daysInFoster ?? 0)
      })
      .slice(0, 8)
  }, [updates])

  return (
    <ProtectedRoute>
      <DashboardShell>
          <div className={layoutStyles.topBar}>
            <h1 className={layoutStyles.topBarTitle}>Fosters</h1>
            <div className={layoutStyles.topBarActions}>
              <NotificationPanel />
              <TopBarProfileMenu />
            </div>
          </div>

          <FostersSubTabs active="overview" />

          {isLoadingDogs && <div className={layoutStyles.loadingContainer}>Loading…</div>}
          {dogsError && <div className={layoutStyles.errorText}>{dogsError}</div>}

          {!isLoadingDogs && (
            <div className={styles.wrap}>
              <FosterDataSourcesNote />

              {dataQuality?.hasUnknownTaskStatuses ? (
                <p className={styles.dataQualityBanner} role="status">
                  Data quality: {dataQuality.unknownStatusRowCount} task row
                  {dataQuality.unknownStatusRowCount === 1 ? '' : 's'} have missing or unrecognized status in the Task Log — not counted as Good until fixed.
                </p>
              ) : null}

              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Overdue follow-ups</span>
                  <span className={styles.statValue}>{overdueFollowUpRows}</span>
                  <span className={styles.statHint}>Active task rows marked Overdue</span>
                </div>
                {unknownStatusRows > 0 ? (
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Unknown status</span>
                    <span className={styles.statValue}>{unknownStatusRows}</span>
                    <span className={styles.statHint}>Task rows not Good / Overdue / Completed / Retired</span>
                  </div>
                ) : null}
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Active homes</span>
                  <span className={styles.statValue}>{activeFosterCount ?? activeFosters}</span>
                  <span className={styles.statHint}>Shelter Manager</span>
                </div>
              </div>

              <section className={styles.sectionPanel} aria-labelledby="followups-heading">
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionHeaderText}>
                    <h2 id="followups-heading" className={styles.sectionTitle}>
                      Follow-ups
                    </h2>
                    <p className={styles.sectionIntro}>
                      Sorted by Task Log severity. <strong>Follow-up overdue</strong> means an <em>active</em> Task Log
                      row for that dog is Overdue—open the foster&apos;s <strong>Tasks</strong> tab for details. Dates
                      and days in foster are Shelter Manager movement data (context only).
                    </p>
                  </div>
                  <span className={styles.sectionCount}>{priorityQueue.length} shown</span>
                </div>

                {priorityQueue.length === 0 && !dogsError ? (
                  <p className={styles.empty}>Nothing queued.</p>
                ) : (
                  <div className={styles.rosterList}>
                    {priorityQueue.map(row => (
                      <article key={row.id} className={styles.rosterCard}>
                        <div className={styles.rosterMain}>
                          <div className={styles.rosterName}>
                            <Link href={`/fosters/${row.fosterId}?from=overview`} className={styles.fosterLink}>
                              {row.fosterName}
                            </Link>
                          </div>
                          <div className={styles.rosterDogs}>{row.dogName}</div>
                          <div className={styles.rosterMeta}>
                            <span className={styles.metaKey}>Movement</span>
                            {' '}
                            {row.lastUpdate ? formatDateShort(row.lastUpdate) : '—'}
                            {typeof row.daysInFoster === 'number'
                              ? ` · ${row.daysInFoster}d in foster`
                              : ''}
                          </div>
                        </div>
                        <div className={styles.rosterSide}>
                          {row.status === 'Overdue' ? (
                            <span
                              className={styles.badgeOpen}
                              title="Task Log has at least one active task marked Overdue for this animal."
                            >
                              Follow-up overdue
                            </span>
                          ) : row.status === 'Unknown' ? (
                            <span
                              className={styles.badgeUnknown}
                              title="Task Log Status is missing or not one of Good / Overdue / Completed / Retired."
                            >
                              Unknown
                            </span>
                          ) : (
                            <span className={styles.badgeClear}>Good</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
      </DashboardShell>
    </ProtectedRoute>
  )
}

