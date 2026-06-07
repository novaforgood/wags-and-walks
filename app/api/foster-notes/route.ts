import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { requireAllowedUser } from '@/app/lib/serverAuth'

const COLLECTION = 'fosterNotes'

function noteKey(email: string): string {
  return email.trim().toLowerCase()
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  const maybeDate = value as { toDate?: () => Date } | undefined
  if (typeof maybeDate?.toDate === 'function') {
    const date = maybeDate.toDate()
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }
  return ''
}

export async function GET(req: NextRequest) {
  const auth = await requireAllowedUser(req)
  if (!auth.ok) return auth.response

  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ success: false, error: 'email parameter required' }, { status: 400 })
  }

  const snap = await getFirestore().collection(COLLECTION).doc(noteKey(email)).get()
  const data = snap.data()

  return NextResponse.json({
    success: true,
    notes: data?.notes ?? '',
    notesUpdatedAt: timestampToIso(data?.updatedAt),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAllowedUser(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null) as { email?: string; content?: string } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 })
  }

  await getFirestore().collection(COLLECTION).doc(noteKey(email)).set(
    {
      notes: String(body?.content ?? ''),
      updatedAt: Timestamp.now(),
      updatedBy: auth.user.email,
    },
    { merge: true }
  )

  return NextResponse.json({ success: true })
}
