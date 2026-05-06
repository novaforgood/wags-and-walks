import { getAsmFosterDogs } from '@/app/lib/asmDogs'

export async function GET() {
  try {
    const dogs = await getAsmFosterDogs()
    return Response.json(
      { success: true, count: dogs.length, dogs },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
    )
  } catch (error) {
    console.error('Dogs API error:', error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load dogs from ASM' },
      { status: 500 }
    )
  }
}
