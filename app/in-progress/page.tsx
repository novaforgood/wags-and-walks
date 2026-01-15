import styles from '../page.module.css'

export default function InProgressPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>In Progress</h1>
        <p className={styles.description}>
          This is the In Progress page content.
        </p>
      </div>
    </main>
  )
}
