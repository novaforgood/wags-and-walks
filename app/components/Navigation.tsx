'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePeople } from './PeopleProvider'
import styles from './Navigation.module.css'

export default function Navigation() {
  const pathname = usePathname()
  const { people } = usePeople()

  const counts: Record<string, number> = {
    '/onboarding': people.filter(p => (p.status || 'new') === 'new').length,
    '/selecting': people.filter(p => ['in-progress', 'approved'].includes(p.status || 'new')).length,
    '/fostering': people.filter(p => (p.status || 'new') === 'current').length,
  }

  const tabs = [
    { name: 'Onboarding', path: '/onboarding' },
    { name: 'Selecting', path: '/selecting' },
    { name: 'Fostering', path: '/fostering' },
  ]

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
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
