import type { NextRequest } from 'next/server'
import { fetchAsmFosterHistory, groupFosterHistory } from '@/app/lib/asmFosterHistory'
import type { FostererHistory } from '@/app/lib/asmFosterHistory'

const rawTtl = Number(process.env.FOSTER_HISTORY_CACHE_TTL_SEC)
const CACHE_TTL_SEC = Math.max(30, Math.min(1800, Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : 300))

let fosterHistoryCache: { expires: number; fosterers: FostererHistory[] } | null = null
let fosterHistoryInFlight: Promise<FostererHistory[]> | null = null

async function loadFosterHistory(): Promise<FostererHistory[]> {
  const rows = await fetchAsmFosterHistory()
  return groupFosterHistory(rows)
}

async function getCachedFosterHistory(): Promise<FostererHistory[]> {
  const now = Date.now()
  if (fosterHistoryCache && fosterHistoryCache.expires > now) {
    return fosterHistoryCache.fosterers
  }

  if (!fosterHistoryInFlight) {
    fosterHistoryInFlight = loadFosterHistory()
      .then((fosterers) => {
        fosterHistoryCache = {
          expires: Date.now() + CACHE_TTL_SEC * 1000,
          fosterers,
        }
        return fosterers
      })
      .finally(() => {
        fosterHistoryInFlight = null
      })
  }

  return fosterHistoryInFlight
}

function cacheHeaders() {
  return {
    'Cache-Control': `private, max-age=0, s-maxage=${CACHE_TTL_SEC}`,
  }
}

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()

    const grouped = await getCachedFosterHistory()

    if (email) {
      const match = grouped.find(f => f.email?.toLowerCase() === email) ?? null
      return Response.json({ success: true, fosterer: match }, { headers: cacheHeaders() })
    }

    return Response.json({ success: true, fosterers: grouped }, { headers: cacheHeaders() })
  } catch (error) {
    console.error('[foster-history]', error instanceof Error ? error.message : error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load foster history' },
      { status: 500 }
    )
  }
}
