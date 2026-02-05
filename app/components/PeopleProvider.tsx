'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { Person, PersonStatus } from '@/app/lib/peopleTypes'
import { normalizeEmailKey, PENDING_STATUS_UPDATES_STORAGE_KEY } from '@/app/lib/peopleTypes'

type PeopleContextValue = {
  people: Person[]
  isLoading: boolean
  error: string | null
  setStatus: (email: string, status: PersonStatus) => void
  refresh: () => Promise<void>
}

const PeopleContext = createContext<PeopleContextValue | null>(null)

type PendingUpdate = { email: string; status: PersonStatus }

function readPendingQueue(): Record<string, PersonStatus> {
  try {
    const raw = localStorage.getItem(PENDING_STATUS_UPDATES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PersonStatus>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function writePendingQueue(queue: Record<string, PersonStatus>) {
  try {
    localStorage.setItem(PENDING_STATUS_UPDATES_STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // ignore
  }
}

export function PeopleProvider({ children }: { children: React.ReactNode }) {
  const [people, setPeople] = useState<Person[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pendingRef = useRef<Map<string, PersonStatus>>(new Map())
  const flushTimerRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // TODO: Replace this constant with the currently logged-in admin user's identity.
  // For now, we store a fixed marker in the sheet to support multi-user visibility.
  const UPDATED_BY = 'jay t'

  const applyPendingOptimistic = useCallback((base: Person[]) => {
    if (pendingRef.current.size === 0) return base
    return base.map(p => {
      const key = normalizeEmailKey(p.email)
      if (!key) return p
      const pending = pendingRef.current.get(key)
      return pending ? { ...p, status: pending } : p
    })
  }, [])

  const refresh = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/people', { method: 'GET', signal: controller.signal })
      const data = (await response.json()) as {
        success?: boolean
        people?: Person[]
        error?: string
      }
      if (!data?.success || !Array.isArray(data.people)) {
        setError(data?.error || 'Failed to load people')
        setPeople([])
        return
      }

      setPeople(applyPendingOptimistic(data.people))
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setError('Failed to load people')
      setPeople([])
    } finally {
      setIsLoading(false)
    }
  }, [applyPendingOptimistic])

  const flushQueue = useCallback(async () => {
    const updates: PendingUpdate[] = Array.from(pendingRef.current.entries()).map(
      ([email, status]) => ({ email, status })
    )
    if (updates.length === 0) return

    for (const u of updates) {
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_status',
            email: u.email,
            status: u.status,
            updatedBy: UPDATED_BY
          })
        })

        const data = (await response.json()) as { success?: boolean; error?: string }
        if (!response.ok || !data?.success) {
          // Keep in queue for retry; UI remains optimistic.
          continue
        }

        pendingRef.current.delete(u.email)
      } catch {
        // Keep in queue for retry.
      }
    }

    const persisted: Record<string, PersonStatus> = {}
    for (const [email, status] of pendingRef.current.entries()) {
      persisted[email] = status
    }
    writePendingQueue(persisted)
  }, [])

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current != null) {
      window.clearTimeout(flushTimerRef.current)
    }
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null
      flushQueue()
    }, 900)
  }, [flushQueue])

  const setStatus = useCallback(
    (email: string, status: PersonStatus) => {
      const key = normalizeEmailKey(email)
      if (!key) return

      // Optimistically update UI immediately.
      setPeople(prev =>
        prev.map(p => (normalizeEmailKey(p.email) === key ? { ...p, status } : p))
      )

      // Queue background sync to Sheets (debounced + coalesced).
      pendingRef.current.set(key, status)
      const persisted: Record<string, PersonStatus> = {}
      for (const [emailKey, queuedStatus] of pendingRef.current.entries()) {
        persisted[emailKey] = queuedStatus
      }
      writePendingQueue(persisted)
      scheduleFlush()
    },
    [scheduleFlush]
  )

  useEffect(() => {
    const persisted = readPendingQueue()
    for (const [email, status] of Object.entries(persisted)) {
      pendingRef.current.set(email, status)
    }

    refresh()

    return () => {
      abortRef.current?.abort()
      if (flushTimerRef.current != null) window.clearTimeout(flushTimerRef.current)
    }
  }, [refresh])

  const value = useMemo<PeopleContextValue>(
    () => ({ people, isLoading, error, setStatus, refresh }),
    [people, isLoading, error, setStatus, refresh]
  )

  return <PeopleContext.Provider value={value}>{children}</PeopleContext.Provider>
}

export function usePeople() {
  const ctx = useContext(PeopleContext)
  if (!ctx) throw new Error('usePeople must be used within PeopleProvider')
  return ctx
}
