'use client'

import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { DashboardShell } from '@/app/components/DashboardShell'
import layoutStyles from '@/app/candidates/candidates.module.css'
import styles from './settings.module.css'

export default function SettingsPage() {
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
        <div className={styles.panel}>
          <p className={styles.lead}>Account and app preferences will live here.</p>
          <p className={styles.muted}>This section is not wired up yet.</p>
        </div>
      </DashboardShell>
    </ProtectedRoute>
  )
}
