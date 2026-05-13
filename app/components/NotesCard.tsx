'use client'

import { useEffect, useId, useState } from 'react'
import { formatDateShort } from '@/app/lib/fosterDirectory'
import styles from './NotesCard.module.css'

interface Props {
  email: string | null | undefined
}

/** Foster notes (Sheet 2). Saves on blur. */
export default function NotesCard({ email }: Props) {
  const notesHeadingId = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notesFromSheet, setNotesFromSheet] = useState<{ notes: string; notesUpdatedAt: string } | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(email))

  useEffect(() => {
    if (!email) {
      queueMicrotask(() => setIsLoading(false))
      return
    }
    let active = true
    fetch(`/api/foster-notes?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(data => {
        if (!active) return
        if (data?.success) {
          setNotesFromSheet({ notes: data.notes || '', notesUpdatedAt: data.notesUpdatedAt || '' })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [email])

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
          await fetch('/api/foster-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, content: draft }),
          })
          setSaving(false)
          setSaved(true)
        }}
      />
    </>
  )
}
