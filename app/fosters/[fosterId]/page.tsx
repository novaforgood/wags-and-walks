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
import type { TaskRow } from '@/app/lib/taskTypes'
import NotesCard from '@/app/components/NotesCard'
import EmailComposeTrigger from '@/app/components/EmailComposeTrigger'
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
    status === 'Good' ? styles.badgeGood :
    status === 'Completed' ? styles.badgeCompleted :
    status === 'Retired' ? styles.badgeRetired :
    styles.badgeUnknown
  return <span className={cls}>{status || 'Good'}</span>
}

function sheetTaskBadgeLabel(status: TaskRow['status']): string {
  switch (status) {
    case 'good':
      return 'Good'
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

function deriveScheduledDateForSnooze(task: TaskRow) {
  if (task.snoozeUntil) return task.snoozeUntil
  if (task.scheduledDate) return task.scheduledDate
  const latestSent = task.followUpSent || task.emailSentDate
  if (latestSent) return addDaysYmd(latestSent, 3)
  return ''
}

function ScheduledEmailsSection({
  foster,
  tasks,
  allTasks,
  onTasksChange,
}: {
  foster: FosterDirectoryItem
  tasks: TaskRow[]
  allTasks: TaskRow[]
  onTasksChange: (rows: TaskRow[]) => void
}) {
  const activeTasks = tasks.filter(t => t.status !== 'retired' && t.status !== 'completed')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  function keyFor(t: TaskRow) { return `${t.animalId}|${t.taskType}` }

  async function persist(t: TaskRow, scheduledEmail: string) {
    const k = keyFor(t)
    setSavingKey(k)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animalId: t.animalId, taskType: t.taskType, scheduledEmail }),
      })
      const data = await res.json().catch(() => ({ success: false }))
      if (!data?.success) throw new Error(data?.error || 'Failed to save')
      onTasksChange(allTasks.map(r =>
        r.animalId === t.animalId && r.taskType === t.taskType ? { ...r, scheduledEmail } : r
      ))
    } finally {
      setSavingKey(null)
    }
  }

  async function snooze(t: TaskRow, days: number) {
    const k = keyFor(t)
    setSavingKey(k)
    try {
      // Apps Script snoozeTask computes `today + days`, so translate the desired
      // base date (scheduled date) into an offset-from-today.
      const base = deriveScheduledDateForSnooze(t)
      const baseDate = parseYmdOrDate(base)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const offsetFromToday = baseDate
        ? Math.round((baseDate.getTime() - today.getTime()) / 86400000)
        : 0
      const effectiveDays = offsetFromToday + days
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'snooze',
          animalId: t.animalId,
          taskType: t.taskType,
          days: effectiveDays,
          scheduledDate: base,
        }),
      })
      const data = await res.json().catch(() => ({ success: false })) as { success?: boolean; snoozeUntil?: string; error?: string }
      if (!data?.success) throw new Error(data?.error || 'Failed to snooze')
      const until = data.snoozeUntil ?? ''
      onTasksChange(allTasks.map(r =>
        r.animalId === t.animalId && r.taskType === t.taskType ? { ...r, snoozeUntil: until } : r
      ))
    } finally {
      setSavingKey(null)
    }
  }

  if (activeTasks.length === 0) {
    return (
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Scheduled Emails</h3>
        <p className={styles.hint}>No active tasks for {foster.fosterName}.</p>
      </section>
    )
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.sectionTitle}>Scheduled Emails</h3>
      <p className={styles.hint} style={{ marginBottom: 14, fontSize: 13 }}>
        Each active task has a default email queued for the next follow-up. Edit it below or cancel to clear.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeTasks.map(t => {
          const k = keyFor(t)
          const isEditing = editingKey === k
          const isSaving = savingKey === k
          const empty = !t.scheduledEmail.trim()
          return (
            <div
              key={k}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 8, padding: 14,
                background: empty ? '#fafafa' : '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>{t.dogName}</strong>
                <span style={{ fontSize: 13, color: '#64748b' }}>{taskLabel(t.taskType)}</span>
                <StatusBadge status={sheetTaskBadgeLabel(t.status)} />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {!isEditing && (
                    <button
                      onClick={() => { setEditingKey(k); setDraft(t.scheduledEmail) }}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
                    >
                      Edit
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      disabled={isSaving}
                      onClick={() => snooze(t, 3)}
                      title="Push next follow-up out 3 days"
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500, opacity: isSaving ? 0.5 : 1 }}
                    >
                      Snooze +3 days
                    </button>
                  )}
                  {!isEditing && !empty && (
                    <button
                      disabled={isSaving}
                      onClick={() => { if (confirm('Clear this scheduled email?')) persist(t, '') }}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 13, cursor: 'pointer', fontWeight: 500, opacity: isSaving ? 0.5 : 1 }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              {!isEditing && t.snoozeUntil && (
                <div style={{ fontSize: 12, color: '#a16207', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 10px', marginBottom: 8, display: 'inline-block' }}>
                  💤 Snoozed until {t.snoozeUntil}
                </div>
              )}
              {isEditing ? (
                <>
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    rows={6}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      onClick={() => setEditingKey(null)}
                      disabled={isSaving}
                      style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
                    >
                      Discard
                    </button>
                    <button
                      onClick={async () => { await persist(t, draft); setEditingKey(null) }}
                      disabled={isSaving}
                      style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#4a9d8f', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: isSaving ? 0.6 : 1 }}
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              ) : (
                <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 13, color: empty ? '#94a3b8' : '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {empty ? '(cleared — no email queued)' : t.scheduledEmail}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
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

  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'communication' | 'notes' | 'history'>('overview')

  useEffect(() => {
    const tab = searchParams.get('tab')
    const map = {
      overview: 'overview',
      tasks: 'tasks',
      communication: 'communication',
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

            {isLoadingDogs && <div className={layoutStyles.loadingContainer}>Loading foster details...</div>}
            {dogsError && <div className={layoutStyles.errorText}>{dogsError}</div>}
            {!isLoadingDogs && !dogsError && !foster && (
              <div className={styles.card}>No foster record found for this profile.</div>
            )}

            {!isLoadingDogs && foster && (
              <>
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
                    { id: 'communication', label: 'Communication' },
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
                      const lastEmailSent = tasks.map(t => t.emailSentDate).filter(Boolean).sort().at(-1)
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
                              <div className={styles.statLabel}>Last email</div>
                              <div className={styles.statValue} style={{ fontSize: 14 }}>{lastEmailSent ? formatDateShort(lastEmailSent) : '—'}</div>
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
                            {tasks.map((t, i) => {
                              const pendingSendDate = !t.emailSentDate && dog.lastUpdate && t.triggerDay
                                ? addDaysYmd(dog.lastUpdate, t.triggerDay)
                                : ''
                              return (
                              <tr key={i}>
                                <td>{taskLabel(t.taskType)}</td>
                                <td>
                                  {t.emailSentDate ? formatDateShort(t.emailSentDate) : (
                                    pendingSendDate ? (
                                      <span className={styles.pendingEmail}>
                                        Email pending — {formatDateShort(pendingSendDate)}
                                      </span>
                                    ) : '—'
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
                      )}
                      {tasks.length === 0 && (
                        <p className={styles.hint}>No tasks logged yet for {dog.name}.</p>
                      )}
                    </section>
                  )
                })}
                  </div>
                )}

                {activeTab === 'communication' && (
                  <div className={styles.tabPanel}>
                    {emailFromSlug && (
                      <section className={styles.card} style={{ marginBottom: 16 }}>
                        <h3 className={styles.sectionTitle}>Email</h3>
                        <EmailComposeTrigger email={emailFromSlug} recipientName={foster.fosterName} />
                      </section>
                    )}
                    <ScheduledEmailsSection
                      foster={foster}
                      tasks={Array.from(fosterTasksByDogId.values()).flat()}
                      onTasksChange={setTaskRows}
                      allTasks={taskRows}
                    />
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className={styles.tabPanel}>
                    <section className={styles.card}>
                      <NotesCard email={emailFromSlug} />
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
              </>
            )}
          </div>
      </DashboardShell>
    </ProtectedRoute>
  )
}