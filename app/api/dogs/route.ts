import { getAsmFosterDogs, fetchAsmFosterDogsUncached } from '@/app/lib/asmDogs'
import {
  readFirestoreCache,
  writeFirestoreCache,
  isCacheFresh,
  triggerBackgroundSync,
} from '@/app/lib/firestoreCache'
import type { DogRecord } from '@/app/lib/asmDogs'
import { requireAllowedUser } from '@/app/lib/serverAuth'

const DOC_ID = 'asm_dogs'

// raw is ~10x the size of useful fields and is unused by all consumers — strip before persisting
function stripRaw(dogs: DogRecord[]): DogRecord[] {
  return dogs.map(({ raw: _raw, ...d }) => d)
}

export async function GET(request: Request) {
  const auth = await requireAllowedUser(request)
  if (!auth.ok) return auth.response

  try {
    const cached = await readFirestoreCache<DogRecord[]>(DOC_ID)

    if (cached) {
      if (!isCacheFresh(cached.updatedAt)) {
        triggerBackgroundSync(DOC_ID, async () => {
          const dogs = await fetchAsmFosterDogsUncached()
          await writeFirestoreCache(DOC_ID, stripRaw(dogs))
        })
      }
      return Response.json({
        success: true,
        count: cached.data.length,
        dogs: cached.data,
        updatedAt: cached.updatedAt.toISOString(),
      })
    }

    // Cold start — no Firestore doc yet; fetch directly and prime the cache
    const dogs = await getAsmFosterDogs()
    const stripped = stripRaw(dogs)
    writeFirestoreCache(DOC_ID, stripped).catch(e => console.error('[dogs] Firestore prime failed:', e))
    return Response.json({
      success: true,
      count: stripped.length,
      dogs: stripped,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Dogs API error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load dogs from ASM' },
      { status: 500 },
    )
  }
}
