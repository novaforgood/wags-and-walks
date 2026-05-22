import type { GroupOnboardingStats } from '@/app/lib/groupOnboarding'
import { loadGroupOnboardingStats } from '@/app/lib/groupOnboardingServer'

/** group_onboarding can paginate the full group roster on a cold cache. */
export const maxDuration = 60

const rawTtl = Number(process.env.GOOGLE_GROUP_ONBOARDING_CACHE_TTL_SEC)
const CACHE_TTL_SEC = Math.max(30, Math.min(600, Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : 120))

let memoryCache: { expires: number; onboarding: GroupOnboardingStats; source: string } | null = null
let inFlight: Promise<{ onboarding: GroupOnboardingStats; source: string }> | null = null

/**
 * Foster Google Group onboarding counts (new emails first seen each calendar month).
 * Tries Groups Apps Script, then Firestore, then Sheet 1 Apps Script sync.
 * Optional `?month=YYYY-MM` is passed through when the Groups script supports it.
 */
export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get('month')?.trim() || undefined
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return Response.json({ success: false, error: 'month must be YYYY-MM' }, { status: 400 })
    }

    if (!month) {
      const now = Date.now()
      if (memoryCache && memoryCache.expires > now) {
        return Response.json(
          { success: true, onboarding: memoryCache.onboarding, source: memoryCache.source },
          { headers: { 'Cache-Control': `private, max-age=${CACHE_TTL_SEC}` } }
        )
      }
      if (!inFlight) {
        inFlight = loadGroupOnboardingStats(undefined, { syncMembers: true })
          .then(result => {
            memoryCache = {
              expires: Date.now() + CACHE_TTL_SEC * 1000,
              ...result,
            }
            return result
          })
          .finally(() => {
            inFlight = null
          })
      }
      const { onboarding, source } = await inFlight
      return Response.json(
        { success: true, onboarding, source },
        { headers: { 'Cache-Control': `private, max-age=${CACHE_TTL_SEC}` } }
      )
    }

    const { onboarding, source } = await loadGroupOnboardingStats(month)
    return Response.json(
      { success: true, onboarding, source },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load group onboarding'
    const status = message.includes('Missing GOOGLE_GROUPS_SCRIPT_URL') ? 503 : 502
    console.error('[google-group-onboarding]', message)
    return Response.json({ success: false, error: message }, { status })
  }
}
