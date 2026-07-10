'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import {
  animalIdsFromTaskLogRows,
  buildFosterDirectory,
  formatDateShort,
  strictTaskPresenceForRollup,
  type DogRecord,
  type FosterStatus,
} from '@/app/lib/fosterDirectory'
import { authFetch } from '@/app/lib/authFetch'
import {
  householdLastTaskActivityDate,
  inferLastFosterSubmissionYmdFromEmailSent,
} from '@/app/lib/fosterTaskEnrichment'
import type { TaskRow } from '@/app/lib/taskTypes'
import ApplicantNotesCard from '@/app/components/ApplicantNotesCard'
import EmailTemplateCompose from '@/app/components/EmailTemplateCompose'
import { DEFAULT_TEMPLATE_BY_CONTEXT } from '@/app/lib/emailTemplates'
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
    status === 'Unknown' ? styles.badgeUnknown :
    status === 'Needs Review' ? styles.badgeNeedsReview :
    status === 'Good' ? styles.badgeGood :
    status === 'Completed' ? styles.badgeCompleted :
    status === 'Retired' ? styles.badgeRetired :
    styles.badgeUnknown
  return <span className={cls}>{status || 'Good'}</span>
}

function FosterDetailsSkeleton() {
  return (
    <div className={styles.skeletonWrap} role="status" aria-live="polite" aria-label="Loading foster details">
      <section className={styles.hero}>
        <span className={`${styles.skeletonBlock} ${styles.skeletonAvatar}`} aria-hidden />
        <div className={styles.heroBody} aria-hidden>
          <div className={styles.heroNameRow}>
            <span className={`${styles.skeletonBlock} ${styles.skeletonHeroName}`} />
            <span className={`${styles.skeletonBlock} ${styles.skeletonBadge}`} />
          </div>
          <div className={styles.chipRow}>
            <span className={`${styles.skeletonBlock} ${styles.skeletonChipWide}`} />
            <span className={`${styles.skeletonBlock} ${styles.skeletonChip}`} />
            <span className={`${styles.skeletonBlock} ${styles.skeletonChipWide}`} />
          </div>
        </div>
      </section>

      <div className={styles.tabBar} aria-hidden>
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className={`${styles.skeletonBlock} ${styles.skeletonTab}`} />
        ))}
      </div>

      <div className={styles.tabPanel} aria-hidden>
        {Array.from({ length: 2 }).map((_, index) => (
          <section key={index} className={styles.card}>
            <div className={styles.dogHeader}>
              <span className={`${styles.skeletonBlock} ${styles.skeletonSectionTitle}`} />
              <span className={`${styles.skeletonBlock} ${styles.skeletonBadge}`} />
            </div>
            <div className={styles.statGrid}>
              {Array.from({ length: 5 }).map((__, statIndex) => (
                <div key={statIndex} className={styles.stat}>
                  <span className={`${styles.skeletonBlock} ${styles.skeletonStatLabel}`} />
                  <span className={`${styles.skeletonBlock} ${styles.skeletonStatValue}`} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function sheetTaskBadgeLabel(status: TaskRow['status']): string {
  switch (status) {
    case 'good':
      return 'Good'
    case 'needs_review':
      return 'Needs Review'
    case 'overdue':
      return 'Overdue'
    case 'completed':
      return 'Completed'
    case 'retired':
      return 'Retired'
    case 'unknown':
      return 'Unknown'
    default:
      return 'Unknown'
  }
}

type FosterDirectoryItem = ReturnType<typeof buildFosterDirectory>[number]

function parseYmdOrDate(value?: string) {
  if (!value) return null
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2]) - 1
    const day = Number(m[3])
    return new Date(year, month, day)
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

function addDaysYmd(value: string, days: number) {
  const date = parseYmdOrDate(value)
  if (!date) return ''
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// --- Main Page ---
export default function FosterDetailsPage() {
  const searchParams = useSearchParams()
  const backHref =
    searchParams.get('from') === 'overview' ? '/overview' : '/fosters'
  const backLabel =
    searchParams.get('from') === 'overview'
      ? '← Back to Overview'
      : '← Back to Active fosters'
  const params = useParams<{ fosterId: string }>()
  const fosterId = params?.fosterId
  const { people } = usePeople()
  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [dogsError, setDogsError] = useState<string | null>(null)
  const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<Record<string, FosterStatus>>({})
  const [taskRows, setTaskRows] = useState<TaskRow[]>([])

  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'notes' | 'history'>('overview')

  useEffect(() => {
    const tab = searchParams.get('tab')
    const map = {
      overview: 'overview',
      tasks: 'tasks',
      notes: 'notes',
      history: 'history',
    } as const
    if (tab && tab in map) {
      setActiveTab(map[tab as keyof typeof map])
    }
  }, [searchParams])

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

  const directory = useMemo(() => {
    const strict = strictTaskPresenceForRollup(
      taskRows.length,
      taskStatusByAnimalId
    )
    const idSet = strict ? animalIdsFromTaskLogRows(taskRows) : undefined
    return buildFosterDirectory(dogs, taskStatusByAnimalId, idSet)
  }, [dogs, taskStatusByAnimalId, taskRows])
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

  return (
    <ProtectedRoute>
      <DashboardShell>
          <div className={layoutStyles.topBar}>
            <h1 className={layoutStyles.topBarTitle}>Foster Details</h1>
            <div className={layoutStyles.topBarActions}>
              <NotificationPanel />
              <TopBarProfileMenu />
            </div>
          </div>

          <div className={styles.wrap}>
            <Link href={backHref} className={styles.backLink}>{backLabel}</Link>

            {isLoadingDogs && <FosterDetailsSkeleton />}
            {dogsError && <div className={layoutStyles.errorText}>{dogsError}</div>}
            {!isLoadingDogs && !dogsError && !foster && (
              <div className={styles.card}>No foster record found for this profile.</div>
            )}

            {!isLoadingDogs && foster && (
              <div className={styles.fadeIn}>
                <section className={styles.hero}>
                  <div className={styles.avatar}>
                    {(foster.fosterName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.heroBody}>
                    <div className={styles.heroNameRow}>
                      <h2 className={styles.heroName}>{foster.fosterName}</h2>
                      <StatusBadge status={foster.status} />
                    </div>
                    <div className={styles.chipRow}>
                      {foster.fosterEmail && (
                        <a href={`mailto:${foster.fosterEmail}`} className={styles.chip} style={{ textDecoration: 'none' }}>
                          {foster.fosterEmail}
                        </a>
                      )}
                      {foster.fosterPhone && (
                        <span className={styles.chip}>{foster.fosterPhone}</span>
                      )}
                      <span className={styles.chip}>
                        {foster.dogs.length} dog{foster.dogs.length === 1 ? '' : 's'}: {foster.dogs.map(d => d.name).join(', ') || '—'}
                      </span>
                      <span className={styles.chip}>
                        Placed {formatDateShort(foster.lastUpdate)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.heroActions}>
                    <EmailTemplateCompose
                      email={foster.fosterEmail}
                      recipientName={foster.fosterName}
                      dogNames={foster.dogs.map(d => d.name)}
                      defaultTemplateId={DEFAULT_TEMPLATE_BY_CONTEXT.foster}
                      triggerVariant="pill"
                    />
                  </div>
                </section>

                <div className={styles.tabBar}>
                  {([
                    { id: 'overview', label: 'Overview' },
                    { id: 'tasks', label: `Tasks${(() => {
                      const total = foster.dogs.reduce((acc, d) => {
                        const t = fosterTasksByDogId.get(d.id) ?? []
                        return acc + t.filter(x => x.status !== 'retired' && x.status !== 'completed').length
                      }, 0)
                      return total > 0 ? ` (${total})` : ''
                    })()}` },
                    { id: 'notes', label: 'Notes' },
                    { id: 'history', label: 'History' },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabBtnActive : ''}`}
                      onClick={() => setActiveTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'overview' && (
                  <div className={styles.tabPanel}>
                    {foster.dogs.map(dog => {
                      const tasks = fosterTasksByDogId.get(dog.id) ?? []
                      const activeTasks = tasks.filter(t => t.status !== 'retired' && t.status !== 'completed')
                      const idSet = new Set([dog.id])
                      const lastPhotoSubmitted = householdLastTaskActivityDate(taskRows, idSet, 'PHOTOS')
                      const lastSurveySubmitted = householdLastTaskActivityDate(taskRows, idSet, 'SURVEY')
                      return (
                        <section key={dog.id} className={styles.card}>
                          <div className={styles.dogHeader}>
                            <h3 className={styles.sectionTitle} style={{ margin: 0 }}>{dog.name}</h3>
                            <StatusBadge status={dog.status} />
                          </div>
                          <div className={styles.statGrid}>
                            <div className={styles.stat}>
                              <div className={styles.statLabel}>Days in foster</div>
                              <div className={styles.statValue}>{typeof dog.daysInFoster === 'number' ? dog.daysInFoster : '—'}</div>
                            </div>
                            <div className={styles.stat}>
                              <div className={styles.statLabel}>Open tasks</div>
                              <div className={styles.statValue}>{activeTasks.length}</div>
                            </div>
                            <div className={styles.stat}>
                              <div
                                className={styles.statLabel}
                                title="Completed date from the Task Log when set; otherwise estimated last photo upload (log email date minus 5 days), scheduled, or retired."
                              >
                                Last photo (est.)
                              </div>
                              <div className={styles.statValue} style={{ fontSize: 14 }}>
                                {lastPhotoSubmitted ? formatDateShort(lastPhotoSubmitted) : '—'}
                              </div>
                            </div>
                            <div className={styles.stat}>
                              <div
                                className={styles.statLabel}
                                title="Completed date from the Task Log when set; otherwise estimated last survey (log email date minus 7 days), scheduled, or retired."
                              >
                                Last survey (est.)
                              </div>
                              <div className={styles.statValue} style={{ fontSize: 14 }}>
                                {lastSurveySubmitted ? formatDateShort(lastSurveySubmitted) : '—'}
                              </div>
                            </div>
                            <div className={styles.stat}>
                              <div className={styles.statLabel} title="Shelter Manager movement date (not Task Log)">
                                Movement
                              </div>
                              <div className={styles.statValue} style={{ fontSize: 14 }}>{formatDateShort(dog.lastUpdate)}</div>
                            </div>
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div className={styles.tabPanel}>
                    {foster.dogs.map(dog => {
                  const tasks = fosterTasksByDogId.get(dog.id) ?? []

                  return (
                    <section key={dog.id} className={styles.card}>
                      <div className={styles.dogHeader}>
                        <h3 className={styles.sectionTitle} style={{ margin: 0 }}>{dog.name}</h3>
                        <StatusBadge status={dog.status} />
                      </div>
                      {tasks.length > 0 && (
                        <div className={layoutStyles.tableEmbedScroll}>
                        <table className={layoutStyles.table}>
                          <thead>
                            <tr>
                              <th>Task</th>
                              <th title="When the foster likely last submitted for this milestone: Completed date if logged; otherwise Task Log email date minus 5 days (photos) or 7 days (surveys). Hover the cell to see the raw log date.">
                                Last submission (est.)
                              </th>
                              <th>Last follow-up</th>
                              <th>Completed</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tasks.map((t, i) => {
                              const pendingSendDate = !t.emailSentDate && dog.lastUpdate && t.triggerDay
                                ? addDaysYmd(dog.lastUpdate, t.triggerDay)
                                : ''
                              return (
                              <tr key={i}>
                                <td>{taskLabel(t.taskType)}</td>
                                <td>
                                  {t.emailSentDate ? (
                                    <span
                                      title={`Task Log email / reminder date: ${formatDateShort(t.emailSentDate)}. Shown value is the estimated last foster submission (${t.taskType.startsWith('PHOTOS') ? 'email date −5 days' : t.taskType.startsWith('SURVEY') ? 'email date −7 days' : 'same as log'}).`}
                                    >
                                      {formatDateShort(
                                        inferLastFosterSubmissionYmdFromEmailSent(t.emailSentDate, t.taskType) ??
                                          t.emailSentDate
                                      )}
                                    </span>
                                  ) : pendingSendDate ? (
                                    <span className={styles.pendingEmail}>
                                      Reminder pending — {formatDateShort(pendingSendDate)}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td>{t.followUpSent ? formatDateShort(t.followUpSent) : '—'}</td>
                                <td>
                                  {t.completedDate ? (
                                    t.driveLink ? (
                                      <a
                                        href={t.driveLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.driveLink}
                                        title="Open Drive folder"
                                      >
                                        {formatDateShort(t.completedDate)}
                                        <span aria-hidden="true" style={{ marginLeft: 6 }}>📁</span>
                                      </a>
                                    ) : (
                                      formatDateShort(t.completedDate)
                                    )
                                  ) : '—'}
                                </td>
                                <td><StatusBadge status={sheetTaskBadgeLabel(t.status)} /></td>
                              </tr>
                            )})}
                          </tbody>
                        </table>
                        </div>
                      )}
                      {tasks.length === 0 && (
                        <p className={styles.hint}>No tasks logged yet for {dog.name}.</p>
                      )}
                    </section>
                  )
                })}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className={styles.tabPanel}>
                    <section className={styles.card}>
                      <ApplicantNotesCard email={emailFromSlug} />
                    </section>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className={styles.tabPanel}>
                    <FosterHistoryPanel
                      email={emailFromSlug}
                      sectionClassName={styles.card}
                      sectionTitleClassName={styles.sectionTitle}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
      </DashboardShell>
    </ProtectedRoute>
  )
}
