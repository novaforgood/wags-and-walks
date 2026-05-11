'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import { buildFosterDirectory, fosterSlug, formatDateShort } from '@/app/lib/fosterDirectory'
import layoutStyles from '../../candidates/candidates.module.css'
import styles from './fostersOverview.module.css'
import FostersSubTabs from '../FostersSubTabs'

type DogRecord = {
  id?: number
  name?: string
  photo?: {
    imageUrl?: string
  }
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

type TaskRowLite = {
  animalId: string
  taskType: string
  status: 'pending' | 'needs_review' | 'overdue' | 'completed' | 'retired'
}

type TasksApiResponse = {
  success?: boolean
  taskStatusByAnimalId?: Record<string, 'Good' | 'Needs Review' | 'Overdue'>
  rows?: TaskRowLite[]
}

type UpdateRow = {
  id: string
  fosterName: string
  dogName: string
  uploadedPhoto: boolean
  status: 'Good' | 'Needs Review' | 'Overdue'
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
  const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<Record<string, 'Good' | 'Needs Review' | 'Overdue'>>({})
  const [openPhotoAnimalIds, setOpenPhotoAnimalIds] = useState<Set<string>>(new Set())
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
            if (Array.isArray(tasksData?.rows)) {
              const photoIds = new Set<string>()
              for (const r of tasksData.rows) {
                const open = r.status === 'pending' || r.status === 'needs_review' || r.status === 'overdue'
                if (open && r.animalId && r.taskType?.startsWith('PHOTOS_')) {
                  photoIds.add(r.animalId)
                }
              }
              setOpenPhotoAnimalIds(photoIds)
            }
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
      const uploadedPhoto = Boolean(dog.photo?.imageUrl)
      const days = dog.movement?.daysInFoster
      const fosterName = nameOf(dog.foster)
      const animalId = String(dog.id ?? '')
      const taskStatus = taskStatusByAnimalId[animalId]
      const status: UpdateRow['status'] = taskStatus ?? (
        (days ?? 0) > 30 && !uploadedPhoto ? 'Overdue' :
          (days ?? 0) > 14 || !uploadedPhoto ? 'Needs Review' : 'Good'
      )
      const hasOpenPhotoTask = openPhotoAnimalIds.has(animalId)
      return {
        id: `${dog.id ?? idx}`,
        fosterName,
        dogName: dogName(dog),
        uploadedPhoto: uploadedPhoto && !hasOpenPhotoTask,
        status,
        daysInFoster: days,
        lastUpdate: dog.movement?.date,
        fosterId: fosterSlug(fosterName, dog.foster?.email),
      } satisfies UpdateRow
    })
  }, [dogs, taskStatusByAnimalId, openPhotoAnimalIds])

  const overdueCount = useMemo(() => updates.filter(r => r.status === 'Overdue').length, [updates])
  const needsReviewCount = useMemo(() => updates.filter(r => r.status === 'Needs Review').length, [updates])
  const activeFosters = useMemo(() => buildFosterDirectory(dogs).length, [dogs])
  const priorityQueue = useMemo(() => {
    return [...updates]
      .filter(r => r.status !== 'Good')
      .sort((a, b) => {
        const rank = (s: UpdateRow['status']) => (s === 'Overdue' ? 2 : 1)
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

              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Overdue</span>
                  <span className={styles.statValue}>{overdueCount}</span>
                  <span className={styles.statHint}>Needs action</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Review</span>
                  <span className={styles.statValue}>{needsReviewCount}</span>
                  <span className={styles.statHint}>Due soon</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Active homes</span>
                  <span className={styles.statValue}>{activeFosterCount ?? activeFosters}</span>
                  <span className={styles.statHint}>Shelter Manager</span>
                </div>
              </div>

              <section className={styles.sectionPanel}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Follow-ups</h2>
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
                            {formatDateShort(row.lastUpdate)}
                            {typeof row.daysInFoster === 'number'
                              ? ` · ${row.daysInFoster}d in foster`
                              : ''}
                          </div>
                          <div className={styles.rosterMeta}>
                            Photo {row.uploadedPhoto ? 'complete' : 'missing'}
                          </div>
                        </div>
                        <div className={styles.rosterSide}>
                          {row.status === 'Overdue' ? (
                            <span className={styles.badgeOpen}>Overdue</span>
                          ) : row.status === 'Needs Review' ? (
                            <span className={styles.badgeWarn}>Needs Review</span>
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

