import type { NextRequest } from 'next/server'
import { fetchAsmFosterHistory, groupFosterHistory } from '@/app/lib/asmFosterHistory'

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()

    const rows = await fetchAsmFosterHistory()
    const grouped = groupFosterHistory(rows)

    if (email) {
      const match = grouped.find(f => f.email?.toLowerCase() === email) ?? null
      return Response.json({ success: true, fosterer: match })
    }

    return Response.json({ success: true, fosterers: grouped })
  } catch (error) {
    console.error('[foster-history]', error instanceof Error ? error.message : error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load foster history' },
      { status: 500 }
    )
  }
}
