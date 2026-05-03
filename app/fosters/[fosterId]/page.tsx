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

type ScheduledEmail = {
  id: string
  title: string
  scheduledDate: string // ISO date string
  subject: string
  body: string
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

// --- Shared hover button styles injected once ---
const updatesButtonStyles = `
  .upd-btn { transition: background 0.15s; }
  .upd-btn-neutral:hover { background: #f3f4f6 !important; }
  .upd-btn-cancel:hover  { background: #fff1f1 !important; }
  .upd-btn-primary:hover { background: #3d8a7d !important; }
  .upd-btn-send:hover    { background: #3d8a7d !important; }
`

// --- Shared Email Modal (used for both Edit and Send Now) ---
type EmailModalProps = {
  title: string
  fosterEmail: string
  subject: string
  body: string
  primaryLabel: string
  onPrimary: (subject: string, body: string) => void
  onClose: () => void
  extraActions?: React.ReactNode
}

function EmailModal({ title, fosterEmail, subject: initSubject, body: initBody, primaryLabel, onPrimary, onClose, extraActions }: EmailModalProps) {
  const [subject, setSubject] = useState(initSubject)
  const [body, setBody] = useState(initBody)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <style>{updatesButtonStyles}</style>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '28px 32px', width: 480,
        maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', position: 'relative',
      }}>
        <button
          onClick={onClose}
          className="upd-btn upd-btn-neutral"
          style={{
            position: 'absolute', top: 14, right: 16, background: 'none',
            border: 'none', fontSize: 20, cursor: 'pointer', color: '#888', lineHeight: 1, borderRadius: 4,
          }}
          aria-label="Close"
        >×</button>

        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#888' }}>To: {fosterEmail}</p>

        <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>Subject</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db',
            fontSize: 14, marginBottom: 14, boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />

        <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>Message</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={5}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db',
            fontSize: 14, marginBottom: 20, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {extraActions}
          <button
            onClick={() => onPrimary(subject, body)}
            className="upd-btn upd-btn-primary"
            style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: '#4a9d8f', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 600,
            }}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Updates Section ---
type UpdatesSectionProps = {
  fosterEmail: string
  scheduledEmails: ScheduledEmail[]
  onEmailsChange: (emails: ScheduledEmail[]) => void
}

function UpdatesSection({ fosterEmail, scheduledEmails, onEmailsChange }: UpdatesSectionProps) {
  const [editingEmail, setEditingEmail] = useState<ScheduledEmail | null>(null)
  const [showSendNow, setShowSendNow] = useState(false)

  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toISOString()
  }

  function handleSave(updated: ScheduledEmail) {
    onEmailsChange(scheduledEmails.map(e => e.id === updated.id ? updated : e))
    setEditingEmail(null)
  }

  function handleCancelScheduled(id: string) {
    onEmailsChange(scheduledEmails.filter(e => e.id !== id))
    setEditingEmail(null)
  }

  function handleSnooze(email: ScheduledEmail) {
    const snoozed = { ...email, scheduledDate: addDays(email.scheduledDate, 3) }
    onEmailsChange(scheduledEmails.map(e => e.id === email.id ? snoozed : e))
    setEditingEmail(null)
  }

  function handleSendNow(_subject: string, _body: string) {
    // Wire to your send API here
    setShowSendNow(false)
  }

  return (
    <>
      <style>{updatesButtonStyles}</style>
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Updates</h3>

        {scheduledEmails.length === 0 && (
          <p className={styles.hint}>No scheduled emails.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scheduledEmails.map(email => (
            <div
              key={email.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                background: '#f9fafb', flexWrap: 'wrap', gap: 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: '#111827', flex: 1, minWidth: 140 }}>
                {email.title}
              </span>
              <span style={{ fontSize: 13, color: '#6b7280', marginRight: 12, whiteSpace: 'nowrap' }}>
                {formatDateShort(email.scheduledDate)}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setEditingEmail(email)}
                  className="upd-btn upd-btn-neutral"
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                    background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleCancelScheduled(email.id)}
                  className="upd-btn upd-btn-cancel"
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid #fca5a5',
                    background: '#fff', color: '#dc2626', fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSnooze(email)}
                  className="upd-btn upd-btn-neutral"
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                    background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  Snooze
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Send Email Now */}
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => setShowSendNow(true)}
            className="upd-btn upd-btn-send"
            style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: '#4a9d8f', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 600,
            }}
          >
            Send Email Now
          </button>
        </div>
      </section>

      {/* Edit scheduled email modal */}
      {editingEmail && (
        <EmailModal
          title="Edit Scheduled Email"
          fosterEmail={fosterEmail}
          subject={editingEmail.subject}
          body={editingEmail.body}
          primaryLabel="Save"
          onPrimary={(subject, body) => handleSave({ ...editingEmail, subject, body })}
          onClose={() => setEditingEmail(null)}
          extraActions={
            <>
              <button
                onClick={() => handleCancelScheduled(editingEmail.id)}
                className="upd-btn upd-btn-cancel"
                style={{
                  padding: '8px 16px', borderRadius: 7, border: '1px solid #fca5a5',
                  background: '#fff', color: '#dc2626', fontSize: 14, cursor: 'pointer', fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSnooze(editingEmail)}
                className="upd-btn upd-btn-neutral"
                style={{
                  padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db',
                  background: '#f9fafb', color: '#374151', fontSize: 14, cursor: 'pointer', fontWeight: 500,
                }}
              >
                Snooze (+3 days)
              </button>
            </>
          }
        />
      )}

      {/* Send Email Now modal */}
      {showSendNow && (
        <EmailModal
          title="Send Email"
          fosterEmail={fosterEmail}
          subject="Checking in!"
          body={`Hey *${fosterEmail.split('@')[0]}, checking in on ...`}
          primaryLabel="Send"
          onPrimary={handleSendNow}
          onClose={() => setShowSendNow(false)}
        />
      )}
    </>
  )
}

// --- Main Page ---
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

  // Scheduled emails state — in production these would be loaded from your API
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([
    {
      id: 'survey-1',
      title: 'Survey Reminder',
      scheduledDate: new Date('2026-05-02').toISOString(),
      subject: 'Foster Survey',
      body: 'Hey, checking in! Could you please fill out the foster survey?',
    },
    {
      id: 'photos-1',
      title: 'Photos Reminder',
      scheduledDate: new Date('2026-05-06').toISOString(),
      subject: 'Photo Upload Reminder',
      body: 'Hey, we\'d love to see some photos of your foster pup! Could you upload some when you get a chance?',
    },
  ])

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
                    <div><strong>Phone:</strong> {foster.fosterPhone || '—'}</div>
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

                {/* Current Fostering Situation */}
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

                {/* Updates — scheduled emails */}
                <UpdatesSection
                  fosterEmail={foster.fosterEmail ?? ''}
                  scheduledEmails={scheduledEmails}
                  onEmailsChange={setScheduledEmails}
                />

                <section className={styles.card}>
                  {/* Pass hideSendEmail to suppress the built-in Send Email button — add that prop to NotesCard */}
                  <NotesCard email={emailFromSlug} name={foster.fosterName} hideSendEmail />
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