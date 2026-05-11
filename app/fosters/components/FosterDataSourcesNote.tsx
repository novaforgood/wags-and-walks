'use client'

import Link from 'next/link'
import styles from '../fosterTasks.module.css'

/** Explains Shelter Manager vs Task Log so tables and tabs don’t feel contradictory. */
export default function FosterDataSourcesNote({
  footerTaskInboxLink,
}: {
  footerTaskInboxLink?: boolean
}) {
  return (
    <aside className={styles.dataSources} aria-label="Where this screen gets its data">
      <div className={styles.dataSourcesTitle}>Where this screen gets its data</div>
      <ul className={styles.dataSourcesList}>
        <li>
          <strong>Shelter Manager</strong> — who is listed, dog names, days in foster, and <em>movement</em> dates.
          Those are <em>not</em> Task Log deadlines.
        </li>
        <li>
          <strong>Task Log</strong> (foster tracking sheet) — photo/survey rows, lane wording, and rollup (Good /
          Overdue / Unknown).
        </li>
      </ul>
      {footerTaskInboxLink ? (
        <p className={styles.dataSourcesFooter}>
          Need filtered queues? Use{' '}
          <Link href="/fosters/tasks" className={styles.introLink}>
            Task inbox
          </Link>
          .
        </p>
      ) : null}
    </aside>
  )
}
