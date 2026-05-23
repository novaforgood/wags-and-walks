import {
  doc,
  setDoc,
  collection,
  onSnapshot,
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

export function subscribeToOverrides(
  callback: (overrides: Record<string, ApplicantOverride>) => void,
): () => void {
  return onSnapshot(collection(db, OVERRIDES_COLLECTION), snapshot => {
    const map: Record<string, ApplicantOverride> = {}
    snapshot.forEach(d => {
      map[d.id] = d.data() as ApplicantOverride
    })
    callback(map)
  })
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
