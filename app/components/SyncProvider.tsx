'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { authFetch } from '@/app/lib/authFetch'

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
        const res = await authFetch('/api/sync/all')
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
