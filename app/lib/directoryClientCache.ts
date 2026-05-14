import type { FostererHistory } from '@/app/lib/asmFosterHistory'
import type { GroupMember } from '@/app/lib/directoryPeople'

export const GROUP_MEMBERS_CACHE_KEY = 'directory_group_members_v1'
export const FOSTER_HISTORY_CACHE_KEY = 'directory_foster_history_v1'

let prewarmInFlight: Promise<void> | null = null

export function readCachedArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function writeCachedArray<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Best-effort cache only.
  }
}

async function prewarmGroupMembers() {
  if (readCachedArray<GroupMember>(GROUP_MEMBERS_CACHE_KEY).length > 0) return
  const res = await fetch('/api/google-group-members', { cache: 'no-store' })
  const data = (await res.json()) as { success?: boolean; members?: GroupMember[] }
  if (res.ok && data?.success && Array.isArray(data.members)) {
    writeCachedArray(GROUP_MEMBERS_CACHE_KEY, data.members)
  }
}

async function prewarmFosterHistory() {
  if (readCachedArray<FostererHistory>(FOSTER_HISTORY_CACHE_KEY).length > 0) return
  const res = await fetch('/api/foster-history', { cache: 'no-store' })
  const data = (await res.json()) as { success?: boolean; fosterers?: FostererHistory[] }
  if (res.ok && data?.success && Array.isArray(data.fosterers)) {
    writeCachedArray(FOSTER_HISTORY_CACHE_KEY, data.fosterers)
  }
}

export function prewarmDirectoryData(): Promise<void> {
  if (!prewarmInFlight) {
    prewarmInFlight = Promise.allSettled([
      prewarmGroupMembers(),
      prewarmFosterHistory(),
    ])
      .then(() => undefined)
      .finally(() => {
        prewarmInFlight = null
      })
  }

  return prewarmInFlight
}
