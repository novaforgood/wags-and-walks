'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { DashboardShell } from '@/app/components/DashboardShell'
import { useAuth } from '@/app/components/AuthProvider'
import { getAuthErrorMessage } from '@/app/lib/authErrors'
import layoutStyles from '@/app/candidates/candidates.module.css'
import styles from './settings.module.css'

const SUPPORT_EMAIL = 'novaforgood@gmail.com'
const SUPPORT_SUBJECT = 'Wags & Walks Portal — Support Request'

type TabKey = 'personal' | 'security' | 'help'

const TABS: { key: TabKey; label: string; title: string; subtitle: string }[] = [
  {
    key: 'personal',
    label: 'Personal Info',
    title: 'Personal Info',
    subtitle: 'Your profile details and account identifiers.',
  },
  {
    key: 'security',
    label: 'Login & Security',
    title: 'Login & Security',
    subtitle: 'Manage your password and account deletion.',
  },
  {
    key: 'help',
    label: 'Help & Support',
    title: 'Help & Support',
    subtitle: 'Reach the team for questions or issues.',
  },
]

function formatDate(value: string | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

type Feedback = { kind: 'success' | 'error'; msg: string } | null

function Row({
  label,
  children,
  action,
}: {
  label: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowValue}>{children}</div>
      </div>
      {action ? <div className={styles.rowAction}>{action}</div> : null}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, role, resetPassword, signOut, updateDisplayName } = useAuth()

  const [activeTab, setActiveTab] = useState<TabKey>('personal')

  const [resetState, setResetState] = useState<'idle' | 'sending'>('idle')
  const [resetFeedback, setResetFeedback] = useState<Feedback>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!deleteOpen && !editOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!deleting) setDeleteOpen(false)
        if (!editSaving) setEditOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [deleteOpen, editOpen, deleting, editSaving])

  const email = user?.email ?? ''
  const displayName = user?.displayName?.trim() || email.split('@')[0] || 'User'
  const createdAt = formatDate(user?.metadata.creationTime)
  const lastSignIn = formatDate(user?.metadata.lastSignInTime)

  const activeTabMeta = useMemo(() => TABS.find((t) => t.key === activeTab)!, [activeTab])

  const supportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`

  async function handleSendReset() {
    if (!email) {
      setResetFeedback({
        kind: 'error',
        msg: 'No email is associated with your account. Sign out and back in, then try again.',
      })
      return
    }
    setResetFeedback(null)
    setResetState('sending')
    try {
      await resetPassword(email)
      setResetFeedback({
        kind: 'success',
        msg: `Reset link sent to ${email}. Check your inbox — and your spam folder, since it comes from a no-reply Firebase address.`,
      })
    } catch (err: unknown) {
      // Surface to the console so we can diagnose the Firebase error code directly
      console.error('[settings] resetPassword failed', err)
      setResetFeedback({ kind: 'error', msg: getAuthErrorMessage(err, 'resetPassword') })
    } finally {
      setResetState('idle')
    }
  }

  function openEdit() {
    setEditName(user?.displayName?.trim() ?? '')
    setEditError('')
    setEditOpen(true)
  }

  function closeEdit() {
    if (editSaving) return
    setEditOpen(false)
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      await updateDisplayName(editName)
      setEditOpen(false)
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Could not update profile.')
    } finally {
      setEditSaving(false)
    }
  }

  function openDelete() {
    setDeleteConfirmEmail('')
    setDeleteError('')
    setDeleteOpen(true)
  }

  function closeDelete() {
    if (deleting) return
    setDeleteOpen(false)
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault()
    if (!user?.email) return
    if (deleteConfirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      setDeleteError('Email does not match your account.')
      return
    }
    setDeleting(true)
    setDeleteError('')
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/account/delete-self', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Account deletion failed.')
      }
      await signOut().catch(() => {})
      router.replace('/login')
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Account deletion failed.')
      setDeleting(false)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className={layoutStyles.topBar}>
          <h1 className={layoutStyles.topBarTitle}>Settings</h1>
          <div className={layoutStyles.topBarActions}>
            <NotificationPanel />
            <TopBarProfileMenu />
          </div>
        </div>

        <div className={styles.page}>
          {/* ── Toolbar with tab pills ── */}
          <div className={styles.toolbar} role="tablist" aria-label="Settings sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                className={`${styles.tabPill} ${activeTab === t.key ? styles.tabPillActive : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Main panel ── */}
          <section className={styles.panel} role="tabpanel" aria-label={activeTabMeta.title}>
            <header className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{activeTabMeta.title}</h2>
              <p className={styles.panelSubtitle}>{activeTabMeta.subtitle}</p>
            </header>

            <div className={styles.panelBody}>
              {activeTab === 'personal' && (
                <>
                  <Row
                    label="Name"
                    action={
                      <button type="button" className={styles.editLink} onClick={openEdit}>
                        Edit
                      </button>
                    }
                  >
                    {displayName}
                  </Row>

                  <Row label="Email">{email || '—'}</Row>

                  <Row label="Role">
                    <span
                      className={
                        role === 'admin'
                          ? `${styles.roleBadge} ${styles.roleBadgeAdmin}`
                          : `${styles.roleBadge} ${styles.roleBadgeUser}`
                      }
                    >
                      {role === 'admin' ? 'Admin' : role === 'user' ? 'User' : '—'}
                    </span>
                  </Row>

                  <Row label="Account Created">{createdAt}</Row>

                  <Row label="Last Sign-In">{lastSignIn}</Row>
                </>
              )}

              {activeTab === 'security' && (
                <>
                  {resetFeedback && (
                    <div
                      className={
                        resetFeedback.kind === 'success'
                          ? `${styles.notice} ${styles.noticeSuccess}`
                          : `${styles.notice} ${styles.noticeError}`
                      }
                      role={resetFeedback.kind === 'error' ? 'alert' : 'status'}
                    >
                      {resetFeedback.msg}
                    </div>
                  )}

                  <Row
                    label="Password"
                    action={
                      <button
                        type="button"
                        className={styles.editLink}
                        onClick={handleSendReset}
                        disabled={resetState === 'sending' || !email}
                      >
                        {resetState === 'sending' ? 'Sending…' : 'Send Reset Link'}
                      </button>
                    }
                  >
                    Reset via email link.
                  </Row>

                  <Row
                    label="Delete Account"
                    action={
                      <button
                        type="button"
                        className={`${styles.editLink} ${styles.editLinkDanger}`}
                        onClick={openDelete}
                      >
                        Delete
                      </button>
                    }
                  >
                    Permanently delete your account. Cannot be undone.
                  </Row>
                </>
              )}

              {activeTab === 'help' && (
                <Row
                  label="Contact The Team"
                  action={
                    <a className={styles.editLink} href={supportHref}>
                      Contact
                    </a>
                  }
                >
                  {SUPPORT_EMAIL}
                </Row>
              )}
            </div>
          </section>
        </div>

        {/* ── Edit Profile modal ── */}
        {editOpen && (
          <div
            className={styles.modalBackdrop}
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEdit()
            }}
          >
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
              <h2 id="edit-modal-title" className={styles.modalTitleNeutral}>Edit Profile</h2>
              <form onSubmit={handleEditSave} className={styles.modalForm}>
                <label className={styles.modalLabel} htmlFor="edit-name">Display name</label>
                <input
                  id="edit-name"
                  type="text"
                  className={styles.modalInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={email.split('@')[0] || 'Your name'}
                  autoComplete="off"
                  autoFocus
                  disabled={editSaving}
                  maxLength={80}
                />

                {editError && (
                  <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
                    {editError}
                  </div>
                )}

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={closeEdit}
                    disabled={editSaving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={editSaving}>
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Delete confirmation modal ── */}
        {deleteOpen && (
          <div
            className={styles.modalBackdrop}
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeDelete()
            }}
          >
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
              <h2 id="delete-modal-title" className={styles.modalTitle}>
                Delete Your Account?
              </h2>
              <p className={styles.modalBody}>
                This removes portal access and your Authentication record.
                {role === 'admin' && (
                  <>
                    {' '}You&apos;re an <strong>admin</strong> — make sure another admin exists first.
                  </>
                )}
              </p>
              <form onSubmit={handleDelete} className={styles.modalForm}>
                <label className={styles.modalLabel} htmlFor="confirm-email">
                  Type <strong>{email}</strong> to confirm
                </label>
                <input
                  id="confirm-email"
                  type="email"
                  className={styles.modalInput}
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  disabled={deleting}
                />

                {deleteError && (
                  <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
                    {deleteError}
                  </div>
                )}

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={closeDelete}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.btnDanger}
                    disabled={
                      deleting ||
                      deleteConfirmEmail.trim().toLowerCase() !== email.toLowerCase()
                    }
                  >
                    {deleting ? 'Deleting…' : 'Permanently Delete Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DashboardShell>
    </ProtectedRoute>
  )
}
