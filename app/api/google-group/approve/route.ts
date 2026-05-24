import { requireAllowedUser } from '@/app/lib/serverAuth'

const LEGACY_APPROVAL_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyCk2eN4T6TTtaNF04U7nyM9TDKQOb_2Yw2UDTFbOFv6bmWxqk49sh-ndm7xzVxxskT/exec'

const APPROVAL_SCRIPT_URL =
  process.env.GOOGLE_GROUP_APPROVAL_SCRIPT_URL || LEGACY_APPROVAL_SCRIPT_URL
const APPROVAL_SCRIPT_KEY = process.env.GOOGLE_GROUP_APPROVAL_SCRIPT_KEY

export async function POST(request: Request) {
  const auth = await requireAllowedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as { email?: string } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email) {
    return Response.json({ success: false, error: 'email is required' }, { status: 400 })
  }

  try {
    const url = new URL(APPROVAL_SCRIPT_URL)
    if (APPROVAL_SCRIPT_KEY) url.searchParams.set('key', APPROVAL_SCRIPT_KEY)

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!res.ok) {
      return Response.json(
        { success: false, error: `Approval script failed (${res.status})` },
        { status: 502 },
      )
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('[google-group/approve]', error)
    return Response.json({ success: false, error: 'Failed to approve Google Group member' }, { status: 500 })
  }
}
