import styles from '../page.module.css'
import EmailModal from '../components/EmailModal'

export default function NewPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>New</h1>
        <p className={styles.description}>
          This is the New page content.
        </p>
        <EmailModal />
      </div>
    </main>
  )
}
