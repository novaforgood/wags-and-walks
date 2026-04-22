'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import {
  buildFosterDirectory,
  formatDateShort,
  type DogRecord,
  type FosterStatus,
} from '@/app/lib/fosterDirectory'
import type { TaskRow } from '@/app/api/tasks/route'
import NotesCard from '@/app/components/NotesCard'
import FosterHistoryPanel from '@/app/components/FosterHistoryPanel'
import layoutStyles from '../../candidates/candidates.module.css'
import styles from './page.module.css'

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

const TASK_LABELS: Record<string, string> = {
  PHOTOS: 'Photo upload',
  SURVEY: 'Foster survey',
}

function taskLabel(taskType: string) {
  const prefix = taskType.split('_')[0]
  const num = taskType.split('_')[1]
  return `${TASK_LABELS[prefix] ?? prefix} #${num}`
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Overdue' ? styles.badgeOverdue :
    status === 'Needs Review' ? styles.badgeNeedsReview :
    status === 'Good' ? styles.badgeGood :
    status === 'Completed' ? styles.badgeCompleted :
    styles.badgeRetired
  return <span className={cls}>{status || 'Good'}</span>
}

export default function FosterDetailsPage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const backHref = searchParams.get('from') === 'overview' ? '/fosters/overview' : '/fosters'
  const backLabel = searchParams.get('from') === 'overview' ? '← Back to Overview' : '← Back to Current Directory'
  const params = useParams<{ fosterId: string }>()
  const fosterId = params?.fosterId
  const { user, signOut } = useAuth()
  const { people } = usePeople()
  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [dogsError, setDogsError] = useState<string | null>(null)
  const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<Record<string, FosterStatus>>({})
  const [taskRows, setTaskRows] = useState<TaskRow[]>([])
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
          throw new Error(dogsData?.error || 'Failed to load foster details from Shelter Manager')
        }
        if (!active) return
        setDogs(dogsData.dogs)
        if (tasksRes) {
          try {
            const tasksData = (await tasksRes.json()) as TasksApiResponse
            if (tasksData?.taskStatusByAnimalId) setTaskStatusByAnimalId(tasksData.taskStatusByAnimalId)
            if (Array.isArray(tasksData?.rows)) setTaskRows(tasksData.rows)
          } catch { /* tasks not available */ }
        }
      } catch (error) {
        if (!active) return
        setDogsError(error instanceof Error ? error.message : 'Failed to load foster details')
      } finally {
        if (active) setIsLoadingDogs(false)
      }
    }
    loadData()
    return () => { active = false }
  }, [])

  const directory = useMemo(() => buildFosterDirectory(dogs, taskStatusByAnimalId), [dogs, taskStatusByAnimalId])
  const foster = useMemo(() => directory.find(f => f.id === fosterId), [directory, fosterId])
  const person = useMemo(
    () => people.find(p => p.email?.toLowerCase() === foster?.fosterEmail?.toLowerCase()),
    [people, foster]
  )

  // Decode the email from the slug immediately so notes can load in parallel with dogs.
  // fosterSlug() uses encodeURIComponent(email) when an email is available.
  const emailFromSlug = useMemo(() => {
    if (!fosterId) return null
    const decoded = decodeURIComponent(fosterId)
    return decoded.includes('@') ? decoded : null
  }, [fosterId])

  // Tasks for dogs in this foster record, grouped by animal ID
  const fosterTasksByDogId = useMemo(() => {
    if (!foster) return new Map<string, TaskRow[]>()
    const dogIds = new Set(foster.dogs.map(d => d.id))
    const map = new Map<string, TaskRow[]>()
    for (const row of taskRows) {
      if (!dogIds.has(row.animalId)) continue
      if (!map.has(row.animalId)) map.set(row.animalId, [])
      map.get(row.animalId)!.push(row)
    }
    return map
  }, [foster, taskRows])

  useEffect(() => {
    try { localStorage.setItem('app_nav_sidebar_width_v1', String(navWidth)) } catch { /* ignore */ }
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
    function onUp() { setIsResizingNav(false) }
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
              <a href="#" className={layoutStyles.profileEmail}>{user?.email}</a>
              <button type="button" className={layoutStyles.profileLogout} onClick={signOut}>Log Out</button>
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
            <h1 className={layoutStyles.topBarTitle}>Foster Details</h1>
            <NotificationPanel />
          </div>

          <div className={styles.wrap}>
            <Link href={backHref} className={styles.backLink}>{backLabel}</Link>

            {isLoadingDogs && <div className={layoutStyles.loadingContainer}>Loading foster details...</div>}
            {dogsError && <div className={layoutStyles.errorText}>{dogsError}</div>}
            {!isLoadingDogs && !dogsError && !foster && (
              <div className={styles.card}>No foster record found for this profile.</div>
            )}

            {!isLoadingDogs && foster && (
              <>
                {/* Summary card */}
                <section className={styles.card}>
                  <div className={styles.titleRow}>
                    <h2 className={styles.title}>{foster.fosterName}</h2>
                    <StatusBadge status={foster.status} />
                  </div>
                  <div className={styles.metaGrid}>
                    <div><strong>Email:</strong> {foster.fosterEmail || '—'}</div>
                    <div><strong>Dogs fostering:</strong> {foster.dogs.map(d => d.name).join(', ') || '—'}</div>
                    <div><strong>Placement date:</strong> {formatDateShort(foster.lastUpdate)}</div>
                  </div>
                </section>

                {/* Per-dog task cards */}
                {foster.dogs.map(dog => {
                  const tasks = fosterTasksByDogId.get(dog.id) ?? []
                  const activeTasks = tasks.filter(t => t.status !== 'retired' && t.status !== 'completed')
                  const lastEmailSent = tasks
                    .map(t => t.emailSentDate)
                    .filter(Boolean)
                    .sort()
                    .at(-1)
                  const lastFollowUp = tasks
                    .map(t => t.followUpSent)
                    .filter(Boolean)
                    .sort()
                    .at(-1)

                  return (
                    <section key={dog.id} className={styles.card}>
                      <div className={styles.dogHeader}>
                        <h3 className={styles.sectionTitle}>{dog.name}</h3>
                        <StatusBadge status={dog.status} />
                      </div>
                      <div className={styles.metaGrid} style={{ marginBottom: 16 }}>
                        <div><strong>Days in foster:</strong> {typeof dog.daysInFoster === 'number' ? `${dog.daysInFoster} days` : '—'}</div>
                        <div><strong>Last email sent:</strong> {lastEmailSent ? formatDateShort(lastEmailSent) : '—'}</div>
                        <div><strong>Last follow-up:</strong> {lastFollowUp ? formatDateShort(lastFollowUp) : '—'}</div>
                        <div><strong>Open tasks:</strong> {activeTasks.length}</div>
                      </div>

                      {tasks.length > 0 && (
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Task</th>
                              <th>Email sent</th>
                              <th>Last follow-up</th>
                              <th>Completed</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tasks.map((t, i) => (
                              <tr key={i}>
                                <td>{taskLabel(t.taskType)}</td>
                                <td>{t.emailSentDate ? formatDateShort(t.emailSentDate) : '—'}</td>
                                <td>{t.followUpSent ? formatDateShort(t.followUpSent) : '—'}</td>
                                <td>{t.completedDate ? formatDateShort(t.completedDate) : '—'}</td>
                                <td><StatusBadge status={
                                  t.status === 'overdue' ? 'Overdue' :
                                  t.status === 'needs_review' ? 'Needs Review' :
                                  t.status === 'completed' ? 'Completed' :
                                  t.status === 'retired' ? 'Retired' : 'Good'
                                } /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {tasks.length === 0 && (
                        <p className={styles.hint}>No tasks logged yet for {dog.name}.</p>
                      )}
                    </section>
                  )
                })}
                <section className={styles.card}>
                  <h3 className={styles.sectionTitle}>Current Fostering Situation</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Dog</th>
                        <th>How long fostering</th>
                        <th>Last update</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foster.dogs.map(dog => (
                        <tr key={dog.id}>
                          <td>{dog.name}</td>
                          <td>{typeof dog.daysInFoster === 'number' ? `${dog.daysInFoster} days` : 'Unknown'}</td>
                          <td>{formatDateShort(dog.lastUpdate)}</td>
                          <td>{dog.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className={styles.card}>
                  <NotesCard email={emailFromSlug} name={foster.fosterName} />
                </section>

                <FosterHistoryPanel
                  email={emailFromSlug}
                  sectionClassName={styles.card}
                  sectionTitleClassName={styles.sectionTitle}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
