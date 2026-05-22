'use client'

import styles from '@/app/candidates/candidates.module.css'

export function SidebarGeneralSection({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.sidebarGeneral}>
      <div className={styles.sidebarGeneralLabel}>General</div>
      <nav className={styles.sidebarNav} aria-label="Main navigation">
        {children}
      </nav>
    </div>
  )
}
