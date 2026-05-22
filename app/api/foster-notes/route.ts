import { NextRequest, NextResponse } from 'next/server'

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL
const rawTtl = Number(process.env.FOSTER_NOTES_CACHE_TTL_SEC)
const CACHE_TTL_MS =
  Math.max(15, Math.min(300, Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : 60)) * 1000

type NotesRow = Record<string, unknown>

let notesCache: { rows: NotesRow[]; expiresAt: number } | null = null
let notesInFlight: Promise<NotesRow[]> | null = null

async function fetchNotesRows(): Promise<NotesRow[]> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL not configured')
  }

  const now = Date.now()
  if (notesCache && notesCache.expiresAt > now) return notesCache.rows
  if (notesInFlight) return notesInFlight

  notesInFlight = (async () => {
    const url = `${APPS_SCRIPT_URL}?fields=${encodeURIComponent('Email,Notes,Notes Updated At')}`
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    const data = await res.json()
    const rows = data?.success && Array.isArray(data.rows) ? data.rows : []
    notesCache = { rows, expiresAt: Date.now() + CACHE_TTL_MS }
    return rows
  })().finally(() => {
    notesInFlight = null
  })

  return notesInFlight
}

export async function GET(req: NextRequest) {
  if (!APPS_SCRIPT_URL) {
    return NextResponse.json({ success: false, error: 'APPS_SCRIPT_URL not configured' }, { status: 500 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ success: false, error: 'email parameter required' }, { status: 400 })
  }

  const rows = await fetchNotesRows()

  const emailKey = email.trim().toLowerCase()
  const row = rows.find((r: Record<string, unknown>) =>
    String(r['Email'] ?? '').trim().toLowerCase() === emailKey
  )

  return NextResponse.json({
    success: true,
    notes: row?.['Notes'] ?? '',
    notesUpdatedAt: row?.['Notes Updated At'] ?? '',
  })
}

export async function POST(req: NextRequest) {
  if (!APPS_SCRIPT_URL) {
    return NextResponse.json({ success: false, error: 'APPS_SCRIPT_URL not configured' }, { status: 500 })
  }

  const body = await req.json()
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_notes', ...body }),
  })
  const data = await res.json()
  notesCache = null
  return NextResponse.json(data)
}
