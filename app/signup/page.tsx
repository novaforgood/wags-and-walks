'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import Image from 'next/image'
import Link from 'next/link'
import styles from '../login/login.module.css'

export default function SignUpPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signUp } = useAuth()
    const router = useRouter()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }

        setLoading(true)

        try {
            await signUp(email, password)
            router.push('/overview')
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('This email is already registered')
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address')
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak')
            } else {
                setError(err.message || 'Failed to create account')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.container}>
            {/* Background Decorations - Dogs and Paw Prints */}
            <div className={styles.dogLeft} />
            <div className={styles.dogRight} />
            <div className={styles.pawBottomLeft} />
            <div className={styles.pawMidLeft} />
            <div className={styles.pawBottomRight} />
            <div className={styles.pawMidRight} />

            {/* Logo */}
            <div className={styles.logoContainer}>
                <Image
                    src="/assets/logo.png"
                    alt="Wags & Walks"
                    width={180}
                    height={68}
                    priority
                />
            </div>

            {/* Centered Signup Card */}
            <div className={styles.card}>
                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Header */}
                    <div className={styles.header}>
                        <h1 className={styles.title}>Create Account</h1>
                        <p className={styles.subtitle}>Sign up to manage foster candidates.</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className={styles.error}>
                            {error}
                        </div>
                    )}

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
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5"/>
                                        <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/>
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M3 3l14 14M10 7a3 3 0 0 1 3 3m-1.5 4.5A5.5 5.5 0 0 1 4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5"/>
                                        <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5"/>
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <path d="M3 3l14 14M10 7a3 3 0 0 1 3 3m-1.5 4.5A5.5 5.5 0 0 1 4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    </svg>
                                )}
                            </button>
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

                    {/* Footer Links */}
                    <p className={styles.footer}>
                        Already have an account?{' '}
                        <Link href="/login" className={styles.signUpLink}>
                            Log in here
                        </Link>
                        .
                    </p>
                </form>
            </div>

            {/* Copyright */}
            <div className={styles.copyright}>
                © 2024 Wags & Walks, all rights reserved.
            </div>
        </div>
    )
}
