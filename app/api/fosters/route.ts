import { getAsmFosterDogs } from '@/app/lib/asmDogs'
import { countTrackableFosterDogs } from '@/app/lib/fosterDirectory'
import { requireAllowedUser } from '@/app/lib/serverAuth'

export async function GET(request: Request) {
  const auth = await requireAllowedUser(request)
  if (!auth.ok) return auth.response

  try {
    const dogs = await getAsmFosterDogs()
    return Response.json(
      { count: countTrackableFosterDogs(dogs) },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
    )
  } catch (error) {
    console.error('Fosters API error:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
