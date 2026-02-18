import type { Person, PersonStatus } from '@/app/lib/peopleTypes'

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL
const APPS_SCRIPT_KEY = process.env.APPS_SCRIPT_KEY

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
  const s = String(raw || '').trim()
  if (s === 'new' || s === 'in-progress' || s === 'approved' || s === 'current') return s
  return 'new'
}

export async function GET() {
  try {
    const fields = [
      'Timestamp',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'How old are you?',
      'When would you like to take your foster dog home?',
      'Are you willing to foster dogs with special needs? If so, please check all that apply below.',
      'Flags',
      'Review Status',
      'Applicant Status',
      'Status Updated At',
      'Status Updated By'
    ].join(',')

    const url = buildAppsScriptUrl({
      limit: '5000',
      fields
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
      return Response.json(
        { success: false, error: data?.error || `Failed to fetch people (${response.status})` },
        { status: 502 }
      )
    }

    const people: Person[] = data.rows.map(row => {
      const specialRaw = String(
        row[
        'Are you willing to foster dogs with special needs? If so, please check all that apply below.'
        ] || ''
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

      return {
        rowIndex: Number.isFinite(Number(row.rowIndex)) ? Number(row.rowIndex) : undefined,
        firstName: String(row['First Name'] || '').trim() || undefined,
        lastName: String(row['Last Name'] || '').trim() || undefined,
        email: String(row['Email'] || '').trim() || undefined,
        phone: String(row['Phone'] || '').trim() || undefined,
        age: String(row['How old are you?'] || '').trim() || undefined,
        status: normalizeStatus(row['Applicant Status']),
        appliedAt: parseTimestampToIso(row['Timestamp']),
        availability: String(row['When would you like to take your foster dog home?'] || '').trim() || undefined,
        specialNeeds,
        raw: Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)])
        ) as Record<string, string>
      } satisfies Person
    })

    return Response.json(
      { success: true, people },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )
  } catch (error) {
    console.error('People API error:', error)
    return Response.json(
      { success: false, error: 'Failed to load people from Sheets' },
      { status: 500 }
    )
  }
}
