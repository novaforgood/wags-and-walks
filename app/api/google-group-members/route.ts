import { fetchGoogleGroupMembersFromScript } from '@/app/lib/googleGroupMembersFetch'
import type { GroupMember } from '@/app/lib/directoryPeople'
import {
  readFirestoreCache,
  writeFirestoreCache,
  isCacheFresh,
  triggerBackgroundSync,
} from '@/app/lib/firestoreCache'

const DOC_ID = 'google_group_members'

export async function GET() {
  try {
    const cached = await readFirestoreCache<GroupMember[]>(DOC_ID)

    if (cached) {
      if (!isCacheFresh(cached.updatedAt)) {
        triggerBackgroundSync(DOC_ID, async () => {
          const members = await fetchGoogleGroupMembersFromScript()
          await writeFirestoreCache(DOC_ID, members)
        })
      }
      return Response.json({
        success: true,
        members: cached.data,
        updatedAt: cached.updatedAt.toISOString(),
      })
    }

    // Cold start — no Firestore doc yet; fetch directly and prime the cache
    const members = await fetchGoogleGroupMembersFromScript()
    writeFirestoreCache(DOC_ID, members).catch(() => {})
    return Response.json({
      success: true,
      members,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Google Group members'
    const status = message.includes('Missing GOOGLE_GROUPS_SCRIPT_URL') ? 503 : 500
    console.error('[google-group-members]', message)
    return Response.json({ success: false, error: message }, { status })
  }
}
