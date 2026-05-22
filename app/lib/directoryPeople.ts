import type { FosterDog, FostererHistory } from '@/app/lib/asmFosterHistory'
import type { Person } from '@/app/lib/peopleTypes'

export function normalizeEmail(email: string | undefined | null): string {
  return String(email || '').toLowerCase().trim()
}

export type GroupMember = {
  email: string
  name?: string
}

export type DirectoryProfile = {
  email: string
  name: string
  source: 'google_group'
  hasApplication: boolean
  hasASMProfile: boolean
  application: Person | null
  asmProfile: FostererHistory | null
  groupMemberName?: string
}

function dedupeDogs(dogs: FosterDog[]): FosterDog[] {
  const seen = new Set<string>()
  const out: FosterDog[] = []
  for (const d of dogs) {
    const id = String(d.animalId || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(d)
  }
  return out
}

function mergeFostererHistories(a: FostererHistory, b: FostererHistory): FostererHistory {
  return {
    fostererId: a.fostererId || b.fostererId,
    fostererName: a.fostererName || b.fostererName,
    email: a.email || b.email,
    mobilePhone: a.mobilePhone || b.mobilePhone,
    homePhone: a.homePhone || b.homePhone,
    address: a.address || b.address,
    town: a.town || b.town,
    county: a.county || b.county,
    postcode: a.postcode || b.postcode,
    currentFosters: dedupeDogs([...a.currentFosters, ...b.currentFosters]),
    pastFosters: dedupeDogs([...a.pastFosters, ...b.pastFosters]),
  }
}

/** Map normalized email → merged ASM fosterer history (same email may appear under multiple fosterer IDs). */
export function buildAsmPeopleByEmail(fosterers: FostererHistory[]): Map<string, FostererHistory> {
  const map = new Map<string, FostererHistory>()
  for (const f of fosterers) {
    const key = normalizeEmail(f.email)
    if (!key) continue
    const existing = map.get(key)
    map.set(key, existing ? mergeFostererHistories(existing, f) : { ...f })
  }
  return map
}

export function buildApplicationsByEmail(people: Person[]): Map<string, Person> {
  const map = new Map<string, Person>()
  for (const p of people) {
    const key = normalizeEmail(p.email)
    if (!key) continue
    if (!map.has(key)) map.set(key, p)
  }
  return map
}

// ASM occasionally returns names in "LAST, FIRST" format. Normalize to "First Last".
export function splitFostererName(fullName: string): { firstName: string; lastName: string } {
  const raw = (fullName || '').trim()
  if (!raw) return { firstName: '', lastName: '' }

  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map(s => s.trim())
    return { firstName: first || '', lastName: last || '' }
  }

  const parts = raw.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export function formatFostererDisplayName(fullName: string): string {
  const { firstName, lastName } = splitFostererName(fullName)
  return `${firstName} ${lastName}`.trim() || (fullName || '').trim() || ''
}

function sheetDisplayName(person: Person): string {
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim()
}

function groupDisplayName(member: GroupMember): string {
  return (member.name || '').trim()
}

function resolveDisplayName(
  application: Person | null,
  asm: FostererHistory | null,
  member: GroupMember,
  email: string
): string {
  const sheet = application ? sheetDisplayName(application) : ''
  if (sheet) return sheet
  const asmName = asm ? formatFostererDisplayName(asm.fostererName) : ''
  if (asmName) return asmName
  const g = groupDisplayName(member)
  if (g) return g
  return email || 'Unknown'
}

export function buildDirectoryProfiles(
  groupMembers: GroupMember[],
  applicationsByEmail: Map<string, Person>,
  asmByEmail: Map<string, FostererHistory>
): DirectoryProfile[] {
  const seen = new Set<string>()
  const out: DirectoryProfile[] = []

  for (const member of groupMembers) {
    const email = String(member.email || '').trim()
    const key = normalizeEmail(email)
    if (!key || seen.has(key)) continue
    seen.add(key)

    const application = applicationsByEmail.get(key) ?? null
    const asmProfile = asmByEmail.get(key) ?? null

    out.push({
      email,
      name: resolveDisplayName(application, asmProfile, member, email),
      source: 'google_group',
      hasApplication: !!application,
      hasASMProfile: !!asmProfile,
      application,
      asmProfile,
      groupMemberName: member.name?.trim() || undefined,
    })
  }

  return out
}

export function buildPersonForModal(profile: DirectoryProfile): Person {
  const { application, asmProfile, email, groupMemberName } = profile

  if (application) {
    const merged: Person = {
      ...application,
      email: email || application.email,
    }
    const sheetName = sheetDisplayName(merged)
    if (!sheetName && asmProfile) {
      const { firstName, lastName } = splitFostererName(asmProfile.fostererName || '')
      merged.firstName = firstName || merged.firstName
      merged.lastName = lastName || merged.lastName
    } else if (!sheetName && groupMemberName) {
      const parts = groupMemberName.trim().split(/\s+/)
      merged.firstName = parts[0] || merged.firstName
      merged.lastName = parts.slice(1).join(' ') || merged.lastName
    }
    const sheetPhone = (merged.phone || '').trim()
    if (!sheetPhone && asmProfile) {
      merged.phone = asmProfile.mobilePhone || asmProfile.homePhone || merged.phone
    }
    return merged
  }

  if (asmProfile) {
    const { firstName, lastName } = splitFostererName(asmProfile.fostererName || '')
    const address = [asmProfile.address, asmProfile.town, asmProfile.county, asmProfile.postcode]
      .filter(Boolean)
      .join(', ')
    return {
      firstName,
      lastName,
      email,
      phone: asmProfile.mobilePhone || asmProfile.homePhone,
      address: address || undefined,
      status: asmProfile.currentFosters.length > 0 ? 'current' : 'approved',
      source: 'ASM',
      raw: {},
    }
  }

  const g = (groupMemberName || '').trim()
  const parts = g ? g.split(/\s+/) : []
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
    email,
    status: 'approved',
    source: 'google_group',
    raw: {},
  }
}

