import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Removes a user from portal access: deletes `allowedUsers/{email}` and, if present,
 * deletes their Firebase Authentication account. Caller must be an admin (verified via ID token + Firestore).
 */
export async function POST(request: Request) {
  const [{ resolveFirebaseAdminApp }, { getAuth }, { getFirestore }] = await Promise.all([
    import('@/app/lib/firebaseAdmin'),
    import('firebase-admin/auth'),
    import('firebase-admin/firestore'),
  ])

  const resolved = resolveFirebaseAdminApp()
  if (!resolved.ok) {
    const invalid = resolved.code === 'ADMIN_SDK_CREDENTIALS_INVALID'
    return NextResponse.json(
      {
        code: resolved.code,
        detail: resolved.detail,
        error: invalid
          ? 'FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON (check quoting / one line). Or use FIREBASE_SERVICE_ACCOUNT_PATH to a key file.'
          : 'Firebase Admin is not configured on this server (missing FIREBASE_SERVICE_ACCOUNT_JSON).',
      },
      { status: 503 }
    )
  }

  const app = resolved.app

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 })
  }

  let callerEmail: string | undefined
  try {
    const decoded = await getAuth(app).verifyIdToken(token)
    callerEmail = decoded.email?.toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  if (!callerEmail) {
    return NextResponse.json({ error: 'Authenticated user has no email' }, { status: 403 })
  }

  const db = getFirestore(app)
  const callerSnap = await db.doc(`allowedUsers/${callerEmail}`).get()
  const callerRole = callerSnap.data()?.role as string | undefined
  if (callerRole !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const targetEmail = String(body.email || '')
    .trim()
    .toLowerCase()
  if (!targetEmail) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  if (targetEmail === callerEmail) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })
  }

  await db.doc(`allowedUsers/${targetEmail}`).delete()

  let deletedAuth = false
  let authDeleteError: string | undefined
  try {
    const userRecord = await getAuth(app).getUserByEmail(targetEmail)
    await getAuth(app).deleteUser(userRecord.uid)
    deletedAuth = true
  } catch (e: unknown) {
    const code =
      typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : ''
    if (code === 'auth/user-not-found') {
      deletedAuth = false
    } else {
      console.error('[remove-portal-user] Auth delete failed (allow list already removed):', e)
      authDeleteError =
        e instanceof Error ? e.message : 'Could not delete Authentication user (check IAM / Firebase Auth Admin permissions on the service account).'
    }
  }

  return NextResponse.json({
    success: true,
    deletedAuth,
    authDeleteError,
  })
}
