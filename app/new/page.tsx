import styles from '../page.module.css'

export default function NewPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>New</h1>
        <p className={styles.description}>
          This is the New page content.
        </p>
      </div>
    </main>
  )
}
