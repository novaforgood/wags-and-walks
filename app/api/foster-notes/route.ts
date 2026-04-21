import { NextRequest, NextResponse } from 'next/server'

const FOSTER_SCRIPT_URL = process.env.FOSTER_SCRIPT_URL

export async function GET(req: NextRequest) {
  if (!FOSTER_SCRIPT_URL) {
    return NextResponse.json({ success: false, error: 'FOSTER_SCRIPT_URL not configured' }, { status: 500 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ success: false, error: 'email parameter required' }, { status: 400 })
  }

  const url = `${FOSTER_SCRIPT_URL}?email=${encodeURIComponent(email)}`
  const res = await fetch(url, { method: 'GET' })
  const data = await res.json()
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!FOSTER_SCRIPT_URL) {
    return NextResponse.json({ success: false, error: 'FOSTER_SCRIPT_URL not configured' }, { status: 500 })
  }

  const body = await req.json()
  const res = await fetch(FOSTER_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_notes', ...body }),
  })
  const data = await res.json()
  return NextResponse.json(data)
}
