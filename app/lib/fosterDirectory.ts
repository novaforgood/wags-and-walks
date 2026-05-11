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

/** When Sheet 2 has no active row for this animal, treat as Good — do not infer from ASM dates/photos. */
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

export function buildFosterDirectory(
  dogs: DogRecord[],
  taskStatusByAnimalId?: Record<string, FosterStatus>
): FosterDirectoryItem[] {
  const grouped = new Map<string, FosterDirectoryItem>()

  for (let i = 0; i < dogs.length; i += 1) {
    const dog = dogs[i]

    // filter hidden dogs
    if (shouldHideDog(dog.name)) continue

    const fosterName = fosterDisplayName(dog.foster)
    const fosterEmail = normalizeText(dog.foster?.email) || undefined
    const id = fosterSlug(fosterName, fosterEmail)

    const dogStatus =
      taskStatusByAnimalId?.[String(dog.id)] ?? 'Good'

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

