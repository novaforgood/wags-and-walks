import type { Person, PersonStatus } from '@/app/lib/peopleTypes'
import {
  readFirestoreCacheChunked,
  writeFirestoreCacheChunked,
  isCacheFresh,
  triggerBackgroundSync,
} from '@/app/lib/firestoreCache'
import { getFirestore } from 'firebase-admin/firestore'
import { resolveFirebaseAdminApp } from '@/app/lib/firebaseAdmin'
import type { ApplicantOverride } from '@/app/lib/applicantOverrides'
import { overrideKey } from '@/app/lib/applicantOverrides'
import { requireAllowedUser } from '@/app/lib/serverAuth'

const PEOPLE_FS_DOC_ID = 'people'
const PEOPLE_FS_CHUNK_SIZE = 150
const PEOPLE_FS_TTL_MS = 30 * 60 * 1000

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL
const APPS_SCRIPT_KEY = process.env.APPS_SCRIPT_KEY
const rawPeopleCacheTtl = Number(process.env.PEOPLE_CACHE_TTL_SEC)
const PEOPLE_CACHE_TTL_MS =
  Math.max(5, Math.min(120, Number.isFinite(rawPeopleCacheTtl) && rawPeopleCacheTtl > 0 ? rawPeopleCacheTtl : 20)) * 1000

type PeopleGetResponse = {
  success: true
  people: Person[]
  updatedAt: string
}

let peopleCache: { data: PeopleGetResponse; expiresAt: number } | null = null
let peopleInFlight: Promise<PeopleGetResponse> | null = null

function peopleCacheHeaders() {
  return {
    'Cache-Control': `private, max-age=0, s-maxage=${Math.floor(PEOPLE_CACHE_TTL_MS / 1000)}`,
  }
}

function buildAppsScriptUrl(searchParams: Record<string, string>) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('Missing APPS_SCRIPT_URL')
  }

  const url = new URL(APPS_SCRIPT_URL)
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v)
  }
  if (APPS_SCRIPT_KEY) {
    url.searchParams.set('key', APPS_SCRIPT_KEY)
  }
  return url
}

function parseTimestampToIso(raw: unknown): string | undefined {
  if (!raw) return undefined
  const s = String(raw).trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/)
  if (m) {
    const month = parseInt(m[1], 10)
    const day = parseInt(m[2], 10)
    const year = parseInt(m[3], 10)
    const hour = parseInt(m[4], 10)
    const minute = parseInt(m[5], 10)
    const d = new Date(year, month - 1, day, hour, minute)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  const fallback = new Date(s)
  return isNaN(fallback.getTime()) ? undefined : fallback.toISOString()
}

function normalizeStatus(raw: unknown): PersonStatus {
  const s = String(raw || '').trim().toLowerCase()
  const allowed: PersonStatus[] = ['new', 'in-progress', 'approved', 'current', 'rejected', 'rejected_new', 'rejected_in-progress', 'rejected_approved']
  if (allowed.includes(s as PersonStatus)) return s as PersonStatus
  return 'new'
}

function normalizeSignedDocument(raw: unknown): 'Yes' | 'No' {
  const value = String(raw || '').trim().toLowerCase()
  return value === 'yes' ? 'Yes' : 'No'
}

async function loadOverrides(): Promise<Record<string, ApplicantOverride>> {
  const admin = resolveFirebaseAdminApp()
  if (!admin.ok) return {}
  try {
    const db = getFirestore(admin.app)
    const snap = await db.collection('applicantOverrides').get()
    const map: Record<string, ApplicantOverride> = {}
    snap.forEach(d => { map[d.id] = d.data() as ApplicantOverride })
    return map
  } catch {
    return {}
  }
}

