'use client'

import Link from 'next/link'
import type { UserRole } from '@/app/lib/allowedUsers'
import styles from '@/app/candidates/candidates.module.css'

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={styles.accountNavIcon}>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className={styles.accountNavIcon}>
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 15c0-3.314 2.686-5 6-5s6 1.686 6 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SidebarAccountSection({
  pathname,
  role,
}: {
  pathname: string | null
  role: UserRole | null
}) {
  const settingsActive = pathname === '/settings'
  const usersActive = pathname?.startsWith('/admin') ?? false

  return (
    <div className={styles.sidebarAccount}>
      <div className={styles.sidebarAccountLabel}>Account</div>
      <nav className={styles.sidebarAccountNav} aria-label="Account menu">
        <Link
          href="/settings"
          className={`${styles.navItem} ${settingsActive ? styles.navItemActive : ''}`}
        >
          <IconSettings />
          Settings
        </Link>
        {role === 'admin' && (
          <Link
            href="/admin/users"
            className={`${styles.navItem} ${usersActive ? styles.navItemActive : ''}`}
          >
            <IconUsers />
            Users
          </Link>
        )}
      </nav>
    </div>
  )
}
