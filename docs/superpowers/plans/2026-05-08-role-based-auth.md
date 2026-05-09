# Role-Based Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate portal access behind a Firestore allowlist so only users added by an admin can log in, and give admins a UI to manage that list.

**Architecture:** Firestore `allowedUsers` collection stores email → role mappings. `AuthProvider` checks the allowlist after every Firebase Auth sign-in and on page refresh; unauthorized users are immediately signed out. A new `/admin/users` page (behind `AdminRoute`) lets admins add and remove users.

**Tech Stack:** Next.js 14 App Router, Firebase Auth, Firestore (firebase v12), CSS Modules, TypeScript

> **Note:** No test framework is configured. Each task ends with a manual verification step instead of automated tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `firebase.js` | Export `db` (Firestore instance) |
| Create | `app/lib/allowedUsers.ts` | Firestore CRUD helpers for `allowedUsers` collection |
| Modify | `app/components/AuthProvider.tsx` | Post-login allowlist check; `role` in context |
| Modify | `app/components/ProtectedRoute.tsx` | Add `AdminRoute` export; extract `LoadingScreen` |
| Modify | `app/login/page.tsx` | Remove "Sign Up here" link |
| Modify | `app/signup/page.tsx` | Check allowlist before creating Firebase Auth account |
| Create | `app/admin/users/adminUsers.module.css` | Styles for user management page |
| Create | `app/admin/users/page.tsx` | Admin user management UI |
| Modify | `app/candidates/page.tsx` | Add conditional admin nav link |
| Modify | `app/overview/page.tsx` | Add conditional admin nav link |
| Modify | `app/fosters/overview/page.tsx` | Add conditional admin nav link |
| Modify | `app/fosters/actions/page.tsx` | Add conditional admin nav link |

---

## Task 1: Add Firestore to firebase.js

**Files:**
- Modify: `firebase.js`

- [ ] **Step 1: Add the Firestore export**

Replace the entire contents of `firebase.js` with:

```js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: no TypeScript or module errors. (The app isn't wired to use `db` yet — that's next.)

- [ ] **Step 3: Commit**

```bash
git add firebase.js
git commit -m "feat: add Firestore export to firebase.js"
```

---

## Task 2: Create Firestore allowedUsers helpers

**Files:**
- Create: `app/lib/allowedUsers.ts`

- [ ] **Step 1: Create the helper module**

Create `app/lib/allowedUsers.ts`:

```ts
import {
  doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase'

export type UserRole = 'admin' | 'user'

export type AllowedUser = {
  email: string
  role: UserRole
  addedAt: { seconds: number; nanoseconds: number } | null
  addedBy: string
}

export async function getAllowedUser(email: string): Promise<AllowedUser | null> {
  const normalized = email.trim().toLowerCase()
  const snap = await getDoc(doc(db, 'allowedUsers', normalized))
  return snap.exists() ? (snap.data() as AllowedUser) : null
}

export async function listAllowedUsers(): Promise<AllowedUser[]> {
  const snap = await getDocs(collection(db, 'allowedUsers'))
  return snap.docs.map(d => d.data() as AllowedUser)
}

export async function addAllowedUser(
  email: string,
  role: UserRole,
  addedBy: string
): Promise<void> {
  const normalized = email.trim().toLowerCase()
  await setDoc(doc(db, 'allowedUsers', normalized), {
    email: normalized,
    role,
    addedAt: serverTimestamp(),
    addedBy,
  })
}

export async function removeAllowedUser(email: string): Promise<void> {
  await deleteDoc(doc(db, 'allowedUsers', email.trim().toLowerCase()))
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run build
```

Expected: compiles cleanly. `getAllowedUser`, `listAllowedUsers`, `addAllowedUser`, `removeAllowedUser` are the four functions exported — check all appear in build output with no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/lib/allowedUsers.ts
git commit -m "feat: add Firestore allowedUsers CRUD helpers"
```

---

## Task 3: Update AuthProvider with allowlist check and role

**Files:**
- Modify: `app/components/AuthProvider.tsx`

- [ ] **Step 1: Replace AuthProvider with allowlist-aware version**

Replace the full contents of `app/components/AuthProvider.tsx`:

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '@/firebase'
import { getAllowedUser, UserRole } from '@/app/lib/allowedUsers'

type AuthContextType = {
  user: User | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const allowed = await getAllowedUser(firebaseUser.email)
        if (!allowed) {
          await firebaseSignOut(auth)
          setUser(null)
          setRole(null)
        } else {
          setUser(firebaseUser)
          setRole(allowed.role)
        }
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const allowed = await getAllowedUser(cred.user.email!)
    if (!allowed) {
      await firebaseSignOut(auth)
      throw new Error("You don't have access to this portal. Contact an admin.")
    }
  }

  const signUp = async (email: string, password: string) => {
    const allowed = await getAllowedUser(email)
    if (!allowed) {
      throw new Error('Your email is not approved for access. Contact an admin.')
    }
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
```

> **Why two checks?** `signIn()` checks Firestore so the login form can surface a useful error message immediately. `onAuthStateChanged` checks on page refresh so sessions from before the allowlist existed are also blocked.

- [ ] **Step 2: Verify TypeScript**

```bash
npm run build
```

Expected: `role` is now part of the context type — if any page destructures `useAuth()` and TypeScript complains, that's expected to resolve in later tasks (we're only adding, not removing fields).

- [ ] **Step 3: Commit**

```bash
git add app/components/AuthProvider.tsx
git commit -m "feat: gate signIn/signUp behind Firestore allowlist, expose role in auth context"
```

---

## Task 4: Add AdminRoute to ProtectedRoute

**Files:**
- Modify: `app/components/ProtectedRoute.tsx`

- [ ] **Step 1: Replace ProtectedRoute with AdminRoute added**

Replace the full contents of `app/components/ProtectedRoute.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontSize: '18px',
      color: '#666',
    }}>
      Loading...
    </div>
  )
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) return <LoadingScreen />
  if (!user) return null
  return <>{children}</>
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login')
      else if (role !== 'admin') router.push('/overview')
    }
  }, [user, role, loading, router])

  if (loading) return <LoadingScreen />
  if (!user || role !== 'admin') return null
  return <>{children}</>
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: clean compile. `AdminRoute` is exported as a named export; `ProtectedRoute` (default) is unchanged for existing pages.

