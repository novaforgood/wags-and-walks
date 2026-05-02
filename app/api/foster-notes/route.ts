import { NextRequest, NextResponse } from 'next/server'

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL

export async function GET(req: NextRequest) {
  if (!APPS_SCRIPT_URL) {
    return NextResponse.json({ success: false, error: 'APPS_SCRIPT_URL not configured' }, { status: 500 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ success: false, error: 'email parameter required' }, { status: 400 })
  }

  const url = `${APPS_SCRIPT_URL}?fields=${encodeURIComponent('Email,Notes,Notes Updated At')}`
  const res = await fetch(url, { method: 'GET', cache: 'no-store' })
  const data = await res.json()

  if (!data?.success || !Array.isArray(data.rows)) {
    return NextResponse.json({ success: true, notes: '', notesUpdatedAt: '' })
  }

  const emailKey = email.trim().toLowerCase()
  const row = data.rows.find((r: Record<string, unknown>) =>
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
  return NextResponse.json(data)
}
