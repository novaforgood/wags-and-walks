import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { resolveFirebaseAdminApp } from './firebaseAdmin'
import type { UserRole } from './allowedUsers'

export type ServerUser = {
  uid: string
  email: string
  role: UserRole
}

export type ServerAuthResult =
  | { ok: true; user: ServerUser }
  | { ok: false; response: Response }

function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization')
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() || null : null
}

export async function requireAllowedUser(request: Request): Promise<ServerAuthResult> {
  const token = bearerToken(request)
  if (!token) {
    return {
      ok: false,
      response: Response.json({ success: false, error: 'Missing Authorization bearer token' }, { status: 401 }),
    }
  }

  const resolved = resolveFirebaseAdminApp()
  if (!resolved.ok) {
    return {
      ok: false,
      response: Response.json(
        { success: false, code: resolved.code, error: 'Firebase Admin is not configured' },
        { status: 503 },
      ),
    }
  }

  try {
    const decoded = await getAuth(resolved.app).verifyIdToken(token)
    const email = decoded.email?.trim().toLowerCase()
    if (!email) {
      return {
        ok: false,
        response: Response.json({ success: false, error: 'Authenticated user has no email' }, { status: 403 }),
      }
    }

    const snap = await getFirestore(resolved.app).doc(`allowedUsers/${email}`).get()
    const role = snap.data()?.role
    if (role !== 'admin' && role !== 'user') {
      return {
        ok: false,
        response: Response.json({ success: false, error: 'Portal access required' }, { status: 403 }),
      }
    }

    return { ok: true, user: { uid: decoded.uid, email, role } }
  } catch {
    return {
      ok: false,
      response: Response.json({ success: false, error: 'Invalid or expired token' }, { status: 401 }),
    }
  }
}

export async function requireAdminUser(request: Request): Promise<ServerAuthResult> {
  const result = await requireAllowedUser(request)
  if (!result.ok) return result
  if (result.user.role !== 'admin') {
    return {
      ok: false,
      response: Response.json({ success: false, error: 'Admin access required' }, { status: 403 }),
    }
  }
  return result
}
