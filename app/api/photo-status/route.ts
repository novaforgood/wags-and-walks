import {
  readFirestoreCache,
  writeFirestoreCache,
  isCacheFresh,
  triggerBackgroundSync,
} from '@/app/lib/firestoreCache'

const TASK_SCRIPT_URL = process.env.TASK_SCRIPT_URL
const PHOTO_STATUS_FS_DOC_ID = 'photo_status'

export type PhotoDog = {
  animalId: string
  dogName: string
  folderId: string
  folderUrl: string
  parentFolderId: string
  folderName?: string
  folderType?: string
  mediaCount?: number
  lastUploadAt?: string
  latestFileUrl?: string
  lastScannedAt?: string
}

export type PhotoUnassignedFolder = {
  folderId: string
  folderName: string
  parentFolderId: string
  folderType: string
  mediaCount: number
  lastUploadAt: string
  latestFileUrl: string
  lastScannedAt: string
}

type PhotoStatusResponse = { dogs: PhotoDog[]; unassigned: PhotoUnassignedFolder[] }

/** Uncached fetch for use in sync routes. */
export async function fetchPhotoStatusUncached(): Promise<PhotoStatusResponse> {
  if (!TASK_SCRIPT_URL) return { dogs: [], unassigned: [] }

  const url = new URL(TASK_SCRIPT_URL)
  url.searchParams.set('action', 'photoStatus')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = (await res.json()) as {
    success?: boolean
    dogs?: Record<string, unknown>[]
    unassigned?: Record<string, unknown>[]
    error?: string
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch photo status')
  }

  const dogs: PhotoDog[] = (data.dogs ?? []).map(r => ({
    animalId: String(r.animalId ?? '').trim(),
    dogName: String(r.dogName ?? '').trim(),
    folderId: String(r.folderId ?? '').trim(),
    folderUrl: String(r.folderUrl ?? '').trim(),
    parentFolderId: String(r.parentFolderId ?? '').trim(),
    folderName: String(r.folderName ?? '').trim(),
    folderType: String(r.folderType ?? '').trim(),
    mediaCount: Number(r.mediaCount) || 0,
    lastUploadAt: String(r.lastUploadAt ?? '').trim(),
    latestFileUrl: String(r.latestFileUrl ?? '').trim(),
    lastScannedAt: String(r.lastScannedAt ?? '').trim(),
  }))

  const unassigned: PhotoUnassignedFolder[] = (data.unassigned ?? []).map(r => ({
    folderId: String(r.folderId ?? '').trim(),
    folderName: String(r.folderName ?? '').trim(),
    parentFolderId: String(r.parentFolderId ?? '').trim(),
    folderType: String(r.folderType ?? '').trim(),
    mediaCount: Number(r.mediaCount) || 0,
    lastUploadAt: String(r.lastUploadAt ?? '').trim(),
    latestFileUrl: String(r.latestFileUrl ?? '').trim(),
    lastScannedAt: String(r.lastScannedAt ?? '').trim(),
  }))

  return { dogs, unassigned }
}

export async function GET() {
  if (!TASK_SCRIPT_URL) {
    return Response.json({ success: true, dogs: [], unassigned: [] })
  }

  // Firestore cache
  const fsCached = await readFirestoreCache<PhotoStatusResponse>(PHOTO_STATUS_FS_DOC_ID)
  if (fsCached) {
    if (!isCacheFresh(fsCached.updatedAt)) {
      triggerBackgroundSync(PHOTO_STATUS_FS_DOC_ID, async () => {
        const data = await fetchPhotoStatusUncached()
        await writeFirestoreCache(PHOTO_STATUS_FS_DOC_ID, data)
      })
    }
    return Response.json({ success: true, ...fsCached.data })
  }

  // Cold start
  try {
    const data = await fetchPhotoStatusUncached()
    writeFirestoreCache(PHOTO_STATUS_FS_DOC_ID, data)
      .catch(e => console.error('[photo-status] Firestore prime failed:', e))
    return Response.json({ success: true, ...data })
  } catch (error) {
    console.error('Photo status API error:', error)
    return Response.json({ success: false, error: 'Failed to load photo status' }, { status: 500 })
  }
}
