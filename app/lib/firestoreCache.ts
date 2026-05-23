import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { resolveFirebaseAdminApp } from './firebaseAdmin'

export const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

const COLLECTION = 'cache'

export type CacheEntry<T> = {
  data: T
  updatedAt: Date
}

// Per-doc in-flight deduplication — prevents concurrent background syncs for the same doc
const syncInFlight = new Map<string, Promise<void>>()

export async function readFirestoreCache<T>(docId: string): Promise<CacheEntry<T> | null> {
  const admin = resolveFirebaseAdminApp()
  if (!admin.ok) return null
  try {
    const db = getFirestore(admin.app)
    const snap = await db.collection(COLLECTION).doc(docId).get()
    if (!snap.exists) return null
    const d = snap.data()!
    const updatedAt = (d.updatedAt as Timestamp | undefined)?.toDate() ?? new Date(0)
    return { data: d.data as T, updatedAt }
  } catch {
    return null
  }
}

export async function writeFirestoreCache<T>(docId: string, data: T): Promise<void> {
  const admin = resolveFirebaseAdminApp()
  if (!admin.ok) return
  const db = getFirestore(admin.app)
  await db.collection(COLLECTION).doc(docId).set({
    data,
    updatedAt: Timestamp.now(),
  })
}

export function isCacheFresh(updatedAt: Date, ttlMs = CACHE_TTL_MS): boolean {
  return Date.now() - updatedAt.getTime() < ttlMs
}

// ── Chunked cache for large arrays that exceed Firestore's 1MB doc limit ──────

const CHUNK_SIZE = 1000

/**
 * Reads a large array stored as multiple numbered docs (`{docId}_0`, `{docId}_1`, …)
 * with a metadata doc (`{docId}_meta`) holding `updatedAt` and `chunkCount`.
 */
export async function readFirestoreCacheChunked<T>(docId: string): Promise<CacheEntry<T[]> | null> {
  const admin = resolveFirebaseAdminApp()
  if (!admin.ok) return null
  try {
    const db = getFirestore(admin.app)
    const meta = await db.collection(COLLECTION).doc(`${docId}_meta`).get()
    if (!meta.exists) return null
    const d = meta.data()!
    const updatedAt = (d.updatedAt as Timestamp).toDate()
    const chunkCount = Number(d.chunkCount) || 0
    if (chunkCount === 0) return { data: [], updatedAt }
    const snaps = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) =>
        db.collection(COLLECTION).doc(`${docId}_${i}`).get(),
      ),
    )
    const data = snaps.flatMap(s => (s.data()?.data as T[]) ?? [])
    return { data, updatedAt }
  } catch {
    return null
  }
}

/**
 * Writes a large array as multiple numbered docs, then updates the metadata doc.
 * Deletes leftover chunk docs if the new data has fewer chunks than the previous write.
 */
export async function writeFirestoreCacheChunked<T>(docId: string, data: T[], chunkSize = CHUNK_SIZE): Promise<void> {
  const admin = resolveFirebaseAdminApp()
  if (!admin.ok) return
  const db = getFirestore(admin.app)

  const metaSnap = await db.collection(COLLECTION).doc(`${docId}_meta`).get()
  const oldChunkCount = metaSnap.exists ? Number(metaSnap.data()!.chunkCount) || 0 : 0

  const chunks: T[][] = []
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize))
  }

  await Promise.all(
    chunks.map((chunk, i) =>
      db.collection(COLLECTION).doc(`${docId}_${i}`).set({ data: chunk }),
    ),
  )

  if (oldChunkCount > chunks.length) {
    await Promise.all(
      Array.from({ length: oldChunkCount - chunks.length }, (_, i) =>
        db.collection(COLLECTION).doc(`${docId}_${chunks.length + i}`).delete(),
      ),
    )
  }

  await db.collection(COLLECTION).doc(`${docId}_meta`).set({
    updatedAt: Timestamp.now(),
    chunkCount: chunks.length,
  })
}

/**
 * Returns the updatedAt timestamp from a chunked cache's meta doc,
 * without loading all the chunk data. Used for staleness checks.
 */
export async function readFirestoreCacheChunkedMeta(docId: string): Promise<Date | null> {
  const admin = resolveFirebaseAdminApp()
  if (!admin.ok) return null
  try {
    const db = getFirestore(admin.app)
    const meta = await db.collection(COLLECTION).doc(`${docId}_meta`).get()
    if (!meta.exists) return null
    return (meta.data()!.updatedAt as Timestamp).toDate()
  } catch {
    return null
  }
}

/** Fire-and-forget background sync. Deduplicates concurrent calls for the same docId. */
export function triggerBackgroundSync(docId: string, fn: () => Promise<void>): void {
  if (syncInFlight.has(docId)) return
  const p = fn()
    .catch(e => console.error(`[firestoreCache] background sync failed (${docId}):`, e))
    .finally(() => syncInFlight.delete(docId))
  syncInFlight.set(docId, p)
}
