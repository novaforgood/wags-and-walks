'use client'

import type { User } from 'firebase/auth'
import type { UserRole } from '@/app/lib/allowedUsers'
import styles from '@/app/candidates/candidates.module.css'

function LogoutIcon() {
  return (
    <svg
      className={styles.profileLogoutIcon}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SidebarProfile({
  signOut,
}: {
  user?: User | null
  role?: UserRole | null
  signOut: () => void | Promise<void>
}) {
  return (
    <div className={styles.sidebarProfile}>
      <button type="button" className={styles.profileLogout} onClick={() => void signOut()}>
        <LogoutIcon />
        Logout
      </button>
    </div>
  )
}
