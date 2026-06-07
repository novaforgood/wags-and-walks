import { getFosterNoteFromFirestore } from './fosterNotesFirestore'
import { authFetch } from '@/app/lib/authFetch'

export type FosterNotesCacheEntry = {
  notes: string
  notesUpdatedAt: string
}

const notesByEmail = new Map<string, FosterNotesCacheEntry>()
const inFlightByEmail = new Map<string, Promise<FosterNotesCacheEntry | null>>()

function keyForEmail(email: string | null | undefined): string {
  return String(email || '').trim().toLowerCase()
}

export function getCachedFosterNotes(email: string | null | undefined): FosterNotesCacheEntry | null {
  const key = keyForEmail(email)
  return key ? notesByEmail.get(key) ?? null : null
}

export function setCachedFosterNotes(
  email: string | null | undefined,
  notes: FosterNotesCacheEntry
): void {
  const key = keyForEmail(email)
  if (key) notesByEmail.set(key, notes)
}

export function prefetchFosterNotes(email: string | null | undefined): Promise<FosterNotesCacheEntry | null> {
  const key = keyForEmail(email)
  if (!key) return Promise.resolve(null)

  const cached = notesByEmail.get(key)
  if (cached) return Promise.resolve(cached)

  const existing = inFlightByEmail.get(key)
  if (existing) return existing

  const request = getFosterNoteFromFirestore(key)
    .then(async firestoreEntry => {
      if (firestoreEntry !== null) {
        notesByEmail.set(key, firestoreEntry)
        return firestoreEntry
      }

      // Server fallback uses Firebase Admin, which covers clients without direct Firestore read access.
      const res = await authFetch(`/api/foster-notes?email=${encodeURIComponent(key)}`)
      const data = await res.json()
      if (!data?.success) return null

      const entry: FosterNotesCacheEntry = {
        notes: data.notes || '',
        notesUpdatedAt: data.notesUpdatedAt || '',
      }
      notesByEmail.set(key, entry)

      return entry
    })
    .catch(() => null)
    .finally(() => {
      inFlightByEmail.delete(key)
    })

  inFlightByEmail.set(key, request)
  return request
}
