import type { Person } from '@/app/lib/peopleTypes'

export type ActionStatus = 'needed' | 'done' | 'overdue'

export type FosterActionDef = {
  id: string
  title: string
  status: ActionStatus
  detail?: string
}

export type DogNode = {
  id: string
  name: string
  actions: FosterActionDef[]
}

export type FosterOverviewRow = {
  id: string
  fosterDisplayName: string
  email?: string
  person: Person
  dogs: DogNode[]
}

const DOG_NAME_KEYS = [
  'Foster dog name',
  'Current foster dog',
  'Dog name',
  'Animal name',
  'Name of foster dog',
  'Foster animal name',
]

function normalizeCell(v: string | undefined): string {
  return String(v ?? '').trim()
}

/** Match sheet value as done / not done / unknown */
function cellStatus(raw: Record<string, string>, keyCandidates: string[]): ActionStatus {
  for (const key of Object.keys(raw)) {
    const match = keyCandidates.some(
      k => k.toLowerCase() === key.toLowerCase() || key.toLowerCase().includes(k.toLowerCase())
    )
    if (!match) continue
    const v = normalizeCell(raw[key]).toLowerCase()
    if (!v) continue
    if (['yes', 'done', 'complete', 'completed', 'true', 'submitted', 'received'].includes(v)) {
      return 'done'
    }
    if (['no', 'pending', 'incomplete', 'needed', 'missing'].includes(v)) {
      return 'needed'
    }
    if (['overdue', 'late'].includes(v)) {
      return 'overdue'
    }
  }
  return 'needed'
}

function findFirstValue(raw: Record<string, string>, exactKeys: string[]): string | undefined {
  for (const k of exactKeys) {
    const v = normalizeCell(raw[k])
    if (v) return v
  }
  for (const [key, val] of Object.entries(raw)) {
    const lower = key.toLowerCase()
    if ((lower.includes('dog') || lower.includes('animal') || lower.includes('foster')) && lower.includes('name')) {
      const v = normalizeCell(val)
      if (v && v.length < 120) return v
    }
  }
  return undefined
}

export function extractDogNames(raw: Record<string, string>): string[] {
  for (const k of DOG_NAME_KEYS) {
    const v = normalizeCell(raw[k])
    if (v) {
      return v
        .split(/[,;]| and /i)
        .map(s => s.trim())
        .filter(Boolean)
    }
  }
  const fuzzy = findFirstValue(raw, [])
  if (fuzzy) {
    if (fuzzy.includes(',')) {
      return fuzzy.split(',').map(s => s.trim()).filter(Boolean)
    }
    return [fuzzy]
  }
  return ['Foster dog']
}

function actionsForDog(
  raw: Record<string, string>,
  idPrefix: string
): FosterActionDef[] {
  const templates: { id: string; title: string; keys: string[] }[] = [
    {
      id: `${idPrefix}-photos`,
      title: 'Upload foster photos',
      keys: ['Photos uploaded', 'Foster photos', 'Photo upload'],
    },
    {
      id: `${idPrefix}-vet`,
      title: 'Submit vet records',
      keys: ['Vet records', 'Vet records submitted', 'Medical records'],
    },
    {
      id: `${idPrefix}-weekly`,
      title: 'Weekly check-in',
      keys: ['Weekly check-in', 'Check-in complete'],
    },
    {
      id: `${idPrefix}-orientation`,
      title: 'Orientation / paperwork',
      keys: ['Orientation complete', 'Paperwork complete'],
    },
  ]

  return templates.map(t => {
    let status = cellStatus(raw, t.keys)
    const specific = t.keys.map(k => raw[k]).find(v => normalizeCell(v))
    const detail =
      specific && !['yes', 'no', 'done', 'pending'].includes(normalizeCell(specific).toLowerCase())
        ? normalizeCell(specific)
        : undefined

    if (status === 'needed' && t.id.endsWith('-photos')) {
      const loose = Object.keys(raw).some(
        k => k.toLowerCase().includes('photo') && normalizeCell(raw[k]).toLowerCase() === 'overdue'
      )
      if (loose) status = 'overdue'
    }

    return {
      id: t.id,
      title: t.title,
      status,
      detail,
    }
  })
}

export function buildFosterOverview(people: Person[]): FosterOverviewRow[] {
  const current = people
    .filter(p => !!normalizeCell(p.email) && p.status === 'current')
    .sort((a, b) => {
      const ta = a.appliedAt ? new Date(a.appliedAt).getTime() : (a.rowIndex ?? 0)
      const tb = b.appliedAt ? new Date(b.appliedAt).getTime() : (b.rowIndex ?? 0)
      return tb - ta
    })

  return current.map((person, idx) => {
    const raw = person.raw || {}
    const fosterDisplayName =
      `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() ||
      person.email ||
      `Foster ${idx + 1}`

    const names = extractDogNames(raw)
    const dogs: DogNode[] = names.map((name, i) => {
      const idPrefix = `${person.email || 'row'}-${idx}-dog-${i}`
      return {
        id: `${person.email || idx}-dog-${i}`,
        name,
        actions: actionsForDog(raw, idPrefix),
      }
    })

    return {
      id: person.email || `foster-${idx}`,
      fosterDisplayName,
      email: person.email,
      person,
      dogs,
    }
  })
}

export function openCountForFoster(row: FosterOverviewRow): number {
  let n = 0
  for (const dog of row.dogs) {
    for (const a of dog.actions) {
      if (a.status === 'needed' || a.status === 'overdue') n += 1
    }
  }
  return n
}

export function countOpenActions(rows: FosterOverviewRow[]): number {
  return rows.reduce((acc, row) => acc + openCountForFoster(row), 0)
}
