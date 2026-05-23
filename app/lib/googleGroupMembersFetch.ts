import type { GroupMember } from '@/app/lib/directoryPeople'
import { normalizeEmail } from '@/app/lib/directoryPeople'

const SCRIPT_URL = process.env.GOOGLE_GROUPS_SCRIPT_URL
const SCRIPT_KEY = process.env.GOOGLE_GROUPS_SCRIPT_KEY

function parseMemberArray(arr: unknown[]): GroupMember[] {
  const out: GroupMember[] = []
  for (const item of arr) {
    if (typeof item === 'string') {
      const email = item.trim()
      if (normalizeEmail(email)) out.push({ email })
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const email = String(o.email ?? o.Email ?? o.EMAIL ?? '').trim()
      if (!normalizeEmail(email)) continue
      const name = String(o.name ?? o.Name ?? o.displayName ?? '').trim() || undefined
      out.push({ email, name })
    }
  }
  return out
}

function coerceMembers(data: unknown): GroupMember[] {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  if (Array.isArray(obj.members)) return parseMemberArray(obj.members)
  if (Array.isArray(obj.emails)) {
    return (obj.emails as unknown[])
      .map(e => ({ email: String(e || '').trim() }))
      .filter(m => normalizeEmail(m.email))
  }
  if (Array.isArray(obj.rows)) return parseMemberArray(obj.rows)
  return []
}

/** Live foster Google Group roster from the Groups Apps Script (`?action=group_members`). */
export async function fetchGoogleGroupMembersFromScript(): Promise<GroupMember[]> {
  if (!SCRIPT_URL) {
    throw new Error('Missing GOOGLE_GROUPS_SCRIPT_URL')
  }
  const url = new URL(SCRIPT_URL)
  url.searchParams.set('action', 'group_members')
  if (SCRIPT_KEY) url.searchParams.set('key', SCRIPT_KEY)

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Google Group script did not return valid JSON')
  }
  if (!res.ok) {
    const err =
      json && typeof json === 'object' && 'error' in json
        ? String((json as { error?: unknown }).error)
        : `HTTP ${res.status}`
    throw new Error(err)
  }
  const obj = json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  if (obj?.success === false) {
    throw new Error(String(obj.error || 'Google Group script reported failure'))
  }
  return coerceMembers(json)
}
