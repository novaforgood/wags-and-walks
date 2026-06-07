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
const FIRESTORE_BATCH_LIMIT = 400

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

async function readFirestoreLedger(
  month?: string
): Promise<GroupOnboardingStats | null> {
  const { resolveFirebaseAdminApp } = await import('@/app/lib/firebaseAdmin')
  const { getFirestore } = await import('firebase-admin/firestore')

  const resolved = resolveFirebaseAdminApp()
  if (!resolved.ok) return null

  const db = getFirestore(resolved.app)
  const snapshot = await db.collection(FIRESTORE_COLLECTION).get()
  if (snapshot.empty) return null

  const firstSeenByEmail: Record<string, string> = {}
  for (const doc of snapshot.docs) {
    const data = doc.data()
    const email = normalizeEmail(String(data.email || doc.id || ''))
    const firstSeenAt = String(data.firstSeenAt || '')
    if (email && firstSeenAt) firstSeenByEmail[email] = firstSeenAt
  }

  const timeZone =
    process.env.GROUP_ONBOARDING_TIMEZONE?.trim() || 'America/Los_Angeles'
  return buildGroupOnboardingStats(firstSeenByEmail, timeZone, new Date(), month)
}

async function syncNewMembersToFirestore(members: GroupMember[]): Promise<void> {
  const { resolveFirebaseAdminApp } = await import('@/app/lib/firebaseAdmin')
  const { getFirestore } = await import('firebase-admin/firestore')

  const resolved = resolveFirebaseAdminApp()
  if (!resolved.ok) return

  const db = getFirestore(resolved.app)
  const metaRef = db.doc(FIRESTORE_META_DOC)
  const snapshot = await db.collection(FIRESTORE_COLLECTION).get()

  const known = new Set<string>()
  for (const doc of snapshot.docs) {
    const data = doc.data()
    const email = normalizeEmail(String(data.email || ''))
    if (email) known.add(email)
  }

  const emails = memberEmails(members)
  const now = new Date().toISOString()
  const seeded = (await metaRef.get()).data()?.seeded === true
  let batch = db.batch()
  let ops = 0

  async function flush() {
    if (ops === 0) return
    await batch.commit()
    batch = db.batch()
    ops = 0
  }

  if (!seeded && emails.length > 0) {
    for (const email of emails) {
      if (known.has(email)) continue
      batch.set(
        db.collection(FIRESTORE_COLLECTION).doc(docIdForEmail(email)),
        { email, firstSeenAt: LEGACY_ISO },
        { merge: true }
      )
      known.add(email)
      ops += 1
      if (ops >= FIRESTORE_BATCH_LIMIT) await flush()
    }
    batch.set(metaRef, { seeded: true, seededAt: now }, { merge: true })
    ops += 1
    await flush()
  }

  for (const email of emails) {
    if (known.has(email)) continue
    batch.set(
      db.collection(FIRESTORE_COLLECTION).doc(docIdForEmail(email)),
      { email, firstSeenAt: now },
      { merge: true }
    )
    ops += 1
    if (ops >= FIRESTORE_BATCH_LIMIT) await flush()
  }
  await flush()
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

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)
  let res: Response
  let text: string
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    text = await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }

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

/**
 * Fast read from Firestore ledger, then optional background member sync.
 */
export async function loadGroupOnboardingStats(
  month?: string,
  options?: { syncMembers?: boolean }
): Promise<{ onboarding: GroupOnboardingStats; source: string }> {
  const syncMembers = options?.syncMembers !== false

  const fromLedger = await readFirestoreLedger(month)
  if (fromLedger && fromLedger.memberCount > 0) {
    if (syncMembers) {
      void fetchGoogleGroupMembersFromScript()
        .then(members => syncNewMembersToFirestore(members))
        .catch(e => console.error('[google-group-onboarding] background sync failed:', e))
    }
    return { onboarding: fromLedger, source: 'firestore' }
  }

  let members: GroupMember[] = []
  if (syncMembers) {
    try {
      members = await fetchGoogleGroupMembersFromScript()
    } catch (e) {
      console.error('[google-group-onboarding] group_members fetch failed:', e)
    }

    if (members.length > 0) {
      await syncNewMembersToFirestore(members)
      const afterSync = await readFirestoreLedger(month)
      if (afterSync) {
        return { onboarding: afterSync, source: 'firestore' }
      }
    }
  }

  const fromScript = await fetchGroupOnboardingViaGroupsScript(month)
  if (fromScript) {
    return { onboarding: fromScript, source: 'google_groups_script' }
  }

  throw new Error(
    'Onboarding tracking is not available. Set FIREBASE_SERVICE_ACCOUNT_JSON or configure Google Group Apps Script (group_onboarding).'
  )
}
