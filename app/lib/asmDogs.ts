// Shared ASM dog-fetching logic with a 60-second in-memory cache.
// Both /api/dogs and /api/fosters use this so they never both hit ASM
// on the same request cycle.

const ASM_BASE_URL = process.env.ASM_BASE_URL
const ASM_ACCOUNT = process.env.ASM_ACCOUNT
const ASM_USERNAME = process.env.ASM_USERNAME
const ASM_PASSWORD = process.env.ASM_PASSWORD
const ASM_SENSITIVE = process.env.ASM_SENSITIVE || '1'

export type AsmAnimalRow = Record<string, unknown>

export type DogRecord = {
  id?: number
  name?: string
  sex?: string
  breed?: string
  breed1?: string
  breed2?: string
  photo?: {
    thumbnailUrl: string
    imageUrl: string
  }
  movement?: {
    type?: string
    typeCode?: string
    date?: string
    inFoster: boolean
    daysInFoster?: number
  }
  foster?: {
    name?: string
    firstName?: string
    lastName?: string
    address?: string
    town?: string
    county?: string
    postcode?: string
    country?: string
    phone?: string
    email?: string
  }
  raw?: Record<string, string>
}

// Module-level cache — survives across requests on the same server instance.
let _cache: { dogs: DogRecord[]; expiresAt: number } | null = null
// In-flight promise — deduplicates concurrent requests that all miss the cache.
let _inflight: Promise<DogRecord[]> | null = null

const CACHE_TTL_MS = 60_000

function sanitizeAsmJson(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')
    .replace(/,(\s*[}\]])/g, '$1')
}

function requireAsmEnv() {
  const missing = [
    ['ASM_BASE_URL', ASM_BASE_URL],
    ['ASM_ACCOUNT', ASM_ACCOUNT],
    ['ASM_USERNAME', ASM_USERNAME],
    ['ASM_PASSWORD', ASM_PASSWORD],
  ].filter(([, v]) => !v)
  if (missing.length) throw new Error(`Missing env vars: ${missing.map(([k]) => k).join(', ')}`)
}

function buildAsmUrl(): string {
  requireAsmEnv()
  const url = new URL(String(ASM_BASE_URL))
  url.searchParams.set('account', String(ASM_ACCOUNT))
  url.searchParams.set('username', String(ASM_USERNAME))
  url.searchParams.set('password', String(ASM_PASSWORD))
  url.searchParams.set('method', 'json_shelter_animals')
  url.searchParams.set('sensitive', ASM_SENSITIVE)
  return url.toString()
}

function clean(value: unknown): string | undefined {
  const s = String(value ?? '').trim()
  return s || undefined
}

function parseDate(value: unknown): Date | undefined {
  const s = clean(value)
  if (!s) return undefined
  const direct = new Date(s)
  if (!Number.isNaN(direct.getTime())) return direct
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdy) {
    const d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]))
    if (!Number.isNaN(d.getTime())) return d
  }
  return undefined
}

function toIsoDate(value: unknown): string | undefined {
  const d = parseDate(value)
  return d ? d.toISOString() : undefined
}

function isFosterMovement(row: AsmAnimalRow): boolean {
  const name = clean(row.ACTIVEMOVEMENTTYPENAME)?.toLowerCase() || ''
  const code = clean(row.ACTIVEMOVEMENTTYPE)?.toLowerCase() || ''
  return name.includes('foster') || code.includes('foster')
}

function daysSince(value: unknown): number | undefined {
  const d = parseDate(value)
  if (!d) return undefined
  const ms = Date.now() - d.getTime()
  return ms < 0 ? 0 : Math.floor(ms / 86_400_000)
}

function pickBestPhone(row: AsmAnimalRow): string | undefined {
  return (
    clean(row.CURRENTOWNERMOBILETELEPHONE) ||
    clean(row.CURRENTOWNERHOMETELEPHONE) ||
    clean(row.CURRENTOWNERWORKTELEPHONE)
  )
}

function buildPhotoUrls(animalId?: number) {
  if (!animalId) return undefined
  const base = new URLSearchParams({ animalId: String(animalId) })
  return {
    thumbnailUrl: `/api/dogs/photo?${new URLSearchParams({ ...Object.fromEntries(base), variant: 'thumbnail' })}`,
    imageUrl: `/api/dogs/photo?${new URLSearchParams({ ...Object.fromEntries(base), variant: 'image' })}`,
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function extractRows(payload: unknown): AsmAnimalRow[] {
  if (Array.isArray(payload)) return payload.filter(isObject)
  if (isObject(payload)) {
    for (const key of ['animals', 'rows', 'result', 'data']) {
      const c = payload[key]
      if (Array.isArray(c)) return c.filter(isObject)
    }
  }
  return []
}

function mapDog(row: AsmAnimalRow): DogRecord {
  const idRaw = clean(row.ID)
  const id = idRaw && Number.isFinite(Number(idRaw)) ? Number(idRaw) : undefined
  const inFoster = isFosterMovement(row)
  return {
    id,
    name: clean(row.ANIMALNAME),
    sex: clean(row.SEXNAME) || clean(row.SEX),
    breed: clean(row.BREEDNAME),
    breed1: clean(row.BREEDNAME1),
    breed2: clean(row.BREEDNAME2),
    photo: buildPhotoUrls(id),
    movement: {
      type: clean(row.ACTIVEMOVEMENTTYPENAME),
      typeCode: clean(row.ACTIVEMOVEMENTTYPE),
      date: inFoster ? toIsoDate(row.ACTIVEMOVEMENTDATE) : undefined,
      inFoster,
      daysInFoster: inFoster ? daysSince(row.ACTIVEMOVEMENTDATE) : undefined,
    },
    foster: {
      name: clean(row.CURRENTOWNERNAME),
      firstName: clean(row.CURRENTOWNERFORENAMES),
      lastName: clean(row.CURRENTOWNERSURNAME),
      address: clean(row.CURRENTOWNERADDRESS),
      town: clean(row.CURRENTOWNERTOWN),
      county: clean(row.CURRENTOWNERCOUNTY),
      postcode: clean(row.CURRENTOWNERPOSTCODE),
      country: clean(row.CURRENTOWNERCOUNTRY),
      phone: pickBestPhone(row),
      email: clean(row.CURRENTOWNEREMAILADDRESS),
    },
    raw: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)])),
  }
}

async function fetchFromAsm(): Promise<DogRecord[]> {
  const url = buildAsmUrl()
  const response = await fetch(url, { next: { revalidate: 300 } })
  const raw = await response.text()
  const text = sanitizeAsmJson(raw)
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`ASM response was not valid JSON: ${msg}`)
  }
  if (!response.ok) throw new Error(`ASM request failed (${response.status})`)
  const rows = extractRows(payload)
  return rows.map(mapDog).filter(d => d.movement?.inFoster)
}

/** Bypasses the module-level cache — use in sync routes that need guaranteed-fresh data. */
export async function fetchAsmFosterDogsUncached(): Promise<DogRecord[]> {
  return fetchFromAsm()
}

/**
 * Returns foster dogs from ASM. Results are cached for 60 seconds and
 * concurrent callers share a single in-flight request.
 */
export async function getAsmFosterDogs(): Promise<DogRecord[]> {
  const now = Date.now()
  if (_cache && _cache.expiresAt > now) return _cache.dogs

  if (_inflight) return _inflight

  _inflight = fetchFromAsm()
    .then(dogs => {
      _cache = { dogs, expiresAt: Date.now() + CACHE_TTL_MS }
      return dogs
    })
    .finally(() => {
      _inflight = null
    })

  return _inflight
}
