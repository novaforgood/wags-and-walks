import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

const COLLECTION = 'fosterNotes'

function noteKey(email: string): string {
  return email.trim().toLowerCase()
}

export async function getFosterNoteFromFirestore(
  email: string,
): Promise<{ notes: string; notesUpdatedAt: string } | null> {
  const snap = await getDoc(doc(db, COLLECTION, noteKey(email)))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    notes: String(data.notes ?? ''),
    notesUpdatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
  }
}

export async function setFosterNoteInFirestore(
  email: string,
  notes: string,
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, noteKey(email)),
    { notes, updatedAt: serverTimestamp() },
    { merge: true },
  )
}
