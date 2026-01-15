'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Navigation.module.css'

export default function Navigation() {
  const pathname = usePathname()

  const tabs = [
    { name: 'New', path: '/new' },
    { name: 'In Progress', path: '/in-progress' },
    { name: 'Approved', path: '/approved' },
    { name: 'Current', path: '/current' },
  ]

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        {tabs.map((tab) => {
          const isActive = pathname === tab.path
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`${styles.tab} ${isActive ? styles.active : ''}`}
            >
              {tab.name}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