- [ ] **Step 3: Commit**

```bash
git add app/components/ProtectedRoute.tsx
git commit -m "feat: add AdminRoute — redirects non-admins to /overview"
```

---

## Task 5: Update login page

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Remove "Sign Up here" link**

In `app/login/page.tsx`, find the footer paragraph with the signup link and replace it:

Old:
```tsx
                    <p className={styles.footer}>
                        Don&apos;t have an account?{' '}
                        <Link href="/signup" className={styles.signUpLink}>
                            Sign Up here
                        </Link>
                        .
                    </p>
```

New:
```tsx
                    <p className={styles.footer}>
                        Need access?{' '}
                        <a href="mailto:support@wagsandwalks.org" className={styles.signUpLink}>
                            Contact an admin
                        </a>
                        .
                    </p>
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: clean compile. The `Link` import may now be unused if no other `Link` components remain on the page — remove it if the linter flags it.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: replace signup link on login page with contact admin link"
```

---

## Task 6: Gate signup page behind allowlist

**Files:**
- Modify: `app/signup/page.tsx`

- [ ] **Step 1: Update the error message handling in handleSubmit**

The `signUp` function in `AuthProvider` now throws if the email isn't in the allowlist. The signup page's existing `catch` block will surface that error automatically. The only change needed is to add a specific check for the unapproved-email case so it shows the right message.

In `app/signup/page.tsx`, replace the `catch` block inside `handleSubmit`:

Old:
```tsx
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('This email is already registered')
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address')
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak')
            } else {
                setError(err.message || 'Failed to create account')
            }
        }
```

New:
```tsx
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('This email is already registered. Try logging in instead.')
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address')
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak')
            } else {
                setError(err.message || 'Failed to create account')
            }
        }
```

> The allowlist error (`"Your email is not approved..."`) comes through `err.message` and is displayed by the final `else` branch — no special case needed.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/signup/page.tsx
git commit -m "feat: signup blocked for emails not in allowlist via AuthProvider"
```

---

## Task 7: Create admin users page styles

**Files:**
- Create: `app/admin/users/adminUsers.module.css`

- [ ] **Step 1: Create the CSS module**

Create `app/admin/users/adminUsers.module.css`:

```css
.wrap {
  padding: 24px 32px;
  max-width: 860px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
  font-size: 14px;
}

