import { getAsmFosterDogs } from '@/app/lib/asmDogs'
import { countTrackableFosterDogs } from '@/app/lib/fosterDirectory'

export async function GET() {
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
