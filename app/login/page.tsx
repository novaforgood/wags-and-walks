'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import Image from 'next/image'
import styles from './login.module.css'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
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
            router.push('/candidates')
        } catch (err: any) {
            setError(err.message || 'Failed to sign in')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.container}>
            {/* Centered Login Card */}
            <div className={styles.card}>
                <form onSubmit={handleSubmit} className={styles.form}>
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

                    {/* Header */}
                    <div className={styles.header}>
                        <h1 className={styles.title}>Welcome Back</h1>
                        <p className={styles.subtitle}>Log in to manage your foster candidates.</p>
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
                                placeholder="••••••••"
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

                    {/* Remember Me & Forgot Password */}
                    <div className={styles.utilityRow}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className={styles.checkbox}
                            />
                            <span>Remember Me</span>
                        </label>
                        <a href="#" className={styles.forgotLink}>
                            Forgot Password?
                        </a>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={styles.button}
                    >
                        {loading ? 'LOGGING IN...' : 'LOG IN'}
                    </button>

                    {/* Footer Links */}
                    <p className={styles.footer}>
                        Don't have an account?{' '}
                        <a href="#" className={styles.signUpLink}>
                            Sign Up here
                        </a>
                        .
                    </p>
                    <p className={styles.footer}>
                        Need help?{' '}
                        <a href="#" className={styles.signUpLink}>
                            Contact support
                        </a>
                        .
                    </p>
                    {/* Copyright */}
                    <div className={styles.copyright}>
                        © 2024 Wags & Walks, all rights reserved.
                    </div>
                </form>
            </div>
        </div>
    )
}
