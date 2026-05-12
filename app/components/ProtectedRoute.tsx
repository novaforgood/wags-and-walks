'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import styles from './ProtectedRoute.module.css'

function LoadingScreen() {
  return (
    <div className={styles.loadingScreen} role="status" aria-live="polite">
      Loading…
    </div>
  )
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) return <LoadingScreen />
  if (!user) return null
  return <>{children}</>
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login')
      else if (role !== 'admin') router.push('/overview')
    }
  }, [user, role, loading, router])

  if (loading) return <LoadingScreen />
  if (!user || role !== 'admin') return null
  return <>{children}</>
}
