import Link from 'next/link'
import styles from './fostersSubTabs.module.css'

type Tab = 'overview' | 'tasks' | 'directory' | 'actions'

export default function FostersSubTabs({ active }: { active: Tab }) {
  return (
    <div className={styles.section}>
      <div className={styles.row} role="navigation" aria-label="Fosters sections">
        <Link
          href="/fosters/overview"
          className={`${styles.tab} ${active === 'overview' ? styles.tabActive : ''}`}
        >
          Overview
        </Link>
        <Link
          href="/fosters/tasks"
          className={`${styles.tab} ${active === 'tasks' ? styles.tabActive : ''}`}
        >
          Task inbox
        </Link>
        <Link
          href="/fosters"
          className={`${styles.tab} ${active === 'directory' ? styles.tabActive : ''}`}
        >
          Active fosters
        </Link>
        <Link
          href="/fosters/actions"
          className={`${styles.tab} ${active === 'actions' ? styles.tabActive : ''}`}
        >
          Actions
        </Link>
      </div>
    </div>
  )
}
