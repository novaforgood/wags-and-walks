'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { formatDateShort } from '@/app/lib/fosterDirectory'
import { resolveNotes } from '@/app/lib/applicantOverrides'
import { normalizeEmailKey } from '@/app/lib/peopleTypes'
import { usePeople } from './PeopleProvider'
import styles from './NotesCard.module.css'

interface Props {
  email: string | null | undefined
  /** Applicant sheet email when it differs from the primary email (e.g. directory group email). */
  relatedEmail?: string | null
}

/** Person notes in Firebase applicantOverrides. Saves on blur. Works for any email. */
export default function ApplicantNotesCard({ email, relatedEmail }: Props) {
  const notesHeadingId = useId()
  const { overrides, setNotes } = usePeople()
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applicationHint = useMemo(() => {
    if (!email || !relatedEmail || normalizeEmailKey(relatedEmail) === normalizeEmailKey(email)) {
      return null
    }
    return { email: relatedEmail }
  }, [email, relatedEmail])

  const resolved = useMemo(
    () => (email ? resolveNotes(email, overrides, applicationHint) : { notes: '', notesUpdatedAt: undefined }),
    [email, overrides, applicationHint],
  )

  useEffect(() => {
    setDraft(null)
    setSaved(false)
    setError(null)
  }, [email, relatedEmail])

  const displayNotes = draft ?? resolved.notes

  return (
    <>
      <div className={styles.header}>
        <h3 className={styles.title} id={notesHeadingId}>
          Notes
        </h3>
        <div className={styles.headerRight}>
          {saving && <span className={styles.status}>Saving…</span>}
          {!saving && saved && <span className={styles.status}>Saved</span>}
          {!saving && !saved && error && <span className={styles.errorStatus}>{error}</span>}
          {!saving && !saved && !error && resolved.notesUpdatedAt && (
            <span className={styles.status}>Updated {formatDateShort(resolved.notesUpdatedAt)}</span>
          )}
        </div>
      </div>

      <textarea
        className={styles.textarea}
        placeholder={email ? 'No notes yet…' : 'Email required to save notes'}
        disabled={!email || saving}
        value={displayNotes}
        onChange={e => {
          setDraft(e.target.value)
          setSaved(false)
          setError(null)
        }}
        aria-labelledby={notesHeadingId}
        onBlur={async () => {
          if (!email || draft === null) return
          setSaving(true)
          setError(null)
          try {
            const related =
              relatedEmail && normalizeEmailKey(relatedEmail) !== normalizeEmailKey(email)
                ? { relatedEmail }
                : undefined
            await setNotes(email, draft, related)
            setDraft(null)
            setSaved(true)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save notes'
            setError(message)
            console.error('Failed to save notes:', err)
          } finally {
            setSaving(false)
          }
        }}
      />
    </>
  )
}
