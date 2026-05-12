import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Self-service account deletion.
 * Removes the caller from `allowedUsers/{email}` and deletes their Firebase
 * Authentication account. Caller must include their Firebase ID token as a
 * Bearer authorization header.
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
          ? 'FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON. Or use FIREBASE_SERVICE_ACCOUNT_PATH to a key file.'
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
  let callerUid: string | undefined
  try {
    const decoded = await getAuth(app).verifyIdToken(token)
    callerEmail = decoded.email?.toLowerCase()
    callerUid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  if (!callerEmail || !callerUid) {
    return NextResponse.json({ error: 'Authenticated user has no email or uid' }, { status: 403 })
  }

  const db = getFirestore(app)
  await db.doc(`allowedUsers/${callerEmail}`).delete()

  let deletedAuth = false
  let authDeleteError: string | undefined
  try {
    await getAuth(app).deleteUser(callerUid)
    deletedAuth = true
  } catch (e: unknown) {
    const code =
      typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : ''
    if (code === 'auth/user-not-found') {
      deletedAuth = false
    } else {
      console.error('[delete-self] Auth delete failed (allow list already removed):', e)
      authDeleteError =
        e instanceof Error
          ? e.message
          : 'Could not delete Authentication user. Contact an admin if the issue persists.'
    }
  }

  return NextResponse.json({ success: true, deletedAuth, authDeleteError })
}
