import { fetchAsmFosterDogsUncached } from '@/app/lib/asmDogs'
import type { DogRecord } from '@/app/lib/asmDogs'
import { fetchAsmFosterHistoryUncached, groupFosterHistory } from '@/app/lib/asmFosterHistory'
import { fetchGoogleGroupMembersFromScript } from '@/app/lib/googleGroupMembersFetch'
import { clearPeopleApiCache, loadPeopleUncached } from '@/app/api/people/route'
import { loadTaskLogUncached } from '@/app/api/tasks/route'
import { fetchPhotoStatusUncached } from '@/app/api/photo-status/route'
import {
  writeFirestoreCache,
  writeFirestoreCacheChunked,
} from '@/app/lib/firestoreCache'
import { requireAllowedUser } from '@/app/lib/serverAuth'

const PEOPLE_FS_CHUNK_SIZE = 150

function stripRaw(dogs: DogRecord[]): DogRecord[] {
  return dogs.map(({ raw: _raw, ...d }) => d)
}

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

type SyncResult = { ok: boolean; updatedAt?: string; error?: string }

async function run(name: string, fn: () => Promise<void>): Promise<SyncResult> {
  try {
    await fn()
    console.log(`[sync/all] ${name} OK`)
    return { ok: true, updatedAt: new Date().toISOString() }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error(`[sync/all] ${name} failed:`, error)
    return { ok: false, error }
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    const auth = await requireAllowedUser(request)
    if (!auth.ok) return auth.response
  }

  const [dogs, fosterHistory, groupMembers, people, tasks, photoStatus] = await Promise.allSettled([
    run('asm_dogs', async () => {
      const data = await fetchAsmFosterDogsUncached()
      await writeFirestoreCache('asm_dogs', stripRaw(data))
    }),
    run('asm_foster_history', async () => {
      const rows = await fetchAsmFosterHistoryUncached()
      await writeFirestoreCacheChunked('asm_foster_history', groupFosterHistory(rows))
    }),
    run('google_group_members', async () => {
      const members = await fetchGoogleGroupMembersFromScript()
      await writeFirestoreCache('google_group_members', members)
    }),
    run('people', async () => {
      const data = await loadPeopleUncached()
      await writeFirestoreCacheChunked('people', data, PEOPLE_FS_CHUNK_SIZE)
      clearPeopleApiCache()
    }),
    run('tasks', async () => {
      const data = await loadTaskLogUncached()
      await writeFirestoreCache('tasks', data)
    }),
    run('photo_status', async () => {
      const data = await fetchPhotoStatusUncached()
      await writeFirestoreCache('photo_status', data)
    }),
  ])

  const results = {
    dogs: dogs.status === 'fulfilled' ? dogs.value : { ok: false, error: 'Promise rejected' },
    fosterHistory: fosterHistory.status === 'fulfilled' ? fosterHistory.value : { ok: false, error: 'Promise rejected' },
    groupMembers: groupMembers.status === 'fulfilled' ? groupMembers.value : { ok: false, error: 'Promise rejected' },
    people: people.status === 'fulfilled' ? people.value : { ok: false, error: 'Promise rejected' },
    tasks: tasks.status === 'fulfilled' ? tasks.value : { ok: false, error: 'Promise rejected' },
    photoStatus: photoStatus.status === 'fulfilled' ? photoStatus.value : { ok: false, error: 'Promise rejected' },
  }

  const allOk = Object.values(results).every(r => r.ok)
  return Response.json({ success: allOk, results }, { status: allOk ? 200 : 207 })
}
