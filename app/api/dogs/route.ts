const ASM_BASE_URL = process.env.ASM_BASE_URL
const ASM_ACCOUNT = process.env.ASM_ACCOUNT
const ASM_USERNAME = process.env.ASM_USERNAME
const ASM_PASSWORD = process.env.ASM_PASSWORD
const ASM_SENSITIVE = process.env.ASM_SENSITIVE || '1'

type AsmAnimalRow = Record<string, unknown>

type DogRecord = {
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
  raw: Record<string, string>
}

function requireAsmEnv() {
  const missing = [
    ['ASM_BASE_URL', ASM_BASE_URL],
    ['ASM_ACCOUNT', ASM_ACCOUNT],
    ['ASM_USERNAME', ASM_USERNAME],
    ['ASM_PASSWORD', ASM_PASSWORD]
  ].filter(([, value]) => !value)

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.map(([k]) => k).join(', ')}`)
  }
}

function buildAsmUrl(searchParams: Record<string, string>) {
  requireAsmEnv()

  const url = new URL(String(ASM_BASE_URL))
  url.searchParams.set('account', String(ASM_ACCOUNT))
  url.searchParams.set('username', String(ASM_USERNAME))
  url.searchParams.set('password', String(ASM_PASSWORD))

  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value)
  }

  return url
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
    const month = Number(mdy[1]) - 1
    const day = Number(mdy[2])
    const year = Number(mdy[3])
    const date = new Date(year, month, day)
    if (!Number.isNaN(date.getTime())) return date
  }

  return undefined
}

function toIsoDate(value: unknown): string | undefined {
  const d = parseDate(value)
  return d ? d.toISOString() : undefined
}

function isFosterMovement(row: AsmAnimalRow): boolean {
  const movementTypeName = clean(row.ACTIVEMOVEMENTTYPENAME)?.toLowerCase() || ''
  const movementTypeCode = clean(row.ACTIVEMOVEMENTTYPE)?.toLowerCase() || ''

  return movementTypeName.includes('foster') || movementTypeCode.includes('foster')
}

function daysSince(value: unknown): number | undefined {
  const d = parseDate(value)
  if (!d) return undefined
  const ms = Date.now() - d.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (1000 * 60 * 60 * 24))
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
  const params = new URLSearchParams({ animalId: String(animalId) })
  const thumbnailUrl = `/api/dogs/photo?${new URLSearchParams({
    ...Object.fromEntries(params),
    variant: 'thumbnail'
  }).toString()}`
  const imageUrl = `/api/dogs/photo?${new URLSearchParams({
    ...Object.fromEntries(params),
    variant: 'image'
  }).toString()}`
  return { thumbnailUrl, imageUrl }
}

function mapDog(row: AsmAnimalRow): DogRecord {
  const idRaw = clean(row.ID)
  const id = idRaw && Number.isFinite(Number(idRaw)) ? Number(idRaw) : undefined
  const inFoster = isFosterMovement(row)
  const movementDate = inFoster ? toIsoDate(row.ACTIVEMOVEMENTDATE) : undefined

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
      date: movementDate,
      inFoster,
      daysInFoster: inFoster ? daysSince(row.ACTIVEMOVEMENTDATE) : undefined
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
      email: clean(row.CURRENTOWNEREMAILADDRESS)
    },
    raw: Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)])
    )
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function extractRows(payload: unknown): AsmAnimalRow[] {
  if (Array.isArray(payload)) {
    return payload.filter(isObject)
  }

  if (isObject(payload)) {
    for (const key of ['animals', 'rows', 'result', 'data']) {
      const candidate = payload[key]
      if (Array.isArray(candidate)) {
        return candidate.filter(isObject)
      }
    }
  }

  return []
}

export async function GET() {
  try {
    const url = buildAsmUrl({
      method: 'json_shelter_animals',
      sensitive: ASM_SENSITIVE
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store'
    })

    const text = await response.text()
    let payload: unknown

    try {
      payload = JSON.parse(text)
    } catch {
      return Response.json(
        { success: false, error: 'ASM response was not valid JSON', bodyPreview: text.slice(0, 500) },
        { status: 502 }
      )
    }

    if (!response.ok) {
      return Response.json(
        { success: false, error: `ASM request failed (${response.status})`, payload },
        { status: 502 }
      )
    }

    const rows = extractRows(payload)
    const dogs = rows.map(mapDog)

    return Response.json(
      {
        success: true,
        count: dogs.length,
        dogs
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )
  } catch (error) {
    console.error('Dogs API error:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load dogs from ASM'
      },
      { status: 500 }
    )
  }
}
