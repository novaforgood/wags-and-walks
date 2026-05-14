import type { GroupMember } from '@/app/lib/directoryPeople'
import { normalizeEmail } from '@/app/lib/directoryPeople'

const SCRIPT_URL = process.env.GOOGLE_GROUPS_SCRIPT_URL
/** Optional; appended as `key` query param like other Apps Script proxies. */
const SCRIPT_KEY = process.env.GOOGLE_GROUPS_SCRIPT_KEY

/** Successful responses: cache this long (seconds). Default 5 min — cuts Apps Script / Google Groups quota usage. */
const rawTtl = Number(process.env.GOOGLE_GROUP_MEMBERS_CACHE_TTL_SEC)
const CACHE_TTL_SEC = Math.max(30, Math.min(3600, Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : 300))
/** After upstream errors, avoid hammering Apps Script (seconds). */
const rawErrTtl = Number(process.env.GOOGLE_GROUP_MEMBERS_ERROR_CACHE_SEC)
const ERROR_CACHE_TTL_SEC = Math.max(15, Math.min(300, Number.isFinite(rawErrTtl) && rawErrTtl > 0 ? rawErrTtl : 45))

type CachedPayload = {
  status: number
  body: string
}

type CacheState = 'fresh' | 'stale' | 'miss'

let memoryCache: { expires: number; payload: CachedPayload } | null = null
let inFlight: Promise<CachedPayload> | null = null

function buildUrl(): URL {
  if (!SCRIPT_URL) {
    throw new Error('Missing GOOGLE_GROUPS_SCRIPT_URL')
  }
  const url = new URL(SCRIPT_URL)
  url.searchParams.set('action', 'group_members')
  if (SCRIPT_KEY) {
    url.searchParams.set('key', SCRIPT_KEY)
  }
  return url
}

function coerceMembers(data: unknown): GroupMember[] {
  if (!data || typeof data !== 'object') return []

  const obj = data as Record<string, unknown>

  if (Array.isArray(obj.members)) {
    return parseMemberArray(obj.members)
  }
  if (Array.isArray(obj.emails)) {
    return (obj.emails as unknown[])
      .map(e => ({ email: String(e || '').trim() }))
      .filter(m => normalizeEmail(m.email))
  }
  if (Array.isArray(obj.rows)) {
    return parseMemberArray(obj.rows)
  }

  return []
}

function parseMemberArray(arr: unknown[]): GroupMember[] {
  const out: GroupMember[] = []
  for (const item of arr) {
    if (typeof item === 'string') {
      const email = item.trim()
      if (normalizeEmail(email)) out.push({ email })
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const email = String(o.email ?? o.Email ?? o.EMAIL ?? '').trim()
      if (!normalizeEmail(email)) continue
      const name = String(o.name ?? o.Name ?? o.displayName ?? '').trim() || undefined
      out.push({ email, name })
    }
  }
  return out
}

async function refreshFromUpstream(): Promise<CachedPayload> {
  try {
    const url = buildUrl()
    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    const text = await res.text()

    let looksSuccessful = res.ok
    if (looksSuccessful) {
      try {
        const j = JSON.parse(text) as { success?: boolean }
        if (j && j.success === false) looksSuccessful = false
      } catch {
        looksSuccessful = false
      }
    }

    const ttlMs = (looksSuccessful ? CACHE_TTL_SEC : ERROR_CACHE_TTL_SEC) * 1000
    const payload = { status: res.status, body: text }
    memoryCache = {
      expires: Date.now() + ttlMs,
      payload,
    }
    return payload
  } catch (e) {
    if (memoryCache && memoryCache.payload.status >= 200 && memoryCache.payload.status < 300) {
      memoryCache = {
        ...memoryCache,
        expires: Date.now() + ERROR_CACHE_TTL_SEC * 1000,
      }
      return memoryCache.payload
    }
    const msg = e instanceof Error ? e.message : 'Network error calling Google Group script'
    const payload = {
      status: 502,
      body: JSON.stringify({ success: false, error: msg }),
    }
    memoryCache = {
      expires: Date.now() + ERROR_CACHE_TTL_SEC * 1000,
      payload,
    }
    return payload
  }
}

function startRefresh() {
  if (!inFlight) {
    inFlight = refreshFromUpstream().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

async function ensureCache(): Promise<{ payload: CachedPayload; state: CacheState }> {
  const now = Date.now()
  if (memoryCache && memoryCache.expires > now) {
    return { payload: memoryCache.payload, state: 'fresh' }
  }

  if (memoryCache) {
    void startRefresh()
    return { payload: memoryCache.payload, state: 'stale' }
  }

  const payload = await startRefresh()
  return { payload, state: 'miss' }
}

function cacheHeaders(state: CacheState) {
  return {
    'Cache-Control': `private, max-age=${state === 'fresh' ? CACHE_TTL_SEC : 0}, stale-while-revalidate=${CACHE_TTL_SEC}`,
    'X-Directory-Cache': state,
  }
}

/**
 * Proxies the Google Group membership Apps Script deployment.
 * Always calls the web app with `?action=group_members` (required by the script).
 *
 * **Caching:** In-memory cache + single-flight deduplication so rapid Directory loads
 * (dev refresh, multiple tabs) do not each trigger a fresh Google Groups API read in Apps Script.
 * Tune with `GOOGLE_GROUP_MEMBERS_CACHE_TTL_SEC` (default 300) and
 * `GOOGLE_GROUP_MEMBERS_ERROR_CACHE_SEC` (default 45).
 */
export async function GET() {
  try {
    const { payload, state } = await ensureCache()
    const { status, body: text } = payload

    let json: unknown
    try {
      json = JSON.parse(text) as unknown
    } catch {
      return Response.json(
        { success: false, error: 'Google Group script did not return valid JSON' },
        { status: 502 }
      )
    }

    if (!status || status < 200 || status >= 300) {
      const err =
        json && typeof json === 'object' && 'error' in json
          ? String((json as { error?: unknown }).error)
          : `HTTP ${status}`
      const outStatus = status >= 400 && status < 600 ? status : 502
      return Response.json({ success: false, error: err }, { status: outStatus })
    }

    const obj = json && typeof json === 'object' ? (json as Record<string, unknown>) : null
    if (obj && obj.success === false) {
      return Response.json(
        {
          success: false,
          error: String(obj.error || 'Google Group script reported failure'),
        },
        { status: 502 }
      )
    }

    const members = coerceMembers(json)

    return Response.json(
      { success: true, members },
      {
        headers: cacheHeaders(state),
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Google Group members'
    const status = message.includes('Missing GOOGLE_GROUPS_SCRIPT_URL') ? 503 : 500
    console.error('[google-group-members]', message)
    return Response.json({ success: false, error: message }, { status })
  }
}
