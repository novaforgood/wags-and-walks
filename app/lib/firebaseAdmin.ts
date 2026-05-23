import fs from 'node:fs'
import path from 'node:path'
import { initializeApp, getApps, cert, type App, type ServiceAccount } from 'firebase-admin/app'

/**
 * Server-only Firebase Admin SDK.
 *
 * Option A — env JSON (production): set `FIREBASE_SERVICE_ACCOUNT_JSON` to the full service account JSON (one line).
 * Option B — file path (local): set `FIREBASE_SERVICE_ACCOUNT_PATH` to a path to the downloaded `.json` file
 *   (relative to project root or absolute). Avoid committing that file.
 */

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '')
}

type ReadCredentials =
  | { ok: true; raw: string }
  | { ok: false; reason: 'missing' | 'path_not_found'; detail?: string }

function readCredentialJsonString(): ReadCredentials {
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (envJson) {
    return { ok: true, raw: stripBom(envJson) }
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()
  if (!filePath) {
    return { ok: false, reason: 'missing' }
  }

  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(/* turbopackIgnore: true */ process.cwd(), filePath)
  if (!fs.existsSync(resolved)) {
    return { ok: false, reason: 'path_not_found', detail: resolved }
  }

  return { ok: true, raw: stripBom(fs.readFileSync(resolved, 'utf8').trim()) }
}

export type FirebaseAdminResolve =
  | { ok: true; app: App }
  | { ok: false; code: 'ADMIN_SDK_UNAVAILABLE' | 'ADMIN_SDK_CREDENTIALS_INVALID'; detail?: string }

/**
 * Resolve Admin app or a machine-readable failure (for API routes).
 */
export function resolveFirebaseAdminApp(): FirebaseAdminResolve {
  const existing = getApps()
  if (existing.length > 0) {
    return { ok: true, app: existing[0]! }
  }

  const read = readCredentialJsonString()
  if (!read.ok) {
    if (read.reason === 'missing') {
      console.warn(
        '[firebase-admin] Set FIREBASE_SERVICE_ACCOUNT_JSON (env) or FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file).',
      )
      return { ok: false, code: 'ADMIN_SDK_UNAVAILABLE' }
    }
    console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_PATH not found:', read.detail)
    return { ok: false, code: 'ADMIN_SDK_UNAVAILABLE', detail: read.detail }
  }

  try {
    const credentials = JSON.parse(read.raw) as ServiceAccount
    const app = initializeApp({
      credential: cert(credentials),
    })
    return { ok: true, app }
  } catch (e) {
    console.error(
      '[firebase-admin] Credentials are not valid JSON. Fix FIREBASE_SERVICE_ACCOUNT_JSON or the file at FIREBASE_SERVICE_ACCOUNT_PATH.',
      e,
    )
    return { ok: false, code: 'ADMIN_SDK_CREDENTIALS_INVALID' }
  }
}

/** @deprecated Prefer resolveFirebaseAdminApp for error detail; kept for call sites that only need App | null */
export function getFirebaseAdminApp(): App | null {
  const r = resolveFirebaseAdminApp()
  return r.ok ? r.app : null
}
