'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { auth } from '@/firebase'

type SyncContextValue = {
  syncing: boolean
  error: boolean
  completedRunId: number
  startSync: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(false)
  const [completedRunId, setCompletedRunId] = useState(0)
  const inFlightRef = useRef<Promise<void> | null>(null)

  const startSync = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current

    const run = (async () => {
      setSyncing(true)
      setError(false)
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('You must be signed in to sync')
        const res = await fetch('/api/sync/all', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Sync failed with status ${res.status}`)
        setCompletedRunId(id => id + 1)
      } catch {
        setError(true)
      } finally {
        inFlightRef.current = null
        setSyncing(false)
      }
    })()

    inFlightRef.current = run
    return run
  }, [])

  const value = useMemo<SyncContextValue>(() => ({
    syncing,
    error,
    completedRunId,
    startSync,
  }), [completedRunId, error, startSync, syncing])

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSyncState() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSyncState must be used within SyncProvider')
  return ctx
}
