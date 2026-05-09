import {
  doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase'

export type UserRole = 'admin' | 'user'

export type AllowedUser = {
  email: string
  role: UserRole
  addedAt: { seconds: number; nanoseconds: number } | null
  addedBy: string
}

export async function getAllowedUser(email: string): Promise<AllowedUser | null> {
  const normalized = email.trim().toLowerCase()
  const snap = await getDoc(doc(db, 'allowedUsers', normalized))
  return snap.exists() ? (snap.data() as AllowedUser) : null
}

export async function listAllowedUsers(): Promise<AllowedUser[]> {
  const snap = await getDocs(collection(db, 'allowedUsers'))
  return snap.docs.map(d => d.data() as AllowedUser)
}

export async function addAllowedUser(
  email: string,
  role: UserRole,
  addedBy: string
): Promise<void> {
  const normalized = email.trim().toLowerCase()
  await setDoc(doc(db, 'allowedUsers', normalized), {
    email: normalized,
    role,
    addedAt: serverTimestamp(),
    addedBy,
  })
}

export async function removeAllowedUser(email: string): Promise<void> {
  await deleteDoc(doc(db, 'allowedUsers', email.trim().toLowerCase()))
}