.th {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 2px solid var(--border, #e5e7eb);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.td {
  padding: 12px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  color: var(--text, #111827);
}

.badgeAdmin {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: #fef3c7;
  color: #92400e;
}

.badgeUser {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: #e0f2fe;
  color: #075985;
}

.removeBtn {
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #fca5a5;
  background: #fff;
  color: #b91c1c;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.removeBtn:hover {
  background: #fee2e2;
}

.removeBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.addForm {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border, #e5e7eb);
}

.addFormTitle {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text, #111827);
}

.addFormRow {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.formGroup {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted, #6b7280);
}

.input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  width: 260px;
  outline: none;
}

.input:focus {
  border-color: #05aaaf;
  box-shadow: 0 0 0 2px rgba(5, 170, 175, 0.15);
}

.select {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  outline: none;
  cursor: pointer;
}

.addBtn {
  height: 36px;
  padding: 0 20px;
  border-radius: 6px;
  border: none;
  background: #05aaaf;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.addBtn:hover {
  background: #0399a0;
}

.addBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feedback {
  margin-top: 12px;
  font-size: 13px;
}

.feedbackError {
  color: #b91c1c;
}

.feedbackSuccess {
  color: #065f46;
}

.empty {
  color: var(--text-muted, #6b7280);
  font-size: 14px;
  padding: 24px 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/users/adminUsers.module.css
git commit -m "feat: add admin users page styles"
```

---

## Task 8: Create admin users page

**Files:**
- Create: `app/admin/users/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/admin/users/page.tsx`:

```tsx
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
            {isLoading ? (
              <p className={styles.empty}>Loading users…</p>
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
                  {users.length === 0 && (
                    <tr>
                      <td className={styles.td} colSpan={5}>
                        <span className={styles.empty}>No users found.</span>
                      </td>
                    </tr>
                  )}
                  {users.map(u => (
                    <tr key={u.email}>
                      <td className={styles.td}>{u.email}</td>
                      <td className={styles.td}>
                        <span className={u.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}>
                          {u.role}
                        </span>
                      </td>
                      <td className={styles.td}>{u.addedBy}</td>
                      <td className={styles.td}>{formatDate(u.addedAt)}</td>
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

            <div className={styles.addForm}>
              <p className={styles.addFormTitle}>Add a user</p>
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
    </AdminRoute>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: clean compile.

- [ ] **Step 3: Commit**

```bash
git add app/admin/users/page.tsx app/admin/users/adminUsers.module.css
git commit -m "feat: add /admin/users page for managing portal access"
```

---

## Task 9: Add admin nav link to existing sidebar pages

Each page duplicates the sidebar. Add the admin nav link to all four remaining pages. The change is identical in each.

**Files:**
- Modify: `app/overview/page.tsx`
- Modify: `app/candidates/page.tsx`
- Modify: `app/fosters/overview/page.tsx`
- Modify: `app/fosters/actions/page.tsx`

- [ ] **Step 1: Update app/overview/page.tsx**

Add `role` to the `useAuth()` destructure. Find the line:
```tsx
    const { user, signOut } = useAuth()
```
Replace with:
```tsx
    const { user, role, signOut } = useAuth()
```

Then find the Fosters nav link in the sidebar JSX (the last `<Link>` in the nav):
```tsx
            <Link
              href="/fosters/overview"
              className={`${layoutStyles.navItem} ${pathname?.startsWith('/fosters') ? layoutStyles.navItemActive : ''}`}
            >
              <img src="/assets/fosters.svg" alt="" width={18} height={18} />
              Fosters
            </Link>
```

Add immediately after it:
```tsx
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
```

- [ ] **Step 2: Update app/candidates/page.tsx**

Note: this page imports `styles` (not `layoutStyles`) for the nav classes.

Add `role` to `useAuth()` destructure. Find:
```tsx
    const { user, signOut } = useAuth()
```
Replace with:
```tsx
    const { user, role, signOut } = useAuth()
```

Find the last nav `<Link>` (Fosters link) and add after it:
```tsx
            {role === 'admin' && (
              <Link
                href="/admin/users"
                className={`${styles.navItem} ${pathname?.startsWith('/admin') ? styles.navItemActive : ''}`}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M3 15c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Users
              </Link>
            )}
```

- [ ] **Step 3: Update app/fosters/overview/page.tsx**

Add `role` to `useAuth()` destructure. Find:
```tsx
  const { user, signOut } = useAuth()
```
Replace with:
```tsx
  const { user, role, signOut } = useAuth()
```

Find the Fosters nav `<Link>` and add the admin link after it (same snippet as overview, using `layoutStyles`).

- [ ] **Step 4: Update app/fosters/actions/page.tsx**

Add `role` to `useAuth()` destructure. Find:
```tsx
  const { user, signOut } = useAuth()
```
Replace with:
```tsx
  const { user, role, signOut } = useAuth()
```

Find the Fosters nav `<Link>` and add the admin link after it (same snippet as overview, using `layoutStyles`).

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: clean compile across all four pages.

- [ ] **Step 6: Commit**

```bash
git add app/overview/page.tsx app/candidates/page.tsx app/fosters/overview/page.tsx app/fosters/actions/page.tsx
git commit -m "feat: show admin Users nav link for admin-role users"
```

---

## Task 10: Bootstrap first admin & set Firestore security rules

This task has no code changes — it's the manual setup required before the feature works in production.

- [ ] **Step 1: Enable Firestore in Firebase console**

1. Go to [Firebase console](https://console.firebase.google.com) → select the Wags & Walks project
2. Left sidebar → **Firestore Database** → **Create database**
3. Choose **Production mode** → select a region (e.g. `us-central1`) → **Done**

- [ ] **Step 2: Seed the first admin**

1. In Firestore → **Start collection** → Collection ID: `allowedUsers` → **Next**
2. Document ID: Ashley's email address (lowercase, e.g. `ashley@wagsandwalks.org`)
3. Add fields:
   - `email` (string): `ashley@wagsandwalks.org`
   - `role` (string): `admin`
   - `addedAt` (timestamp): (use current timestamp)
   - `addedBy` (string): `system`
4. Click **Save**
5. Repeat for any other initial users (set `role` to `user` for non-admins)

- [ ] **Step 3: Set Firestore security rules**

In Firebase console → Firestore → **Rules** tab. Replace default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /allowedUsers/{email} {
      allow get: if request.auth != null && (
        request.auth.token.email == email ||
        get(/databases/$(database)/documents/allowedUsers/$(request.auth.token.email)).data.role == 'admin'
      );
      allow list: if request.auth != null &&
        get(/databases/$(database)/documents/allowedUsers/$(request.auth.token.email)).data.role == 'admin';
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/allowedUsers/$(request.auth.token.email)).data.role == 'admin';
    }
  }
}
```

Click **Publish**.

> **Note:** These rules use `get` and `list` separately because `list` (querying the whole collection for the admin page) doesn't bind `email` — the combined `read` rule in the spec wouldn't work for listing. These rules are the correct version.

- [ ] **Step 4: Manual smoke test**

1. `npm run dev`
2. Navigate to `/login` — verify "Sign Up here" link is gone
3. Log in with an email that is NOT in `allowedUsers` — expect "You don't have access to this portal" error
4. Log in with the seeded admin email — expect redirect to `/overview` and "Users" nav link visible in sidebar
5. Navigate to `/admin/users` — expect user list with the seeded admin
6. Add a test user email via the form (role: user) — expect it appears in the table
7. Remove the test user — expect it disappears from the table
8. Log out, log in as the test user email (if a Firebase Auth account exists for it) — expect access granted
9. Navigate to `/admin/users` as the non-admin user — expect redirect to `/overview`

- [ ] **Step 5: Final commit**

```bash
git add docs/superpowers/plans/2026-05-08-role-based-auth.md
git commit -m "docs: add role-based auth implementation plan"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Firestore `allowedUsers` collection with email/role/addedAt/addedBy — Task 2
- ✅ Post-login Firestore check + sign-out if not found — Task 3
- ✅ `role` in AuthProvider context — Task 3
- ✅ `AdminRoute` — Task 4
- ✅ Login page signup link removed — Task 5
- ✅ Signup page gated by allowlist — Task 6
- ✅ `/admin/users` page with table + add + remove — Task 8
- ✅ Admin nav link visible for admins only — Tasks 8 & 9
- ✅ Bootstrap instructions — Task 10
- ✅ Firestore security rules — Task 10
- ✅ Out of scope (password invite, Remember Me, Firebase Auth deletion) — not included

**Firestore rules note:** Spec used `allow read` (covers `get` + `list`). Correct rules split these because `list` doesn't bind the `{email}` wildcard — updated in Task 10.
