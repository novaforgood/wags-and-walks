'use client'

import { Suspense, useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import { getAuthErrorMessage } from '@/app/lib/authErrors'
import Image from 'next/image'
import styles from './login.module.css'

function LoginPageInner() {
    const searchParams = useSearchParams()
    const justRegistered = searchParams.get('registered') === '1'

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signIn } = useAuth()
    const router = useRouter()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await signIn(email, password)
            router.push('/overview')
        } catch (err: unknown) {
            setError(getAuthErrorMessage(err, 'signIn'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logoContainer}>
                    <Image
                        src="/assets/logo.svg"
                        alt="Wags & Walks"
                        width={176}
                        height={66}
                        priority
                    />
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.header}>
                        <h1 className={styles.title}>Welcome Back</h1>
                        <p className={styles.inviteHint}>
                            Were you recently invited?{' '}
                            <Link href="/signup" className={styles.signUpLink}>
                                Create your account
                            </Link>
                        </p>
                    </div>

                    {justRegistered && (
                        <div className={styles.successNotice} role="status">
                            Account created. Sign in with your new password.
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className={styles.error} role="alert">
                            {error}
                        </div>
                    )}

                    <div className={styles.fieldStack}>
                    {/* Email Field */}
                    <div className={styles.inputGroup}>
                        <label htmlFor="email" className={styles.label}>
                            Email Address
                        </label>
                        <div className={styles.inputWrapper}>
                            <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M3 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="m2 5 8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className={styles.input}
                                placeholder="email@wagsandwalks.org"
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className={styles.inputGroup}>
                        <label htmlFor="password" className={styles.label}>
                            Password
                        </label>
                        <div className={styles.inputWrapper}>
                            <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <rect x="4" y="9" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className={styles.input}
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                className={styles.togglePassword}
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                                        <path
                                            stroke="currentColor"
                                            strokeWidth={1.5}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                                        />
                                        <path
                                            stroke="currentColor"
                                            strokeWidth={1.5}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                                        <path
                                            stroke="currentColor"
                                            strokeWidth={1.5}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                                        />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className={styles.forgotRow}>
                        <Link href="/forgot-password" className={styles.forgotLink}>
                            Forgot Password?
                        </Link>
                    </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={styles.button}
                    >
                        {loading ? 'LOGGING IN...' : 'LOG IN'}
                    </button>

                    <div className={styles.footerGroup}>
                        <p className={styles.footer}>
                            Need access?{' '}
                            <a href="mailto:support@wagsandwalks.org" className={styles.signUpLink}>
                                Contact an admin
                            </a>
                            .
                        </p>
                        <p className={styles.footer}>
                            Need help?{' '}
                            <a href="mailto:support@wagsandwalks.org" className={styles.signUpLink}>
                                Contact support
                            </a>
                            .
                        </p>
                    </div>

                    <p className={styles.copyright}>
                        © 2026 Wags & Walks, all rights reserved.
                    </p>
                </form>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginPageInner />
        </Suspense>
    )
}
