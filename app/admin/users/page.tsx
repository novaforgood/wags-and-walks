'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/app/components/AuthProvider'
import { AdminRoute } from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import { DashboardShell } from '@/app/components/DashboardShell'
import {
  listAllowedUsers,
  addAllowedUser,
  removeAllowedUser,
  type AllowedUser,
  type UserRole,
} from '@/app/lib/allowedUsers'
import {
  PORTAL_INVITE_SUBJECT,
  buildPortalInviteEmail,
  buildPortalInviteEmailHtml,
} from '@/app/lib/portalInviteEmail'
import layoutStyles from '../../candidates/candidates.module.css'
import styles from './adminUsers.module.css'
import { friendlyNameFromEmail } from '@/app/lib/userDisplay'

type RoleFilter = 'all' | 'admin' | 'user'

const ROLE_OPTIONS: {
  value: UserRole
  label: string
  description: string
}[] = [
  {
    value: 'user',
    label: 'User',
    description: 'Can view and manage fosters',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full access including user management',
  },
]

function formatDate(ts: AllowedUser['addedAt']): string {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Heroicons outline `users` — 24×24 viewBox scales cleanly at 18px */
function IconUsersTwo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
    </svg>
  )
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  )
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      />
    </svg>
  )
}

function IconEnvelope({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <path d="m2 6 8 5 8-5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  )
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M12 3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M10 2v3M6 2v3M2 7h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 4v10M4 9h10" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  )
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968 3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  )
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AllowedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<RoleFilter>('all')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('user')
  const [submitting, setSubmitting] = useState(false)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const [pendingRemoveEmail, setPendingRemoveEmail] = useState<string | null>(null)
  const roleWrapRef = useRef<HTMLDivElement>(null)

  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users])
  const userCount = useMemo(() => users.filter((u) => u.role === 'user').length, [users])
  const filteredUsers = useMemo(() => {
    if (filter === 'admin') return users.filter((u) => u.role === 'admin')
    if (filter === 'user') return users.filter((u) => u.role === 'user')
    return users
  }, [users, filter])

  const selectedRoleMeta = ROLE_OPTIONS.find((o) => o.value === newRole)!

  useEffect(() => {
    if (!inviteOpen && !pendingRemoveEmail) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setInviteOpen(false)
        setRoleMenuOpen(false)
        setPendingRemoveEmail(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [inviteOpen, pendingRemoveEmail])

  useEffect(() => {
    if (!roleMenuOpen) return
    function onDocClick(e: MouseEvent) {
      if (!roleWrapRef.current?.contains(e.target as Node)) setRoleMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [roleMenuOpen])

  async function loadUsers() {
    setIsLoading(true)
    try {
      const list = await listAllowedUsers()
      list.sort((a, b) => a.email.localeCompare(b.email))
      setUsers(list)
    } catch {
      setFeedback({ kind: 'error', msg: 'Failed to load users.' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim() || !user?.email) return
    setSubmitting(true)
    setFeedback(null)
    try {
      const roleForAdded = newRole
      await addAllowedUser(newEmail.trim(), roleForAdded, user.email)
      const added = newEmail.trim()
      const signupUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/signup`

      let inviteOk = false
      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_single_email',
            to: added.toLowerCase(),
            subject: PORTAL_INVITE_SUBJECT,
            body: buildPortalInviteEmail({ signupUrl }),
            htmlBody: buildPortalInviteEmailHtml({ signupUrl }),
          }),
        })
        const data = await res.json().catch(() => null)
        inviteOk = res.ok && data?.success !== false
      } catch {
        inviteOk = false
      }

      setNewEmail('')
      setNewRole('user')
      setInviteOpen(false)
      setRoleMenuOpen(false)
      setFeedback({
        kind: 'success',
        msg: inviteOk
          ? `${added} added as ${roleForAdded}. An invitation email was sent to their inbox.`
          : `${added} added as ${roleForAdded}. Invitation email could not be sent — share this link manually: ${signupUrl}`,
      })
      await loadUsers()
    } catch {
      setFeedback({ kind: 'error', msg: 'Failed to add user. Check the email and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  function requestRemove(email: string) {
    if (email === user?.email?.toLowerCase()) {
      setFeedback({ kind: 'error', msg: "You can't remove yourself." })
      return
    }
    setFeedback(null)
    setPendingRemoveEmail(email)
  }

  async function performRemove(email: string) {
    if (!user) {
      setFeedback({ kind: 'error', msg: 'Not signed in.' })
      return
    }
    setRemovingEmail(email)
    setFeedback(null)
    try {
      const idToken = await user.getIdToken(true)
      const res = await fetch('/api/admin/remove-portal-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        code?: string
        deletedAuth?: boolean
        authDeleteError?: string
        error?: string
      }

      if (res.status === 503 && data?.code === 'ADMIN_SDK_CREDENTIALS_INVALID') {
        await removeAllowedUser(email)
        setFeedback({
          kind: 'success',
          msg: `${email} removed from the allow list. Firebase Admin credentials failed to parse — fix FIREBASE_SERVICE_ACCOUNT_JSON (valid JSON, usually one line in .env) or set FIREBASE_SERVICE_ACCOUNT_PATH to your downloaded key file, restart the dev server, then remove again to delete their Auth login.`,
        })
      } else if (res.status === 503 && data?.code === 'ADMIN_SDK_UNAVAILABLE') {
        await removeAllowedUser(email)
        setFeedback({
          kind: 'success',
          msg: `${email} removed from the allow list. This deployment still has no Firebase Admin key: add FIREBASE_SERVICE_ACCOUNT_JSON in your host’s environment (e.g. Vercel → Settings → Environment Variables), redeploy. Local .env only affects your machine — production needs its own value.`,
        })
      } else if (res.status === 401 || res.status === 403) {
        setFeedback({
          kind: 'error',
          msg: data.error || 'Not allowed to remove users (try signing out and back in).',
        })
      } else if (!res.ok) {
        try {
          await removeAllowedUser(email)
          setFeedback({
            kind: 'success',
            msg: `${email} removed from the allow list via backup path. Admin API error: ${data.error || res.status}. Their Auth account may still exist — configure FIREBASE_SERVICE_ACCOUNT_JSON and remove again, or delete them in Firebase Console → Authentication.`,
          })
        } catch {
          setFeedback({
            kind: 'error',
            msg: data.error || `Could not remove user (HTTP ${res.status}).`,
          })
        }
      } else if (data.deletedAuth) {
        setFeedback({
          kind: 'success',
          msg: `${email} removed from Firestore allow list and their Firebase Authentication account was deleted.`,
        })
      } else if (data.authDeleteError) {
        setFeedback({
          kind: 'success',
          msg: `${email} removed from the allow list. Sign-in account was not deleted: ${data.authDeleteError}`,
        })
      } else {
        setFeedback({
          kind: 'success',
          msg: `${email} removed from the allow list. They had no Firebase Auth account (never completed sign-up).`,
        })
      }
    } catch (e) {
      try {
        await removeAllowedUser(email)
        setFeedback({
          kind: 'success',
          msg: `${email} removed from the allow list (backup). If they still appear, check Firestore security rules for allowedUsers.`,
        })
      } catch {
        setFeedback({
          kind: 'error',
          msg: e instanceof Error ? e.message : 'Failed to remove user.',
        })
      }
    } finally {
      await loadUsers()
      setRemovingEmail(null)
      setPendingRemoveEmail(null)
    }
  }

  function openInvite() {
    setFeedback(null)
    setInviteOpen(true)
    setRoleMenuOpen(false)
  }

  function closeInvite() {
    setInviteOpen(false)
    setRoleMenuOpen(false)
  }

  return (
    <AdminRoute>
      <DashboardShell>
        <div className={layoutStyles.topBar}>
          <h1 className={layoutStyles.topBarTitle}>User Management</h1>
          <div className={layoutStyles.topBarActions}>
            <NotificationPanel />
            <TopBarProfileMenu />
          </div>
        </div>

        <div className={styles.dashboard}>
          <div className={styles.dashboardMain}>
            <div className={styles.toolbar}>
              <div className={styles.filterRow} role="tablist" aria-label="Filter by role">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'all'}
                  className={`${styles.filterPill} ${filter === 'all' ? styles.filterPillActive : ''}`}
                  onClick={() => setFilter('all')}
                >
                  <IconUsersTwo className={styles.filterIcon} />
                  All Users
                  <span className={styles.filterCount}>{users.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'admin'}
                  className={`${styles.filterPill} ${filter === 'admin' ? styles.filterPillActive : ''}`}
                  onClick={() => setFilter('admin')}
                >
                  <IconShield className={styles.filterIcon} />
                  Admins
                  <span className={styles.filterCount}>{adminCount}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'user'}
                  className={`${styles.filterPill} ${filter === 'user' ? styles.filterPillActive : ''}`}
                  onClick={() => setFilter('user')}
                >
                  <IconUser className={styles.filterIcon} />
                  Users
                  <span className={styles.filterCount}>{userCount}</span>
                </button>
              </div>
              <button type="button" className={styles.addUserBtn} onClick={openInvite}>
                <IconPlus />
                Add User
              </button>
            </div>

            {feedback && (
              <div className={styles.feedbackWrap}>
                <div
                  className={`${styles.feedback} ${feedback.kind === 'error' ? styles.feedbackError : styles.feedbackSuccess}`}
                  role={feedback.kind === 'error' ? 'alert' : 'status'}
                >
                  {feedback.msg}
                </div>
              </div>
            )}

            <div className={styles.panel}>
              <div className={styles.panelInner}>
                {isLoading ? (
                  <p className={styles.empty}>Loading users…</p>
                ) : users.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>No users yet</p>
                    <p className={styles.emptyHint}>Invite a staff member to get started using Add User.</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>No users found</p>
                    <p className={styles.emptyHint}>
                      No users match this filter. Try another tab or invite a staff member to get started.
                    </p>
                  </div>
                ) : (
                  <table className={styles.table}>
                    <colgroup>
                      <col className={styles.colUser} />
                      <col className={styles.colRole} />
                      <col className={styles.colAddedBy} />
                      <col className={styles.colDate} />
                      <col className={styles.colActions} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className={`${styles.th} ${styles.thUser}`} scope="col">
                          User
                        </th>
                        <th className={`${styles.th} ${styles.thRole}`} scope="col">
                          Role
                        </th>
                        <th className={`${styles.th} ${styles.thAddedBy}`} scope="col">
                          Added By
                        </th>
                        <th className={`${styles.th} ${styles.thDate}`} scope="col">
                          Date Added
                        </th>
                        <th className={`${styles.th} ${styles.thActions}`} scope="col">
                          <span className={styles.thActionsLabel}>Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.email} className={styles.tr}>
                          <td className={`${styles.td} ${styles.tdUser}`}>
                            <div className={styles.userCell}>
                              <span className={styles.avatar} aria-hidden>
                                {u.email.charAt(0).toUpperCase()}
                              </span>
                              <span className={styles.emailText}>{u.email}</span>
                            </div>
                          </td>
                          <td className={`${styles.td} ${styles.tdRole}`}>
                            <span
                              className={`${styles.rolePill} ${u.role === 'admin' ? styles.rolePillAdmin : styles.rolePillUser}`}
                            >
                              {u.role === 'admin' ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className={`${styles.td} ${styles.metaCell} ${styles.tdAddedBy}`}>
                            {friendlyNameFromEmail(u.addedBy)}
                          </td>
                          <td className={`${styles.td} ${styles.metaCell} ${styles.tdDate}`}>
                            <span className={styles.dateWithIcon}>
                              <IconCalendar className={styles.dateIcon} />
                              {formatDate(u.addedAt)}
                            </span>
                          </td>
                          <td className={`${styles.td} ${styles.actionsCell}`}>
                            <button
                              type="button"
                              className={styles.removeBtn}
                              disabled={removingEmail === u.email || u.email === user?.email?.toLowerCase()}
                              onClick={() => requestRemove(u.email)}
                              aria-label={`Remove ${u.email}`}
                            >
                              {removingEmail === u.email ? (
                                <span className={styles.removeLoading}>…</span>
                              ) : (
                                <IconTrash className={styles.removeIcon} />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            </div>
          </div>
      </DashboardShell>

      {pendingRemoveEmail && (
        <div
          className={styles.confirmBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingRemoveEmail(null)
          }}
        >
          <div
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-user-title" className={styles.confirmTitle}>
              Remove user?
            </h2>
            <p className={styles.confirmBody}>
              Remove{' '}
              <strong>{friendlyNameFromEmail(pendingRemoveEmail)}</strong> from the portal? They will lose access until
              invited again.
            </p>
            <p className={styles.confirmEmail}>{pendingRemoveEmail}</p>
            <div className={styles.confirmFooter}>
              <button type="button" className={styles.confirmCancel} onClick={() => setPendingRemoveEmail(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDanger}
                disabled={!!removingEmail}
                onClick={() => pendingRemoveEmail && void performRemove(pendingRemoveEmail)}
              >
                {removingEmail ? 'Removing…' : 'Remove user'}
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeInvite()
          }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleWrap}>
                <h2 id="invite-modal-title" className={styles.modalTitle}>
                  Add New Portal User
                </h2>
              </div>
              <button type="button" className={styles.modalClose} onClick={closeInvite} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAdd}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="invite-email">
                    Email Address
                  </label>
                  <div className={styles.inputWrap}>
                    <IconEnvelope className={styles.inputIcon} />
                    <input
                      id="invite-email"
                      type="email"
                      required
                      autoComplete="email"
                      className={styles.input}
                      placeholder="user@wagsandwalks.org"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <span className={styles.label} id="invite-role-label">
                    Role
                  </span>
                  <div className={styles.roleWrap} ref={roleWrapRef}>
                    <button
                      type="button"
                      className={`${styles.roleTrigger} ${roleMenuOpen ? styles.roleTriggerOpen : ''}`}
                      aria-haspopup="listbox"
                      aria-expanded={roleMenuOpen}
                      aria-labelledby="invite-role-label"
                      onClick={() => setRoleMenuOpen((o) => !o)}
                    >
                      <span className={styles.roleTriggerLeft}>
                        {newRole === 'admin' ? (
                          <IconShield className={styles.roleTriggerIcon} />
                        ) : (
                          <IconUser className={styles.roleTriggerIcon} />
                        )}
                        <span className={styles.roleTriggerText}>
                          <span className={styles.roleTriggerLabel}>{selectedRoleMeta.label}</span>
                          <span className={styles.roleTriggerDesc}>{selectedRoleMeta.description}</span>
                        </span>
                      </span>
                      <svg
                        className={`${styles.roleChevron} ${roleMenuOpen ? styles.roleChevronUp : ''}`}
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        fill="none"
                        aria-hidden
                      >
                        <path d="M5 7l4 4 4-4" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
                      </svg>
                    </button>
                    {roleMenuOpen && (
                      <div className={styles.roleMenu} role="listbox" aria-labelledby="invite-role-label">
                        {ROLE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={newRole === opt.value}
                            className={`${styles.roleOption} ${newRole === opt.value ? styles.roleOptionSelected : ''}`}
                            onClick={() => {
                              setNewRole(opt.value)
                              setRoleMenuOpen(false)
                            }}
                          >
                            {opt.value === 'admin' ? (
                              <IconShield className={styles.roleOptionIcon} />
                            ) : (
                              <IconUser className={styles.roleOptionIcon} />
                            )}
                            <span className={styles.roleOptionBody}>
                              <span className={styles.roleOptionLabel}>{opt.label}</span>
                              <span className={styles.roleOptionDesc}>{opt.description}</span>
                            </span>
                            {newRole === opt.value && (
                              <svg className={styles.roleOptionCheck} width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden>
                                <path d="M4 9l3 3 7-7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.modalCancel} onClick={closeInvite}>
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmit} disabled={submitting}>
                  <IconPlus />
                  {submitting ? 'Adding…' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminRoute>
  )
}
