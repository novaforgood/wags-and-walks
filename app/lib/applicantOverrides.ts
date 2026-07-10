import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { PersonStatus } from './peopleTypes'

export const OVERRIDES_COLLECTION = 'applicantOverrides'

export type ApplicantOverride = {
  status?: PersonStatus
  starred?: boolean
  notes?: string
  notesUpdatedAt?: string
  signedDocument?: 'Yes' | 'No'
  updatedAt?: unknown
  updatedBy?: string
}

export function overrideKey(email: string): string {
  return email.trim().toLowerCase()
}

export async function setOverride(
  email: string,
  fields: Partial<Omit<ApplicantOverride, 'updatedAt' | 'updatedBy'>>,
  updatedBy: string,
): Promise<void> {
  const ref = doc(db, OVERRIDES_COLLECTION, overrideKey(email))
  await setDoc(
    ref,
    { ...fields, updatedAt: serverTimestamp(), updatedBy },
    { merge: true },
  )
}

export function mergeOverrides<T extends {
  email?: string
  status?: PersonStatus
  starred?: boolean
  notes?: string
  notesUpdatedAt?: string
  signedDocument?: 'Yes' | 'No'
}>(base: T[], overrides: Record<string, ApplicantOverride>): T[] {
  return base.map(p => {
    const key = overrideKey(p.email ?? '')
    const o = overrides[key]
    if (!o) return p
    return {
      ...p,
      ...(o.status !== undefined ? { status: o.status } : {}),
      ...(o.starred !== undefined ? { starred: o.starred } : {}),
      ...(o.notes !== undefined ? { notes: o.notes } : {}),
      ...(o.notesUpdatedAt !== undefined ? { notesUpdatedAt: o.notesUpdatedAt } : {}),
      ...(o.signedDocument !== undefined ? { signedDocument: o.signedDocument } : {}),
    }
  })
}

export function resolveStarred(
  email: string,
  overrides: Record<string, ApplicantOverride>,
  application?: { starred?: boolean; email?: string } | null,
): boolean {
  const keys = relatedOverrideEmails(email, application?.email)
  for (const key of keys) {
    if (overrides[key]?.starred !== undefined) return !!overrides[key].starred
  }
  if (application?.starred !== undefined) return !!application.starred
  return false
}

/** Normalized emails that should share VIP state (group vs applicant sheet). */
export function relatedOverrideEmails(
  primaryEmail: string,
  secondaryEmail?: string | null,
): string[] {
  const keys = [overrideKey(primaryEmail)]
  const secondary = secondaryEmail ? overrideKey(secondaryEmail) : ''
  if (secondary && !keys.includes(secondary)) keys.push(secondary)
  return keys
}

export type ResolvedNotes = {
  notes: string
  notesUpdatedAt?: string
}

export function resolveNotes(
  email: string,
  overrides: Record<string, ApplicantOverride>,
  application?: { notes?: string; notesUpdatedAt?: string; email?: string } | null,
): ResolvedNotes {
  const keys = relatedOverrideEmails(email, application?.email)
  for (const key of keys) {
    const o = overrides[key]
    if (o?.notes !== undefined) {
      return { notes: o.notes, notesUpdatedAt: o.notesUpdatedAt }
    }
  }
  if (application?.notes !== undefined) {
    return {
      notes: application.notes ?? '',
      notesUpdatedAt: application.notesUpdatedAt,
    }
  }
  return { notes: '', notesUpdatedAt: undefined }
}
