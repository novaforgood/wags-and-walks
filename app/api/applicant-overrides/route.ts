import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { requireAllowedUser } from '@/app/lib/serverAuth'
import { resolveFirebaseAdminApp } from '@/app/lib/firebaseAdmin'
import type { ApplicantOverride } from '@/app/lib/applicantOverrides'
import {
  loadApplicantOverridesByEmails,
  mergeApplicantOverrideIntoCache,
} from '@/app/lib/applicantOverridesServer'
import type { PersonStatus } from '@/app/lib/peopleTypes'

const ALLOWED_STATUSES: PersonStatus[] = [
  'new',
  'in-progress',
  'approved',
  'current',
  'rejected',
  'rejected_new',
  'rejected_in-progress',
  'rejected_approved',
]

function cleanFields(raw: unknown): Record<string, unknown> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const fields: Record<string, unknown> = {}

  if (input.status !== undefined && ALLOWED_STATUSES.includes(input.status as PersonStatus)) {
    fields.status = input.status
  }
  if (typeof input.starred === 'boolean') {
    fields.starred = input.starred
  }
  if (typeof input.notes === 'string') {
    fields.notes = input.notes
  }
  if (typeof input.notesUpdatedAt === 'string') {
    fields.notesUpdatedAt = input.notesUpdatedAt
  }
  if (input.signedDocument === 'Yes' || input.signedDocument === 'No') {
    fields.signedDocument = input.signedDocument
  }

  return fields
}

export async function GET(request: Request) {
  const auth = await requireAllowedUser(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const emailsParam = url.searchParams.get('emails') ?? url.searchParams.get('email')
  if (!emailsParam?.trim()) {
    // No bulk collection reads — pass ?email= or ?emails=a,b,c for per-doc loads.
    return Response.json({ success: true, overrides: {} })
  }

  const emails = emailsParam
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10)

  const overrides = await loadApplicantOverridesByEmails(emails)
  return Response.json({ success: true, overrides })
}

export async function POST(request: Request) {
  const auth = await requireAllowedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as { email?: string; fields?: unknown } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email) {
    return Response.json({ success: false, error: 'email is required' }, { status: 400 })
  }

  const fields = cleanFields(body?.fields)
  if (Object.keys(fields).length === 0) {
    return Response.json({ success: false, error: 'No supported override fields provided' }, { status: 400 })
  }

  const admin = resolveFirebaseAdminApp()
  if (!admin.ok) {
    return Response.json(
      { success: false, error: 'Firebase Admin is not configured' },
      { status: 503 },
    )
  }

  const db = getFirestore(admin.app)
  await db.collection('applicantOverrides').doc(email).set(
    {
      ...fields,
      updatedAt: Timestamp.now(),
      updatedBy: auth.user.email,
    },
    { merge: true },
  )

  mergeApplicantOverrideIntoCache(email, fields as import('@/app/lib/applicantOverrides').ApplicantOverride)

  return Response.json({ success: true })
}
