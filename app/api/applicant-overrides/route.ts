import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { requireAllowedUser } from '@/app/lib/serverAuth'
import { resolveFirebaseAdminApp } from '@/app/lib/firebaseAdmin'
import type { ApplicantOverride } from '@/app/lib/applicantOverrides'
import {
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

export async function GET() {
  // Bulk override reads disabled — use client localStorage + POST writes only.
  return Response.json({ success: true, overrides: {} })
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
