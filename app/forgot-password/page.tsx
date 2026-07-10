'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import AppFooter from '@/app/components/AppFooter'
import { useAuth } from '@/app/components/AuthProvider'
import { getAuthErrorMessage } from '@/app/lib/authErrors'
import styles from '../login/login.module.css'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(email)
      setDone(true)
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, 'resetPassword'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoContainer}>
          <Image src="/assets/logo.svg" alt="Wags & Walks" width={176} height={66} priority />
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>Reset Password</h1>
          <p className={styles.subtitle}>
            We&apos;ll email you a reset link. Use the address you registered with—or{' '}
            <Link href="/signup" className={styles.signUpLink}>
              sign up
            </Link>{' '}
            first if you haven&apos;t yet.
          </p>
        </div>

        {done ? (
          <div className={styles.form}>
            <div className={styles.infoNotice} role="status">
              Check your inbox and spam. Still nothing? Finish{' '}
              <Link href="/signup" className={styles.signUpLink}>
                sign-up
              </Link>{' '}
              first if you&apos;re new, or ask your admin.
            </div>
            <div className={styles.footerGroup}>
              <p className={styles.footer}>
                <Link href="/login" className={styles.signUpLink}>
                  Back to Log In
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <div className={styles.fieldStack}>
              <div className={styles.inputGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email Address
                </label>
                <div className={styles.inputWrapper}>
                  <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M3 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="m2 5 8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={styles.input}
                    placeholder="email@wagsandwalks.org"
                    autoComplete="email"
                  />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? 'SENDING…' : 'SEND RESET LINK'}
            </button>

            <div className={styles.footerGroup}>
              <p className={styles.footer}>
                <Link href="/login" className={styles.signUpLink}>
                  Back to Log In
                </Link>
              </p>
            </div>

          </form>
        )}
      </div>
      <AppFooter variant="auth" />
    </div>
  )
}
