import styles from './appFooter.module.css'

const NOVA_URL = 'https://www.novaforgood.org/'

type Props = {
  /** Narrow width for login/signup cards */
  variant?: 'dashboard' | 'auth'
}

export default function AppFooter({ variant = 'dashboard' }: Props) {
  const year = new Date().getFullYear()

  return (
    <footer className={variant === 'auth' ? styles.footerAuth : styles.footer}>
      <span className={styles.brand}>Wags and Walks © {year}</span>
      <a
        href={NOVA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.credit}
      >
        Built by Nova for Good
      </a>
    </footer>
  )
}
