/**
 * Local-only applicant "mark" — Approved or Rejected.
 *
 * This is a per-browser tag for the volunteer. It does NOT change the
 * Google Sheets pipeline status. The UI presents it as "Mark Approved" /
 * "Mark Rejected" / "Unmark" to make that explicit.
 */

import { normalizeEmailKey } from '@/app/lib/peopleTypes'

export type TriageOutcome = 'approved' | 'rejected'

const STORAGE_KEY = 'applicant_mark_v1'

function isClient(): boolean {
  return typeof window !== 'undefined'
}

function readMap(): Map<string, TriageOutcome> {
  if (!isClient()) return new Map()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return new Map()
    const m = new Map<string, TriageOutcome>()
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = normalizeEmailKey(k)
      if (!key) continue
      if (v === 'approved' || v === 'rejected') m.set(key, v)
    }
    return m
  } catch {
    return new Map()
  }
}

function writeMap(map: Map<string, TriageOutcome>): void {
  if (!isClient()) return
  try {
    const obj: Record<string, TriageOutcome> = {}
    for (const [k, v] of map) obj[k] = v
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    /* ignore */
  }
}

export function getTriageMap(): Map<string, TriageOutcome> {
  return readMap()
}

export function getTriageOutcome(
  email: string | undefined,
  map?: Map<string, TriageOutcome>
): TriageOutcome | undefined {
  const key = normalizeEmailKey(email)
  if (!key) return undefined
  return (map ?? readMap()).get(key)
}

export function setTriageOutcome(
  email: string | undefined,
  outcome: TriageOutcome
): Map<string, TriageOutcome> {
  const key = normalizeEmailKey(email)
  if (!key) return readMap()
  const map = readMap()
  map.set(key, outcome)
  writeMap(map)
  return map
}

export function clearTriageOutcome(email: string | undefined): Map<string, TriageOutcome> {
  const key = normalizeEmailKey(email)
  if (!key) return readMap()
  const map = readMap()
  if (map.delete(key)) writeMap(map)
  return map
}

export function setManyTriageOutcome(
  emails: (string | undefined)[],
  outcome: TriageOutcome
): Map<string, TriageOutcome> {
  const map = readMap()
  let changed = false
  for (const e of emails) {
    const key = normalizeEmailKey(e)
    if (!key) continue
    map.set(key, outcome)
    changed = true
  }
  if (changed) writeMap(map)
  return map
}

export function clearManyTriageOutcome(
  emails: (string | undefined)[]
): Map<string, TriageOutcome> {
  const map = readMap()
  let changed = false
  for (const e of emails) {
    const key = normalizeEmailKey(e)
    if (!key) continue
    if (map.delete(key)) changed = true
  }
  if (changed) writeMap(map)
  return map
}
