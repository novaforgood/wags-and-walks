import Link from 'next/link'
import styles from '../candidates/candidates.module.css'

type Tab = 'overview' | 'directory' | 'actions'

export default function FostersSubTabs({ active }: { active: Tab }) {
    return (
        <div className={styles.tabSection}>
            <div className={styles.tabRow}>
                <Link
                    href="/fosters/overview"
                    className={`${styles.tab} ${active === 'overview' ? styles.tabActive : ''}`}
                >
                    Overview
                </Link>
                <Link
                    href="/fosters"
                    className={`${styles.tab} ${active === 'directory' ? styles.tabActive : ''}`}
                >
                    Directory
                </Link>
                <Link
                    href="/fosters/actions"
                    className={`${styles.tab} ${active === 'actions' ? styles.tabActive : ''}`}
                >
                    Action items
                </Link>
                <div className={styles.tabUnderlineFull} />
            </div>
        </div>
    )
}
