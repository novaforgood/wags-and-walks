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
import { normalizeEmailKey } from '@/app/lib/peopleTypes'
import { auth } from '@/firebase'
import { authFetch } from '@/app/lib/authFetch'
import { useAuth } from './AuthProvider'
import {
  mergeOverrides,
  relatedOverrideEmails,
  resolveStarred,
  type ApplicantOverride,
} from '@/app/lib/applicantOverrides'

const PEOPLE_LAST_FETCHED_KEY = 'people_last_fetched_at'
const OVERRIDES_CACHE_KEY = 'applicant_overrides_v1'

function readLastFetchedAtMs(): number | null {
  try {
    const raw = localStorage.getItem(PEOPLE_LAST_FETCHED_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function writeLastFetchedAtMs(ms: number) {
  try {
    localStorage.setItem(PEOPLE_LAST_FETCHED_KEY, String(ms))
  } catch {
    // ignore
  }
}

function readCachedOverrides(): Record<string, ApplicantOverride> {
  try {
    const raw = localStorage.getItem(OVERRIDES_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ApplicantOverride>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCachedOverrides(map: Record<string, ApplicantOverride>) {
  try {
    localStorage.setItem(OVERRIDES_CACHE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function clearCachedOverrides() {
  try {
    localStorage.removeItem(OVERRIDES_CACHE_KEY)
  } catch {
    // ignore
  }
}

type PeopleContextValue = {
  people: Person[]
  /** Firestore applicantOverrides keyed by normalized email — used by Directory VIP. */
  overrides: Record<string, ApplicantOverride>
  isLoading: boolean
  error: string | null
  /** Milliseconds since epoch when the people source cache was last updated. */
  lastFetchedAt: number | null
  setStatus: (email: string, status: PersonStatus) => void
  toggleStar: (email: string, options?: { relatedEmail?: string }) => void
  setSignedDocument: (email: string, value: 'Yes' | 'No') => Promise<void>
  setNotes: (email: string, content: string, options?: { relatedEmail?: string }) => Promise<void>
  refresh: (options?: { suppressLoadingBar?: boolean }) => Promise<void>
}

const PeopleContext = createContext<PeopleContextValue | null>(null)

type OverrideFields = Partial<Omit<ApplicantOverride, 'updatedAt' | 'updatedBy'>>

async function saveOverride(email: string, fields: OverrideFields): Promise<void> {
  const response = await authFetch('/api/applicant-overrides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fields }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(data?.error || `Failed to save override (${response.status})`)
  }
}

export function PeopleProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [overrides, setOverrides] = useState<Record<string, ApplicantOverride>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  const basePeopleRef = useRef<Person[]>([])
  const overridesRef = useRef<Record<string, ApplicantOverride>>({})
  const abortRef = useRef<AbortController | null>(null)

  function rebuildPeople(
    base: Person[],
    nextOverrides: Record<string, ApplicantOverride>,
  ): Person[] {
    return mergeOverrides(base, nextOverrides)
  }

  function applyOverrides(next: Record<string, ApplicantOverride>) {
    overridesRef.current = next
    setOverrides(next)
    setPeople(rebuildPeople(basePeopleRef.current, next))
    writeCachedOverrides(next)
  }

  const setStatus = useCallback(
    (email: string, status: PersonStatus) => {
      const key = normalizeEmailKey(email)
      if (!key) return

      setPeople(prev => prev.map(p => normalizeEmailKey(p.email) === key ? { ...p, status } : p))

      saveOverride(email, { status }).catch(err => {
        console.error('Failed to set status in Firestore:', err)
        setPeople(rebuildPeople(basePeopleRef.current, overridesRef.current))
      })

      if (status === 'approved') {
        void (async () => {
          const token = await auth.currentUser?.getIdToken()
          if (!token) throw new Error('Not signed in')
          const res = await fetch('/api/google-group/approve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email }),
          })
          if (!res.ok) throw new Error(`Approval failed (${res.status})`)
        })()
          .catch(err => console.error('Failed to add to Google Group:', err))
      }
    },
    [],
  )

  const toggleStar = useCallback(
    (email: string, options?: { relatedEmail?: string }) => {
      const keys = relatedOverrideEmails(email, options?.relatedEmail)
      const primaryKey = keys[0]
      if (!primaryKey) return

      const person = people.find(p => {
        const pk = normalizeEmailKey(p.email)
        return keys.includes(pk)
      })
      const currentStarred = resolveStarred(email, overridesRef.current, person ?? undefined)
      const newStarred = !currentStarred

      const next = { ...overridesRef.current }
      for (const key of keys) {
        next[key] = { ...next[key], starred: newStarred }
      }
      applyOverrides(next)

      Promise.all(keys.map(key => saveOverride(key, { starred: newStarred }))).catch(err => {
        console.error('Failed to toggle star:', err)
      })
    },
    [people],
  )

  const setNotes = useCallback(async (
    email: string,
    content: string,
    options?: { relatedEmail?: string },
  ) => {
    const keys = relatedOverrideEmails(email, options?.relatedEmail)
    const primaryKey = keys[0]
    if (!primaryKey) return
    const notesUpdatedAt = new Date().toISOString()

    const next = { ...overridesRef.current }
    for (const key of keys) {
      next[key] = { ...next[key], notes: content, notesUpdatedAt }
    }
    applyOverrides(next)

    try {
      await Promise.all(keys.map(key => saveOverride(key, { notes: content, notesUpdatedAt })))
    } catch (err) {
      console.error('Failed to save notes:', err)
      throw err
    }
  }, [])

  const setSignedDocument = useCallback(async (email: string, value: 'Yes' | 'No') => {
    const key = normalizeEmailKey(email)
    if (!key) return

    const next = {
      ...overridesRef.current,
      [key]: { ...overridesRef.current[key], signedDocument: value },
    }
    applyOverrides(next)

    await saveOverride(email, { signedDocument: value }).catch(err => {
      console.error('Failed to set signed document:', err)
      setPeople(rebuildPeople(basePeopleRef.current, overridesRef.current))
    })
  }, [])

  const refresh = useCallback(async (options?: { suppressLoadingBar?: boolean }) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (options?.suppressLoadingBar) {
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }
    setError(null)
    try {
      const response = await authFetch('/api/people', { method: 'GET', signal: controller.signal })
      const data = (await response.json()) as {
        success?: boolean
        people?: Person[]
        updatedAt?: string
        error?: string
      }
      if (!data?.success || !Array.isArray(data.people)) {
        setError(data?.error || 'Failed to load people')
        return
      }

      const syncedAt = data.updatedAt ? new Date(data.updatedAt).getTime() : NaN
      const nextFetchedAt = Number.isFinite(syncedAt) && syncedAt > 0 ? syncedAt : Date.now()
      setLastFetchedAt(nextFetchedAt)
      writeLastFetchedAtMs(nextFetchedAt)

      basePeopleRef.current = data.people
      setPeople(rebuildPeople(data.people, overridesRef.current))

      try {
        localStorage.setItem('people_v2', JSON.stringify(data.people))
      } catch (e) {
        console.error('Failed to cache people', e)
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      console.error('Fetch error:', e)
      if (basePeopleRef.current.length === 0) setError('Failed to load people')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setPeople([])
      basePeopleRef.current = []
      overridesRef.current = {}
      setOverrides({})
      clearCachedOverrides()
      setIsLoading(false)
      setError(null)
      return
    }

    const cachedOverrides = readCachedOverrides()
    if (Object.keys(cachedOverrides).length > 0) {
      overridesRef.current = cachedOverrides
      setOverrides(cachedOverrides)
    }

    try {
      const cachedRaw = localStorage.getItem('people_v2')
      if (cachedRaw) {
        const cachedPeople = JSON.parse(cachedRaw) as Person[]
        if (Array.isArray(cachedPeople) && cachedPeople.length > 0) {
          basePeopleRef.current = cachedPeople
          setPeople(rebuildPeople(cachedPeople, overridesRef.current))
        }
      }
      const cachedFetched = readLastFetchedAtMs()
      if (cachedFetched != null) setLastFetchedAt(cachedFetched)
    } catch (e) {
      console.error('Failed to load cached people', e)
    }

    void refresh()

    return () => {
      abortRef.current?.abort()
    }
  }, [authLoading, user, refresh])

  const value = useMemo<PeopleContextValue>(
    () => ({
      people,
      overrides,
      isLoading,
      error,
      lastFetchedAt,
      setStatus,
      toggleStar,
      setSignedDocument,
      setNotes,
      refresh,
    }),
    [people, overrides, isLoading, error, lastFetchedAt, setStatus, toggleStar, setSignedDocument, setNotes, refresh]
  )

  return <PeopleContext.Provider value={value}>{children}</PeopleContext.Provider>
}

export function usePeople() {
  const ctx = useContext(PeopleContext)
  if (!ctx) throw new Error('usePeople must be used within PeopleProvider')
  return ctx
}
