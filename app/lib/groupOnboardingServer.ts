import type { GroupMember } from '@/app/lib/directoryPeople'
import { normalizeEmail } from '@/app/lib/directoryPeople'
import {
  buildGroupOnboardingStats,
  type GroupOnboardingStats,
} from '@/app/lib/groupOnboarding'
import { fetchGoogleGroupMembersFromScript } from '@/app/lib/googleGroupMembersFetch'

const LEGACY_ISO = '1970-01-01T00:00:00.000Z'
const FIRESTORE_COLLECTION = 'groupMemberFirstSeen'
const FIRESTORE_META_DOC = 'groupOnboarding/meta'

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL
const APPS_SCRIPT_KEY = process.env.APPS_SCRIPT_KEY

function memberEmails(members: GroupMember[]): string[] {
  const out: string[] = []
  for (const m of members) {
    const email = normalizeEmail(m.email)
    if (email) out.push(email)
  }
  return out
}

function docIdForEmail(email: string): string {
  return email.toLowerCase().replace(/\//g, '_')
}

export async function fetchGroupOnboardingViaGroupsScript(
  month?: string
): Promise<GroupOnboardingStats | null> {
  const scriptUrl = process.env.GOOGLE_GROUPS_SCRIPT_URL
  if (!scriptUrl) return null

  const url = new URL(scriptUrl)
  url.searchParams.set('action', 'group_onboarding')
  const scriptKey = process.env.GOOGLE_GROUPS_SCRIPT_KEY
  if (scriptKey) url.searchParams.set('key', scriptKey)
  if (month) url.searchParams.set('month', month)

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  if (!res.ok) return null
  const obj = json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  if (obj?.success === false) return null
  const onboarding = obj?.onboarding
  if (!onboarding || typeof onboarding !== 'object') return null
  return onboarding as GroupOnboardingStats
}

async function syncViaFirestore(
  members: GroupMember[],
  month?: string
): Promise<GroupOnboardingStats | null> {
  const { resolveFirebaseAdminApp } = await import('@/app/lib/firebaseAdmin')
  const { getFirestore } = await import('firebase-admin/firestore')

  const resolved = resolveFirebaseAdminApp()
  if (!resolved.ok) return null

  const db = getFirestore(resolved.app)
  const metaRef = db.doc(FIRESTORE_META_DOC)
  const metaSnap = await metaRef.get()
  const seeded = metaSnap.data()?.seeded === true
  const now = new Date().toISOString()
  const emails = memberEmails(members)

  if (!seeded && emails.length > 0) {
    const batch = db.batch()
    for (const email of emails) {
      const ref = db.collection(FIRESTORE_COLLECTION).doc(docIdForEmail(email))
      batch.set(ref, { email, firstSeenAt: LEGACY_ISO }, { merge: true })
    }
    batch.set(metaRef, { seeded: true, seededAt: now }, { merge: true })
    await batch.commit()
  }

  for (const email of emails) {
    const ref = db.collection(FIRESTORE_COLLECTION).doc(docIdForEmail(email))
    const snap = await ref.get()
    if (!snap.exists) {
      await ref.set({ email, firstSeenAt: now })
    }
  }

  const all = await db.collection(FIRESTORE_COLLECTION).get()
  const firstSeenByEmail: Record<string, string> = {}
  for (const doc of all.docs) {
    const data = doc.data()
    const email = normalizeEmail(String(data.email || ''))
    const firstSeenAt = String(data.firstSeenAt || '')
    if (email && firstSeenAt) firstSeenByEmail[email] = firstSeenAt
  }

  const timeZone =
    process.env.GROUP_ONBOARDING_TIMEZONE?.trim() || 'America/Los_Angeles'
  return buildGroupOnboardingStats(firstSeenByEmail, timeZone, new Date(), month)
}

async function syncViaMainAppsScript(members: GroupMember[]): Promise<GroupOnboardingStats | null> {
  if (!APPS_SCRIPT_URL) return null

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      action: 'sync_group_onboarding',
      emails: memberEmails(members),
      key: APPS_SCRIPT_KEY,
    }),
  })
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const obj = json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  if (!res.ok || obj?.success === false) return null
  const onboarding = obj?.onboarding
  if (!onboarding || typeof onboarding !== 'object') return null
  return onboarding as GroupOnboardingStats
}

/**
 * Group onboarding stats: Groups script action → Firestore ledger → Sheet 1 Apps Script POST.
 */
export async function loadGroupOnboardingStats(
  month?: string
): Promise<{ onboarding: GroupOnboardingStats; source: string }> {
  const fromScript = await fetchGroupOnboardingViaGroupsScript(month)
  if (fromScript) {
    return { onboarding: fromScript, source: 'google_groups_script' }
  }

  const members = await fetchGoogleGroupMembersFromScript()
  const fromFirestore = await syncViaFirestore(members, month)
  if (fromFirestore) {
    return { onboarding: fromFirestore, source: 'firestore' }
  }

  const fromMainScript = await syncViaMainAppsScript(members)
  if (fromMainScript) {
    return { onboarding: fromMainScript, source: 'apps_script' }
  }

  throw new Error(
    'Onboarding tracking is not available. Redeploy the Google Group Apps Script (group_onboarding), or set FIREBASE_SERVICE_ACCOUNT_JSON on the server, or redeploy Sheet 1 Apps Script with sync_group_onboarding.'
  )
}
