'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import NotificationPanel from '@/app/components/NotificationPanel'
import TopBarProfileMenu from '@/app/components/TopBarProfileMenu'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { SidebarGeneralSection } from '@/app/components/SidebarGeneralSection'
import { SidebarAccountSection } from '@/app/components/SidebarAccountSection'
import { SidebarProfile } from '@/app/components/SidebarProfile'
import layoutStyles from '@/app/candidates/candidates.module.css'
import styles from './settings.module.css'

export default function SettingsPage() {
  const pathname = usePathname()
  const { user, role, signOut } = useAuth()

  return (
    <ProtectedRoute>
      <div className={layoutStyles.pageWrapper}>
        <aside className={layoutStyles.sidebar}>
          <div className={layoutStyles.sidebarHeader}>
            <div className={layoutStyles.sidebarLogo}>
              <Image src="/assets/logo.svg" alt="Wags & Walks" width={160} height={60} priority />
            </div>
          </div>

          <SidebarGeneralSection>
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
          </SidebarGeneralSection>

          <SidebarAccountSection pathname={pathname} role={role} />
          <SidebarProfile user={user} role={role} signOut={signOut} />
        </aside>

        <div className={layoutStyles.mainContent}>
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
        </div>
      </div>
    </ProtectedRoute>
  )
}
