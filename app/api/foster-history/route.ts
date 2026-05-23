import type { NextRequest } from 'next/server'
import {
  fetchAsmFosterHistory,
  fetchAsmFosterHistoryUncached,
  groupFosterHistory,
} from '@/app/lib/asmFosterHistory'
import type { FostererHistory } from '@/app/lib/asmFosterHistory'
import {
  readFirestoreCacheChunked,
  writeFirestoreCacheChunked,
  readFirestoreCacheChunkedMeta,
  isCacheFresh,
  triggerBackgroundSync,
} from '@/app/lib/firestoreCache'

const DOC_ID = 'asm_foster_history'

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()

    // For single-email lookups, check staleness via the cheap meta doc read,
    // then only load the full dataset if we actually need to serve it.
    if (email) {
      const metaUpdatedAt = await readFirestoreCacheChunkedMeta(DOC_ID)
      if (metaUpdatedAt) {
        if (!isCacheFresh(metaUpdatedAt)) {
          triggerBackgroundSync(DOC_ID, async () => {
            const rows = await fetchAsmFosterHistoryUncached()
            await writeFirestoreCacheChunked(DOC_ID, groupFosterHistory(rows))
          })
        }
        const cached = await readFirestoreCacheChunked<FostererHistory>(DOC_ID)
        if (cached) {
          const match = cached.data.find(f => f.email?.toLowerCase() === email) ?? null
          return Response.json({ success: true, fosterer: match, updatedAt: cached.updatedAt.toISOString() })
        }
      }
      // Fall through to cold-start path below
    }

    const cached = await readFirestoreCacheChunked<FostererHistory>(DOC_ID)

    let fosterers: FostererHistory[]
    let updatedAt: string

    if (cached) {
      if (!isCacheFresh(cached.updatedAt)) {
        triggerBackgroundSync(DOC_ID, async () => {
          const rows = await fetchAsmFosterHistoryUncached()
          await writeFirestoreCacheChunked(DOC_ID, groupFosterHistory(rows))
        })
      }
      fosterers = cached.data
      updatedAt = cached.updatedAt.toISOString()
    } else {
      // Cold start — no Firestore docs yet; fetch directly and prime the cache
      const rows = await fetchAsmFosterHistory()
      fosterers = groupFosterHistory(rows)
      writeFirestoreCacheChunked(DOC_ID, fosterers).catch(() => {})
      updatedAt = new Date().toISOString()
    }

    if (email) {
      const match = fosterers.find(f => f.email?.toLowerCase() === email) ?? null
      return Response.json({ success: true, fosterer: match, updatedAt })
    }

    return Response.json({ success: true, fosterers, updatedAt })
  } catch (error) {
    console.error('[foster-history]', error instanceof Error ? error.message : error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load foster history' },
      { status: 500 },
    )
  }
}
