'use client'

import { useEffect, useId, useState } from 'react'
import { formatDateShort } from '@/app/lib/fosterDirectory'
import {
  getCachedFosterNotes,
  prefetchFosterNotes,
  setCachedFosterNotes,
} from '@/app/lib/fosterNotesClientCache'
import { authFetch } from '@/app/lib/authFetch'
import styles from './NotesCard.module.css'

interface Props {
  email: string | null | undefined
  initialNotes?: string
  initialNotesUpdatedAt?: string
}

/** Foster notes (Sheet 2). Saves on blur. */
export default function NotesCard({ email, initialNotes, initialNotesUpdatedAt }: Props) {
  const notesHeadingId = useId()
  const hasInitialNotes = initialNotes !== undefined || initialNotesUpdatedAt !== undefined
  const cachedNotes = getCachedFosterNotes(email)
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notesFromSheet, setNotesFromSheet] = useState<{ notes: string; notesUpdatedAt: string } | null>(
    hasInitialNotes
      ? { notes: initialNotes ?? '', notesUpdatedAt: initialNotesUpdatedAt ?? '' }
      : cachedNotes
        ? cachedNotes
      : null
  )
  const [isLoading, setIsLoading] = useState(() => Boolean(email) && !hasInitialNotes && !cachedNotes)

  useEffect(() => {
    if (!email) {
      queueMicrotask(() => setIsLoading(false))
      return
    }
    let active = true
    queueMicrotask(() => {
      if (active && !hasInitialNotes && !getCachedFosterNotes(email)) setIsLoading(true)
    })
    prefetchFosterNotes(email)
      .then(entry => {
        if (!active) return
        if (entry) {
          setNotesFromSheet(entry)
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [email, hasInitialNotes])

  return (
    <>
      <div className={styles.header}>
        <h3 className={styles.title} id={notesHeadingId}>
          Notes
        </h3>
        <div className={styles.headerRight}>
          {saving && <span className={styles.status}>Saving…</span>}
          {!saving && saved && <span className={styles.status}>Saved</span>}
          {!saving && !saved && notesFromSheet?.notesUpdatedAt && (
            <span className={styles.status}>Updated {formatDateShort(notesFromSheet.notesUpdatedAt)}</span>
          )}
        </div>
      </div>

      <textarea
        className={styles.textarea}
        placeholder={isLoading ? 'Loading…' : 'No notes yet…'}
        disabled={isLoading}
        value={draft ?? (notesFromSheet?.notes ?? '')}
        onChange={e => {
          setDraft(e.target.value)
          setSaved(false)
        }}
        aria-labelledby={notesHeadingId}
        onBlur={async () => {
          if (!email || draft === null) return
          setSaving(true)
          const updatedAt = new Date().toISOString()
          try {
            const res = await authFetch('/api/foster-notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, content: draft }),
            })
            if (!res.ok) throw new Error(`Failed to save foster note (${res.status})`)
            setCachedFosterNotes(email, { notes: draft, notesUpdatedAt: updatedAt })
            setNotesFromSheet({
              notes: draft,
              notesUpdatedAt: updatedAt,
            })
            setSaved(true)
          } catch (err) {
            console.error('Failed to save foster note:', err)
            setSaved(false)
          } finally {
            setSaving(false)
          }
        }}
      />
    </>
  )
}
