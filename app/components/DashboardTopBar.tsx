'use client'

import NotificationPanel from '@/app/components/NotificationPanel'
import SyncButton from '@/app/components/SyncButton'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import styles from '@/app/candidates/candidates.module.css'

type DashboardTopBarProps = {
  title: string
  syncUpdatedAt?: string
  onSyncRefresh?: () => void
}

export default function DashboardTopBar({
  title,
  syncUpdatedAt,
  onSyncRefresh,
}: DashboardTopBarProps) {
  return (
    <div className={styles.topBar}>
      <h1 className={styles.topBarTitle}>{title}</h1>
      <div className={styles.topBarActions}>
        {onSyncRefresh && (
          <SyncButton updatedAt={syncUpdatedAt} onRefresh={onSyncRefresh} />
        )}
        <NotificationPanel />
        <TopBarProfileMenu />
      </div>
    </div>
  )
}