export function directoryDogNames(profile: DirectoryProfile): string {
  const asm = profile.asmProfile
  if (!asm) return ''
  const names = [...asm.currentFosters, ...asm.pastFosters]
    .map(d => (d.name || '').trim())
    .filter(Boolean)
  return names.join(' ').toLowerCase()
}

export function directoryPhone(profile: DirectoryProfile): string {
  const sheet = profile.application?.phone?.trim()
  if (sheet) return sheet
  const asm = profile.asmProfile
  return (asm?.mobilePhone || asm?.homePhone || '').trim()
}

export function directoryPersonNeedsReview(person: Person): boolean {
  const flags = String(person.raw?.['Flags'] || '').trim()
  const review = String(person.raw?.['Review Status'] || '').trim().toLowerCase()
  if (person.status === 'new' && flags) return true
  if (review && review !== 'none' && review !== 'n/a' && review !== 'clear' && review !== 'approved') {
    if (review.includes('needs') || review.includes('pending') || review.includes('flag')) return true
  }
  return false
}

/** True if the Sheet application row has any non-empty flag text. */
export function directoryPersonIsFlagged(person: Person): boolean {
  return !!String(person.raw?.['Flags'] || '').trim()
}

/** Strip leading `*` (and surrounding trim) so `*Jane` sorts like `Jane`. */
export function stripLeadingStarsForSort(displayName: string): string {
  let t = displayName.trim()
  while (t.startsWith('*')) {
    t = t.slice(1).trimStart()
  }
  return t
}

/**
 * Directory name order: A–Z on the meaningful part (after leading `*`).
 * Names whose first meaningful character is not a Unicode letter sort last;
 * within each bucket, order is case-insensitive A–Z.
 */
export function compareDirectoryDisplayNames(a: string, b: string): number {
  const sa = stripLeadingStarsForSort(a)
  const sb = stripLeadingStarsForSort(b)
  const letterBucket = (s: string) => (s.length > 0 && /^[\p{L}]/u.test(s) ? 0 : 1)
  const ba = letterBucket(sa)
  const bb = letterBucket(sb)
  if (ba !== bb) return ba - bb
  const cmp = sa.localeCompare(sb, undefined, { sensitivity: 'base' })
  if (cmp !== 0) return cmp
  return a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'base' })
}
