import type { GroupMember } from '@/app/lib/directoryPeople'
import { authFetch } from '@/app/lib/authFetch'

export const GROUP_MEMBERS_CACHE_KEY = 'directory_group_members_v1'
export const FOSTER_HISTORY_CACHE_KEY = 'directory_foster_history_v1'

let prewarmInFlight: Promise<void> | null = null
const memoryCache = new Map<string, unknown[]>()

function shouldPersistToLocalStorage(key: string): boolean {
  return key === GROUP_MEMBERS_CACHE_KEY
}

function removeLegacyLocalStorageEntry(key: string) {
  if (typeof window === 'undefined') return
  window.setTimeout(() => {
    try {
      localStorage.removeItem(key)
    } catch {
      // Best-effort cleanup only.
    }
  }, 0)
}

export function readCachedArray<T>(key: string): T[] {
  const cached = memoryCache.get(key)
  if (cached) return cached as T[]
  if (!shouldPersistToLocalStorage(key)) {
    removeLegacyLocalStorageEntry(key)
    return []
  }

  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    memoryCache.set(key, parsed)
    return parsed as T[]
  } catch {
    return []
  }
}

export function writeCachedArray<T>(key: string, value: T[]) {
  memoryCache.set(key, value)
  if (!shouldPersistToLocalStorage(key)) return

  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Best-effort cache only.
  }
}

async function prewarmGroupMembers() {
  if (readCachedArray<GroupMember>(GROUP_MEMBERS_CACHE_KEY).length > 0) return
  const res = await authFetch('/api/google-group-members', { cache: 'no-store' })
  const data = (await res.json()) as { success?: boolean; members?: GroupMember[] }
  if (res.ok && data?.success && Array.isArray(data.members)) {
    writeCachedArray(GROUP_MEMBERS_CACHE_KEY, data.members)
  }
}

export function prewarmDirectoryData(): Promise<void> {
  if (!prewarmInFlight) {
    prewarmInFlight = prewarmGroupMembers()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        prewarmInFlight = null
      })
  }

  return prewarmInFlight
}
