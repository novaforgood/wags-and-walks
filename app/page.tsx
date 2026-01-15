import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>
          Welcome to Wags and Walks
        </h1>
        <p className={styles.description}>
          Navigate using the tabs above to view different pages.
        </p>
      </div>
    </main>
  )
}
