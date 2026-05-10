'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import { AdminRoute } from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
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
  const pathname = usePathname()
  const { user, role, signOut } = useAuth()
  const [users, setUsers] = useState<AllowedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('user')
  const [submitting, setSubmitting] = useState(false)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null)
  const [navWidth, setNavWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('app_nav_sidebar_width_v1')
      const n = raw ? Number(raw) : NaN
      return Number.isFinite(n) ? Math.max(180, Math.min(280, n)) : 208
    } catch { return 208 }
  })
  const [isResizingNav, setIsResizingNav] = useState(false)
  const navStartXRef = useRef(0)
  const navStartWRef = useRef(208)

  useEffect(() => {
    try { localStorage.setItem('app_nav_sidebar_width_v1', String(navWidth)) } catch { /**/ }
  }, [navWidth])

  useEffect(() => {
    if (!isResizingNav) return
    const prev = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    function onMove(e: PointerEvent) {
      setNavWidth(Math.max(180, Math.min(280, navStartWRef.current + e.clientX - navStartXRef.current)))
    }
    function onUp() { setIsResizingNav(false) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      document.body.style.userSelect = prev
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isResizingNav])

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
      <div className={layoutStyles.pageWrapper} style={{ ['--app-sidebar-width' as any]: `${navWidth}px` }}>
        <aside className={layoutStyles.sidebar}>
          <div className={layoutStyles.sidebarLogo}>
            <Image src="/assets/logo.svg" alt="Wags & Walks" width={160} height={60} priority />
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
            {role === 'admin' && (
              <Link
                href="/admin/users"
                className={`${layoutStyles.navItem} ${pathname?.startsWith('/admin') ? layoutStyles.navItemActive : ''}`}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M3 15c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Users
              </Link>
            )}
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
              <button type="button" className={layoutStyles.profileLogout} onClick={signOut}>
                Log Out
              </button>
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
            <h1 className={layoutStyles.topBarTitle}>User Management</h1>
            <NotificationPanel />
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
        </div>
      </div>
    </AdminRoute>
  )
}
