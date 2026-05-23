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
import {
  setOverride,
  subscribeToOverrides,
  mergeOverrides,
  type ApplicantOverride,
} from '@/app/lib/applicantOverrides'

const PEOPLE_LAST_FETCHED_KEY = 'people_last_fetched_at'

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

type PeopleContextValue = {
  people: Person[]
  isLoading: boolean
  error: string | null
  /** Milliseconds since epoch when `/api/people` last returned successfully. */
  lastFetchedAt: number | null
  setStatus: (email: string, status: PersonStatus) => void
  toggleStar: (email: string) => void
  setSignedDocument: (email: string, value: 'Yes' | 'No') => Promise<void>
  setNotes: (email: string, content: string) => Promise<void>
  refresh: (options?: { suppressLoadingBar?: boolean }) => Promise<void>
}

const PeopleContext = createContext<PeopleContextValue | null>(null)

export function PeopleProvider({ children }: { children: React.ReactNode }) {
  const [people, setPeople] = useState<Person[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  const basePeopleRef = useRef<Person[]>([])
  const overridesRef = useRef<Record<string, ApplicantOverride>>({})
  const abortRef = useRef<AbortController | null>(null)

  function rebuildPeople(
    base: Person[],
    overrides: Record<string, ApplicantOverride>,
  ): Person[] {
    return mergeOverrides(base, overrides)
  }

  const setStatus = useCallback(
    (email: string, status: PersonStatus) => {
      const key = normalizeEmailKey(email)
      if (!key) return

      setPeople(prev => prev.map(p => normalizeEmailKey(p.email) === key ? { ...p, status } : p))

      const updatedBy =
        auth.currentUser?.email?.trim() ||
        auth.currentUser?.displayName?.trim() ||
        'unknown'

      setOverride(email, { status }, updatedBy).catch(err => {
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
    (email: string) => {
      const key = normalizeEmailKey(email)
      if (!key) return
      const person = people.find(p => normalizeEmailKey(p.email) === key)
      if (!person) return
      const newStarred = !person.starred

      setPeople(prev => prev.map(p => normalizeEmailKey(p.email) === key ? { ...p, starred: newStarred } : p))

      const updatedBy = auth.currentUser?.email?.trim() || 'unknown'
      setOverride(email, { starred: newStarred }, updatedBy).catch(err => {
        console.error('Failed to toggle star:', err)
        setPeople(rebuildPeople(basePeopleRef.current, overridesRef.current))
      })
    },
    [people],
  )

  const setNotes = useCallback(async (email: string, content: string) => {
    const key = normalizeEmailKey(email)
    if (!key) return
    const notesUpdatedAt = new Date().toISOString()

    setPeople(prev => prev.map(p =>
      normalizeEmailKey(p.email) === key ? { ...p, notes: content, notesUpdatedAt } : p
    ))

    const updatedBy = auth.currentUser?.email?.trim() || 'unknown'
    await setOverride(email, { notes: content, notesUpdatedAt }, updatedBy).catch(err => {
      console.error('Failed to save notes:', err)
    })
  }, [])

  const setSignedDocument = useCallback(async (email: string, value: 'Yes' | 'No') => {
    const key = normalizeEmailKey(email)
    if (!key) return

    setPeople(prev => prev.map(p =>
      normalizeEmailKey(p.email) === key ? { ...p, signedDocument: value } : p
    ))

    const updatedBy = auth.currentUser?.email?.trim() || 'unknown'
    await setOverride(email, { signedDocument: value }, updatedBy).catch(err => {
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
        error?: string
      }
      if (!data?.success || !Array.isArray(data.people)) {
        setError(data?.error || 'Failed to load people')
        return
      }

      const now = Date.now()
      setLastFetchedAt(now)
      writeLastFetchedAtMs(now)

      // Server already merges overrides, but store as base for client re-merges via onSnapshot
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
      if (people.length === 0) setError('Failed to load people')
    } finally {
      setIsLoading(false)
    }
  }, [people.length])

  useEffect(() => {
    // Seed from localStorage cache for instant display
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

    // Real-time Firestore subscription — fires immediately then on any change
    const unsubscribeOverrides = subscribeToOverrides(overrides => {
      overridesRef.current = overrides
      setPeople(prev => rebuildPeople(basePeopleRef.current.length > 0 ? basePeopleRef.current : prev, overrides))
    })

    void refresh()

    return () => {
      unsubscribeOverrides()
      abortRef.current?.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<PeopleContextValue>(
    () => ({
      people,
      isLoading,
      error,
      lastFetchedAt,
      setStatus,
      toggleStar,
      setSignedDocument,
      setNotes,
      refresh,
    }),
    [people, isLoading, error, lastFetchedAt, setStatus, toggleStar, setSignedDocument, setNotes, refresh]
  )

  return <PeopleContext.Provider value={value}>{children}</PeopleContext.Provider>
}

export function usePeople() {
  const ctx = useContext(PeopleContext)
  if (!ctx) throw new Error('usePeople must be used within PeopleProvider')
  return ctx
}
