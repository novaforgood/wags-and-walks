import { getFirestore } from 'firebase-admin/firestore'
import { resolveFirebaseAdminApp } from '@/app/lib/firebaseAdmin'
import type { ApplicantOverride } from '@/app/lib/applicantOverrides'

/**
 * Emergency throttle: full-collection reads of applicantOverrides burned the Spark
 * 50k/day quota (one .get() = one read per document). Writes (POST) still work.
 * Client uses localStorage + optimistic updates until per-email reads are added.
 */
const SKIP_BULK_OVERRIDE_READS =
  process.env.SKIP_APPLICANT_OVERRIDES_BULK_READ !== '0'

const TTL_MS = 30 * 60 * 1000

let cache: { map: Record<string, ApplicantOverride>; expiresAt: number } | null = null

export function invalidateApplicantOverridesCache() {
  // Keep cache warm after writes — do not re-fetch the whole collection.
}

export async function loadAllApplicantOverrides(): Promise<Record<string, ApplicantOverride>> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.map
  }

  if (SKIP_BULK_OVERRIDE_READS) {
    return cache?.map ?? {}
  }

  const admin = resolveFirebaseAdminApp()
  if (!admin.ok) return {}

  try {
    const db = getFirestore(admin.app)
    const snap = await db.collection('applicantOverrides').get()
    const map: Record<string, ApplicantOverride> = {}
    snap.forEach(d => {
      map[d.id] = d.data() as ApplicantOverride
    })
    cache = { map, expiresAt: now + TTL_MS }
    return map
  } catch {
    return {}
  }
}

/** After a successful write, merge into the in-memory cache without a collection read. */
export function mergeApplicantOverrideIntoCache(
  email: string,
  fields: ApplicantOverride,
): void {
  const key = email.trim().toLowerCase()
  if (!key) return
  const base = cache?.map ?? {}
  cache = {
    map: { ...base, [key]: { ...base[key], ...fields } },
    expiresAt: Date.now() + TTL_MS,
  }
}

/** One Firestore read per email — safe alternative to loading the whole collection. */
export async function loadApplicantOverridesByEmails(
  emails: string[],
): Promise<Record<string, ApplicantOverride>> {
  const keys = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))]
  if (keys.length === 0) return {}

  const admin = resolveFirebaseAdminApp()
  if (!admin.ok) return {}

  const db = getFirestore(admin.app)
  const map: Record<string, ApplicantOverride> = {}

  await Promise.all(
    keys.map(async key => {
      const snap = await db.collection('applicantOverrides').doc(key).get()
      if (snap.exists) {
        map[key] = snap.data() as ApplicantOverride
        mergeApplicantOverrideIntoCache(key, map[key])
      }
    }),
  )

  return map
}