async function loadPeople(overrides: Record<string, ApplicantOverride> = {}): Promise<PeopleGetResponse> {
  const url = buildAppsScriptUrl({
    limit: '5000'
  })

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  })

  const data = (await response.json()) as {
    success?: boolean
    rows?: Record<string, unknown>[]
    error?: string
  }

  if (!response.ok || !data?.success || !Array.isArray(data.rows)) {
    throw new Error(data?.error || `Failed to fetch people (${response.status})`)
  }

  const people: Person[] = data.rows.map(row => {
    const specialRaw = String(
      row['Are you willing to foster dogs with special needs If so please check all that apply below'] || ''
    )
    const specialNeeds = specialRaw
      ? Array.from(
        new Set(
          specialRaw
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        )
      )
      : []

    const emailKey = overrideKey(String(row['Email'] || '').trim())
    const override = overrides[emailKey] ?? {}

    const rawFlags = String(row['Flags'] || '').trim()
    let status: PersonStatus

    if (override.status !== undefined) {
      status = override.status
    } else {
      status = normalizeStatus(row['Applicant Status'])
      if (status === 'new' && !rawFlags) {
        status = 'in-progress'
      }
    }

    const fullName = String(row['Name'] || '').trim()
    const lastSpace = fullName.lastIndexOf(' ')
    const firstName = lastSpace > 0 ? fullName.slice(0, lastSpace) : fullName || undefined
    const lastName = lastSpace > 0 ? fullName.slice(lastSpace + 1) : undefined

    return {
      rowIndex: Number.isFinite(Number(row.rowIndex)) ? Number(row.rowIndex) : undefined,
      firstName,
      lastName,
      email: String(row['Email'] || '').trim() || undefined,
      phone: String(row['Phone'] || '').trim() || undefined,
      address: String(row['Address'] || '').trim() || undefined,
      age: String(row['How old are you'] || '').trim() || undefined,
      occupation: String(row['What do you do for a living'] || '').trim() || undefined,
      livingArrangement: String(row['What is your living arrangement'] || '').trim() || undefined,
      currentPets: String(row['Do you currently have any pets at home'] || '').trim() || undefined,
      currentPetDetails: String(row['Please list ALL pets that you CURRENTLY own Include type dogcat breed age gender length of time in your care etc'] || '').trim() || undefined,
      dogDaytime: String(row['Where will your foster dog be when you are not home'] || '').trim() || undefined,
      dogNight: String(row['Where will your foster dog sleep during the night'] || '').trim() || undefined,
      referralSource: String(row['How did you hear about us'] || '').trim() || undefined,
      source: String(row['Source'] || '').trim() || undefined,
      status,
      appliedAt: parseTimestampToIso(row['Submitted On']),
      availability: String(row['When would you like to take your foster dog home'] || '').trim() || undefined,
      specialNeeds,
      starred: override.starred ?? (String(row['Starred'] || '').trim().toUpperCase() === 'TRUE'),
      notes: override.notes ?? (String(row['Notes'] || '').trim() || undefined),
      notesUpdatedAt: override.notesUpdatedAt ?? parseTimestampToIso(row['Notes Updated At']),
      signedDocument: override.signedDocument ?? normalizeSignedDocument(row['Signed Document'] ?? row['Signed document']),
      raw: Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)])
      ) as Record<string, string>
    } satisfies Person
  })

  return { success: true, people, updatedAt: new Date().toISOString() }
}

/** Uncached fetch for use in sync routes. */
export async function loadPeopleUncached(): Promise<Person[]> {
  const overrides = await loadOverrides()
  const result = await loadPeople(overrides)
  return result.people
}

export function clearPeopleApiCache() {
  peopleCache = null
}

export async function GET(request: Request) {
  const auth = await requireAllowedUser(request)
  if (!auth.ok) return auth.response

  const now = Date.now()

  // Module-level cache (hot path — same server instance)
  if (peopleCache && peopleCache.expiresAt > now) {
    return Response.json(peopleCache.data, { headers: peopleCacheHeaders() })
  }

  // Firestore cache (cold start / cross-instance)
  const fsCached = await readFirestoreCacheChunked<Person>(PEOPLE_FS_DOC_ID)
  if (fsCached) {
    if (!isCacheFresh(fsCached.updatedAt, PEOPLE_FS_TTL_MS)) {
      triggerBackgroundSync(PEOPLE_FS_DOC_ID, async () => {
        const overrides = await loadOverrides()
        const result = await loadPeople(overrides)
        await writeFirestoreCacheChunked(PEOPLE_FS_DOC_ID, result.people, PEOPLE_FS_CHUNK_SIZE)
      })
    }
    const response: PeopleGetResponse = {
      success: true,
      people: fsCached.data,
      updatedAt: fsCached.updatedAt.toISOString(),
    }
    peopleCache = { data: response, expiresAt: now + PEOPLE_CACHE_TTL_MS }
    return Response.json(response, { headers: peopleCacheHeaders() })
  }

  // Cold start — no Firestore doc yet; fetch directly and prime the cache
  try {
    if (!peopleInFlight) {
      peopleInFlight = loadOverrides()
        .then(overrides => loadPeople(overrides))
        .then(data => {
          peopleCache = { data, expiresAt: Date.now() + PEOPLE_CACHE_TTL_MS }
          writeFirestoreCacheChunked(PEOPLE_FS_DOC_ID, data.people, PEOPLE_FS_CHUNK_SIZE)
            .catch(e => console.error('[people] Firestore prime failed:', e))
          return data
        })
        .finally(() => {
          peopleInFlight = null
        })
    }

    const data = await peopleInFlight
    return Response.json(data, { headers: peopleCacheHeaders() })
  } catch (error) {
    console.error('People API error:', error)
    return Response.json(
      { success: false, error: 'Failed to load people from Sheets' },
      { status: 500 }
    )
  }
}
