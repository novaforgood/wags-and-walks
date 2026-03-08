'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePeople } from './PeopleProvider'
import styles from './Navigation.module.css'
import Image from 'next/image'

export default function Navigation() {
  const pathname = usePathname()
  const { people } = usePeople()

  // Hide old top nav on pages that use the new sidebar layout
  if (pathname === '/candidates' || pathname === '/fosters') {
    return null
  }

  const counts: Record<string, number> = {
    '/onboarding': people.filter(p => (p.status || 'new') === 'new').length,
    '/selecting': people.filter(p => ['in-progress', 'approved'].includes(p.status || 'new')).length,
    '/fostering': people.filter(p => (p.status || 'new') === 'current').length,
  }

  const tabs = [
    { name: 'Onboarding', path: '/onboarding', icon: '/assets/Overview.svg' },
    { name: 'Selecting', path: '/selecting', icon: '/assets/candidates.svg' },
    { name: 'Fostering', path: '/fostering', icon: '/assets/fosters.svg' },
  ]

  return (
    <header className={styles.header}>
  <nav className={styles.nav}>

    <div className={styles.logo}>
      <Image
        src="/assets/logo.png"
        alt="Wags & Walks"
        width={160}
        height={60}
        priority
      />
    </div>

    <div className={styles.tabsContainer}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.path
        const count = counts[tab.path] ?? 0

        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
          >
            <img src={tab.icon} alt={tab.name} width={18} height={18} />
            <span className={styles.tabName}>{tab.name}</span>
            <span className={styles.badge}>{count}</span>
          </Link>
        )
      })}
    </div>

    <div className={styles.actions}>
      <button className={styles.logoutButton}>Log Out</button>
    </div>

  </nav>
</header>
  )
}