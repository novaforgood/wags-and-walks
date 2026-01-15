import styles from '../page.module.css'

export default function CurrentPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Current</h1>
        <p className={styles.description}>
          This is the Current page content.
        </p>
      </div>
    </main>
  )
}
