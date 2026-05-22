/** `YYYY-MM` month bucket in a given IANA timezone. */
export function monthKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  if (!year || !month) return ''
  return `${year}-${month}`
}

export function monthLabelFromKey(key: string): string {
  const m = key.match(/^(\d{4})-(\d{2})$/)
  if (!m) return key
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1)
  if (Number.isNaN(d.getTime())) return key
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function previousMonthKey(key: string): string {
  const m = key.match(/^(\d{4})-(\d{2})$/)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1)
  d.setMonth(d.getMonth() - 1)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${mo}`
}

export type GroupOnboardingMonthStat = {
  key: string
  label: string
  count: number
}

export const GROUP_ONBOARDING_LOCAL_KEY = 'group_onboarding_first_seen_v1'
const LEGACY_ISO = '1970-01-01T00:00:00.000Z'

export function readLocalGroupFirstSeen(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(GROUP_ONBOARDING_LOCAL_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function writeLocalGroupFirstSeen(map: Record<string, string>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GROUP_ONBOARDING_LOCAL_KEY, JSON.stringify(map))
  } catch {
    // best-effort
  }
}

/** Browser-only ledger when server tracking is unavailable (this device only). */
export function syncLocalGroupOnboarding(emails: string[]): Record<string, string> {
  const map = { ...readLocalGroupFirstSeen() }
  const seededKey = `${GROUP_ONBOARDING_LOCAL_KEY}_seeded`
  let seeded = false
  try {
    seeded = localStorage.getItem(seededKey) === '1'
  } catch {
    seeded = false
  }

  if (!seeded && emails.length > 0) {
    for (const email of emails) {
      const e = email.trim().toLowerCase()
      if (!e) continue
      if (!map[e]) map[e] = LEGACY_ISO
    }
    try {
      localStorage.setItem(seededKey, '1')
    } catch {
      // ignore
    }
  }

  const now = new Date().toISOString()
  for (const email of emails) {
    const e = email.trim().toLowerCase()
    if (!e) continue
    if (!map[e]) map[e] = now
  }
  writeLocalGroupFirstSeen(map)
  return map
}

export type GroupOnboardingStats = {
  timeZone: string
  currentMonth: GroupOnboardingMonthStat
  previousMonth: GroupOnboardingMonthStat
  /** When `?month=YYYY-MM` is requested */
  selectedMonth?: GroupOnboardingMonthStat
  countsByMonth: Record<string, number>
  memberCount: number
}

/** Count emails whose first-seen ISO timestamp falls in `monthKey` (local calendar month in `timeZone`). */
export function countOnboardedInMonth(
  firstSeenByEmail: Record<string, string>,
  monthKey: string,
  timeZone: string
): number {
  let n = 0
  for (const iso of Object.values(firstSeenByEmail)) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) continue
    if (monthKeyInTimeZone(d, timeZone) === monthKey) n += 1
  }
  return n
}

/** Seeded / legacy first-seen timestamps are not counted toward any month. */
export function isTrackableFirstSeenIso(iso: string): boolean {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getFullYear() >= 2000
}

export function buildGroupOnboardingStats(
  firstSeenByEmail: Record<string, string>,
  timeZone: string,
  now: Date = new Date(),
  requestedMonthKey?: string
): GroupOnboardingStats {
  const countsByMonth: Record<string, number> = {}
  for (const iso of Object.values(firstSeenByEmail)) {
    if (!isTrackableFirstSeenIso(iso)) continue
    const d = new Date(iso)
    const key = monthKeyInTimeZone(d, timeZone)
    if (!key) continue
    countsByMonth[key] = (countsByMonth[key] || 0) + 1
  }

  const currentKey = monthKeyInTimeZone(now, timeZone)
  const prevKey = previousMonthKey(currentKey)

  const currentMonth: GroupOnboardingMonthStat = {
    key: currentKey,
    label: monthLabelFromKey(currentKey),
    count: countsByMonth[currentKey] || 0,
  }
  const previousMonth: GroupOnboardingMonthStat = {
    key: prevKey,
    label: monthLabelFromKey(prevKey),
    count: countsByMonth[prevKey] || 0,
  }

  let selectedMonth: GroupOnboardingMonthStat | undefined
  if (requestedMonthKey && /^\d{4}-\d{2}$/.test(requestedMonthKey)) {
    selectedMonth = {
      key: requestedMonthKey,
      label: monthLabelFromKey(requestedMonthKey),
      count: countsByMonth[requestedMonthKey] || 0,
    }
  }

  return {
    timeZone,
    currentMonth,
    previousMonth,
    selectedMonth,
    countsByMonth,
    memberCount: Object.keys(firstSeenByEmail).length,
  }
}
