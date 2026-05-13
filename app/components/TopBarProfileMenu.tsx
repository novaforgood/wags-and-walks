'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/app/components/AuthProvider'
import styles from './TopBarProfileMenu.module.css'

/** Single letter: first letter from display name, else first letter of email local-part (e.g. ashleyvarghese → A). */
function initialFromUser(displayName: string | null | undefined, email: string | null | undefined): string {
  const dn = displayName?.trim()
  if (dn) {
    const m = dn.match(/[a-zA-Z]/)
    if (m) return m[0].toUpperCase()
  }
  const local = email?.split('@')[0] ?? ''
  const m = local.match(/[a-zA-Z]/)
  return m ? m[0].toUpperCase() : 'U'
}

export default function TopBarProfileMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'User'
  const email = user?.email ?? ''

  const initial = useMemo(
    () => initialFromUser(user?.displayName, user?.email),
    [user?.displayName, user?.email]
  )

  return (
    <div className={styles.wrapper} ref={wrapRef}>
      <button
        type="button"
        className={styles.avatarButton}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span className={styles.avatarCircle} aria-hidden>
          {initial}
        </span>
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          <div className={styles.dropdownHeader}>
            <div className={styles.dropdownName}>{displayName}</div>
            {email ? <div className={styles.dropdownEmail}>{email}</div> : null}
          </div>
          <div className={styles.dropdownDivider} />
          <button
            type="button"
            className={styles.logoutButton}
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
