const TASK_SCRIPT_URL = process.env.TASK_SCRIPT_URL

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

export async function GET() {
  if (!TASK_SCRIPT_URL) {
    return Response.json({ success: true, dogs: [], unassigned: [] })
  }

  try {
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
      return Response.json(
        { success: false, error: data.error || 'Failed to fetch photo status' },
        { status: 502 }
      )
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

    return Response.json({ success: true, dogs, unassigned })
  } catch (error) {
    console.error('Photo status API error:', error)
    return Response.json({ success: false, error: 'Failed to load photo status' }, { status: 500 })
  }
}
