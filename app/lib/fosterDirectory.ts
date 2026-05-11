export type FosterStatus = 'Good' | 'Overdue' | 'Unknown'

export type DogRecord = {
  id?: number
  name?: string
  movement?: {
    date?: string
    daysInFoster?: number
  }
  foster?: {
    name?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
}

export type FosterDog = {
  id: string
  name: string
  daysInFoster?: number
  lastUpdate?: string
  status: FosterStatus
}

export type FosterDirectoryItem = {
  id: string
  fosterName: string
  fosterEmail?: string
  dogs: FosterDog[]
  status: FosterStatus
  lastUpdate?: string
  fosterPhone?: string
}

function statusRank(status: FosterStatus): number {
  if (status === 'Unknown') return 3
  if (status === 'Overdue') return 2
  return 1
}

function normalizeText(value?: string) {
  return String(value || '').trim()
}

export function fosterDisplayName(foster?: DogRecord['foster']) {
  const first = normalizeText(foster?.firstName)
  const last = normalizeText(foster?.lastName)
  const full = `${first} ${last}`.trim()
  return full || normalizeText(foster?.name) || 'Unknown Foster'
}

function dogDisplayName(dog?: DogRecord) {
  return normalizeText(dog?.name) || 'Unknown Dog'
}

export function fosterSlug(name: string, email?: string) {
  const key =
    normalizeText(email).toLowerCase() ||
    normalizeText(name).toLowerCase()
  return encodeURIComponent(key.replace(/\s+/g, '-'))
}

const HIDDEN_DOG_PREFIXES = ['*fta', '*ufta', '*sts', '*ff', '*adopting']

export function shouldHideDog(name?: string): boolean {
  if (!name) return false
  const lower = name.trim().toLowerCase()

  if (lower.includes('(w/')) return true
  if (lower.startsWith('*poss ff')) return false

  return HIDDEN_DOG_PREFIXES.some(prefix =>
    lower.startsWith(prefix)
  )
}

/** Animal IDs with at least one Task Log row (any type/status). Used to avoid calling “Good” when we have no sheet data at all. */
export function animalIdsFromTaskLogRows(
  rows: readonly { animalId?: string }[]
): Set<string> {
  const s = new Set<string>()
  for (const r of rows) {
    const id = String(r.animalId ?? '').trim()
    if (id) s.add(id)
  }
  return s
}

/**
 * When Task Log integration is inactive (empty rows + empty rollup cache), callers omit `animalIdsWithAnyTaskRow`
 * so dogs default to Good and the UI stays calm. When callers pass `taskStatusByAnimalId`, animals missing from that
 * map are still treated as Good (see `buildFosterDirectory`); lane-level follow-ups use Task Log rows separately.
 */
export function strictTaskPresenceForRollup(
  taskRowCount: number,
  taskStatusByAnimalId?: Record<string, FosterStatus>
): boolean {
  if (taskRowCount > 0) return true
  return Object.keys(taskStatusByAnimalId ?? {}).length > 0
}

/** Fallback when Task Log rollup is not in use — same thresholds as household “days in foster” health. */
function statusFromDaysInFoster(days?: number): FosterStatus {
  if (days === undefined || Number.isNaN(Number(days))) return 'Good'
  const d = Number(days)
  if (d > 30) return 'Overdue'
  if (d >= 14) return 'Unknown'
  return 'Good'
}

export function buildFosterDirectory(
  dogs: DogRecord[],
  taskStatusByAnimalId?: Record<string, FosterStatus>,
  animalIdsWithAnyTaskRow?: Set<string>
): FosterDirectoryItem[] {
  const grouped = new Map<string, FosterDirectoryItem>()

  for (let i = 0; i < dogs.length; i += 1) {
    const dog = dogs[i]

    // filter hidden dogs
    if (shouldHideDog(dog.name)) continue

    const fosterName = fosterDisplayName(dog.foster)
    const fosterEmail = normalizeText(dog.foster?.email) || undefined
    const id = fosterSlug(fosterName, fosterEmail)

    const asmAnimalId =
      dog.id !== undefined && dog.id !== null ? String(dog.id).trim() : ''

    // When task data is loaded, a dog with no active task entry means tasks
    // haven't started yet (or all are completed) - treat as Good rather than
    // flagging based on days in foster alone.
    let dogStatus: FosterStatus
    if (taskStatusByAnimalId != null) {
      if (!asmAnimalId) {
        dogStatus = animalIdsWithAnyTaskRow === undefined ? 'Good' : 'Unknown'
      } else {
        dogStatus = taskStatusByAnimalId[asmAnimalId] ?? 'Good'
      }
    } else {
      dogStatus = statusFromDaysInFoster(dog.movement?.daysInFoster)
    }

    const dogLastUpdate = dog.movement?.date

    const dogRow: FosterDog = {
      id: String(dog.id ?? `${id}-${i}`),
      name: dogDisplayName(dog),
      daysInFoster: dog.movement?.daysInFoster,
      lastUpdate: dogLastUpdate,
      status: dogStatus,
    }

    const existing = grouped.get(id)

    if (!existing) {
      grouped.set(id, {
        id,
        fosterName,
        fosterEmail,
        fosterPhone: normalizeText(dog.foster?.phone) || undefined,
        dogs: [dogRow],
        status: dogStatus,
        lastUpdate: dogLastUpdate,
      })
      continue
    }

    existing.dogs.push(dogRow)

    if (statusRank(dogStatus) > statusRank(existing.status)) {
      existing.status = dogStatus
    }

    if (
      !existing.lastUpdate ||
      (dogLastUpdate && dogLastUpdate > existing.lastUpdate)
    ) {
      existing.lastUpdate = dogLastUpdate
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.fosterName.localeCompare(b.fosterName)
  )
}

export function formatDateShort(value?: string) {
  if (!value) return 'Unknown'
  // Match YYYY-MM-DD optionally followed by a time component. Parse the date
  // parts directly to avoid UTC-shift bugs (e.g. "2026-05-05" rendering as 5/4
  // in negative-offset timezones because Date treats it as UTC midnight).
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    const day = Number(m[3])
    return `${month}/${day}/${year.toString().slice(-2)}`
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return `${d.getMonth() + 1}/${d.getDate()}/${d
    .getFullYear()
    .toString()
    .slice(-2)}`
}

