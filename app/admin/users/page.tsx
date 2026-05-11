'use client'

import { useEffect, useState } from 'react'
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
import layoutStyles from '../../candidates/candidates.module.css'
import styles from './adminUsers.module.css'

function formatDate(ts: AllowedUser['addedAt']): string {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AllowedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('user')
  const [submitting, setSubmitting] = useState(false)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null)

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

  useEffect(() => { loadUsers() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim() || !user?.email) return
    setSubmitting(true)
    setFeedback(null)
    try {
      await addAllowedUser(newEmail.trim(), newRole, user.email)
      setNewEmail('')
      setNewRole('user')
      setFeedback({ kind: 'success', msg: `${newEmail.trim()} added as ${newRole}.` })
      await loadUsers()
    } catch {
      setFeedback({ kind: 'error', msg: 'Failed to add user. Check the email and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(email: string) {
    if (email === user?.email) {
      setFeedback({ kind: 'error', msg: "You can't remove yourself." })
      return
    }
    setRemovingEmail(email)
    setFeedback(null)
    try {
      await removeAllowedUser(email)
      setFeedback({ kind: 'success', msg: `${email} removed.` })
      await loadUsers()
    } catch {
      setFeedback({ kind: 'error', msg: 'Failed to remove user.' })
    } finally {
      setRemovingEmail(null)
    }
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

          <div className={styles.wrap}>
            {/* Users table panel */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Portal users</h2>
                {!isLoading && <span className={styles.panelCount}>{users.length} {users.length === 1 ? 'user' : 'users'}</span>}
              </div>
              {isLoading ? (
                <p className={styles.empty}>Loading users…</p>
              ) : users.length === 0 ? (
                <p className={styles.empty}>No users yet.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Email</th>
                      <th className={styles.th}>Role</th>
                      <th className={styles.th}>Added by</th>
                      <th className={styles.th}>Date added</th>
                      <th className={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.email} className={styles.tr}>
                        <td className={`${styles.td} ${styles.emailCell}`}>{u.email}</td>
                        <td className={styles.td}>
                          <span className={u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}>
                            {u.role}
                          </span>
                        </td>
                        <td className={`${styles.td} ${styles.addedByCell}`}>{u.addedBy}</td>
                        <td className={`${styles.td} ${styles.addedByCell}`}>{formatDate(u.addedAt)}</td>
                        <td className={styles.td}>
                          <button
                            className={styles.removeBtn}
                            disabled={removingEmail === u.email || u.email === user?.email?.toLowerCase()}
                            onClick={() => handleRemove(u.email)}
                          >
                            {removingEmail === u.email ? 'Removing…' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add user panel */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Add a user</h2>
              </div>
              <div className={styles.addForm}>
                <form onSubmit={handleAdd}>
                  <div className={styles.addFormRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="newEmail">Email</label>
                      <input
                        id="newEmail"
                        type="email"
                        required
                        className={styles.input}
                        placeholder="user@wagsandwalks.org"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="newRole">Role</label>
                      <select
                        id="newRole"
                        className={styles.select}
                        value={newRole}
                        onChange={e => setNewRole(e.target.value as UserRole)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <button type="submit" className={styles.addBtn} disabled={submitting}>
                      {submitting ? 'Adding…' : 'Add User'}
                    </button>
                  </div>
                </form>
                {feedback && (
                  <p className={`${styles.feedback} ${feedback.kind === 'error' ? styles.feedbackError : styles.feedbackSuccess}`}>
                    {feedback.msg}
                  </p>
                )}
              </div>
            </div>
          </div>
      </DashboardShell>
    </AdminRoute>
  )
}
