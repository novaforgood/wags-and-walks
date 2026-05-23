export type AsmFosterRow = {
  FOSTERERNAME: string
  FOSTERERID: string | number
  ANIMALID: string | number
  OWNERADDRESS?: string
  OWNERTOWN?: string
  OWNERCOUNTY?: string
  OWNERPOSTCODE?: string
  HOMETELEPHONE?: string
  MOBILETELEPHONE?: string
  EMAILADDRESS?: string
  SHELTERCODE?: string
  ANIMALNAME?: string
  SEX?: string
  COLOUR?: string
  BREEDNAME?: string
  DATEOFBIRTH?: string
  ANIMALAGE?: string
  FOSTERSTARTDATE?: string
  FOSTERENDDATE?: string | null
  FOSTERSTATUS: string
}

export type FosterDog = {
  animalId: string
  shelterCode?: string
  name?: string
  breed?: string
  sex?: string
  colour?: string
  animalAge?: string
  fosterStartDate?: string
  fosterEndDate?: string | null
}

export type FostererHistory = {
  fostererId: string
  fostererName: string
  email?: string
  mobilePhone?: string
  homePhone?: string
  address?: string
  town?: string
  county?: string
  postcode?: string
  currentFosters: FosterDog[]
  pastFosters: FosterDog[]
}

const rawTtl = Number(process.env.ASM_FOSTER_HISTORY_CACHE_TTL_SEC)
const CACHE_TTL_MS =
  Math.max(30, Math.min(900, Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : 120)) * 1000

let historyCache: { rows: AsmFosterRow[]; expiresAt: number } | null = null
let historyInFlight: Promise<AsmFosterRow[]> | null = null

function rowToDog(row: AsmFosterRow): FosterDog {
  return {
    animalId: String(row.ANIMALID),
    shelterCode: row.SHELTERCODE || undefined,
    name: row.ANIMALNAME || undefined,
    breed: row.BREEDNAME || undefined,
    sex: row.SEX || undefined,
    colour: row.COLOUR || undefined,
    animalAge: row.ANIMALAGE || undefined,
    fosterStartDate: row.FOSTERSTARTDATE || undefined,
    fosterEndDate: row.FOSTERENDDATE || null,
  }
}

function isCurrent(row: AsmFosterRow): boolean {
  const status = String(row.FOSTERSTATUS ?? '').toLowerCase()
  if (status === 'current') return true
  if (status === 'past') return false
  return !row.FOSTERENDDATE
}

export function groupFosterHistory(rows: AsmFosterRow[]): FostererHistory[] {
  const map = new Map<string, FostererHistory>()

  for (const row of rows) {
    const key = String(row.FOSTERERID)
    if (!map.has(key)) {
      map.set(key, {
        fostererId: key,
        fostererName: row.FOSTERERNAME,
        email: row.EMAILADDRESS || undefined,
        mobilePhone: row.MOBILETELEPHONE || undefined,
        homePhone: row.HOMETELEPHONE || undefined,
        address: row.OWNERADDRESS || undefined,
        town: row.OWNERTOWN || undefined,
        county: row.OWNERCOUNTY || undefined,
        postcode: row.OWNERPOSTCODE || undefined,
        currentFosters: [],
        pastFosters: [],
      })
    }

    const fosterer = map.get(key)!
    if (isCurrent(row)) {
      fosterer.currentFosters.push(rowToDog(row))
    } else {
      fosterer.pastFosters.push(rowToDog(row))
    }
  }

  return Array.from(map.values())
}

async function fetchAsmFosterHistoryFromAsm(): Promise<AsmFosterRow[]> {
  const account = process.env.ASM_ACCOUNT
  const key = process.env.ASM_API_KEY
  const title = process.env.ASM_REPORT_TITLE ?? 'Foster History API'
  const baseUrl = process.env.ASM_BASE_URL ?? 'https://service.sheltermanager.com/asmservice'

  if (!account) throw new Error('Missing ASM_ACCOUNT')
  if (!key) throw new Error('Missing ASM_API_KEY')

  const params = new URLSearchParams({ account, method: 'json_report', title, key })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(`${baseUrl}?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      throw new Error(`ASM report request failed: ${res.status} ${res.statusText}`)
    }

    const raw = await res.text()
    const text = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ').replace(/,(\s*[}\]])/g, '$1')
    const data: unknown = JSON.parse(text)

    if (!Array.isArray(data)) {
      throw new Error('ASM response was not an array')
    }

    console.log(`[foster-history] fetched ${data.length} rows`)
    return data as AsmFosterRow[]
  } finally {
    clearTimeout(timeout)
  }
}

/** Bypasses the module-level cache — use in sync routes that need guaranteed-fresh data. */
export async function fetchAsmFosterHistoryUncached(): Promise<AsmFosterRow[]> {
  return fetchAsmFosterHistoryFromAsm()
}

export async function fetchAsmFosterHistory(): Promise<AsmFosterRow[]> {
  const now = Date.now()
  if (historyCache && historyCache.expiresAt > now) return historyCache.rows
  if (historyInFlight) return historyInFlight

  historyInFlight = fetchAsmFosterHistoryFromAsm()
    .then(rows => {
      historyCache = { rows, expiresAt: Date.now() + CACHE_TTL_MS }
      return rows
    })
    .finally(() => {
      historyInFlight = null
    })

  return historyInFlight
}
