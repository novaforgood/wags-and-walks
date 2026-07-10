'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import { AUTH_VALIDATION, getAuthErrorMessage } from '@/app/lib/authErrors'
import Image from 'next/image'
import Link from 'next/link'
import AppFooter from '@/app/components/AppFooter'
import styles from '../login/login.module.css'

export default function SignUpPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signUp, signOut } = useAuth()
    const router = useRouter()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (password !== confirmPassword) {
            setError(AUTH_VALIDATION.passwordMismatch)
            return
        }

        if (password.length < 6) {
            setError(AUTH_VALIDATION.passwordTooShort)
            return
        }

        setLoading(true)

        try {
            await signUp(email, password)
            await signOut()
            router.push('/login?registered=1')
        } catch (err: unknown) {
            setError(getAuthErrorMessage(err, 'signUp'))
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
                    {/* Header */}
                    <div className={styles.header}>
                        <h1 className={styles.title}>Create Account</h1>
                    </div>

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
                                placeholder="At least 6 characters"
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

                    {/* Confirm Password Field */}
                    <div className={styles.inputGroup}>
                        <label htmlFor="confirmPassword" className={styles.label}>
                            Confirm Password
                        </label>
                        <div className={styles.inputWrapper}>
                            <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <rect x="4" y="9" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <input
                                id="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className={styles.input}
                                placeholder="Re-enter password"
                            />
                            <button
                                type="button"
                                className={styles.togglePassword}
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                tabIndex={-1}
                            >
                                {showConfirmPassword ? (
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
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={styles.button}
                    >
                        {loading ? 'CREATING ACCOUNT...' : 'SIGN UP'}
                    </button>

                    <div className={styles.footerGroup}>
                        <p className={styles.footer}>
                            Already have an account?{' '}
                            <Link href="/login" className={styles.signUpLink}>
                                Log in here
                            </Link>
                            .
                        </p>
                    </div>

                </form>
            </div>
            <AppFooter variant="auth" />
        </div>
    )
}
