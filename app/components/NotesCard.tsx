'use client'

import { useEffect, useRef, useState } from 'react'
import { formatDateShort } from '@/app/lib/fosterDirectory'
import styles from './NotesCard.module.css'

interface Props {
  email: string | null | undefined
  name?: string
}

export default function NotesCard({ email, name }: Props) {
  // Notes state
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notesFromSheet, setNotesFromSheet] = useState<{ notes: string; notesUpdatedAt: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Popup state
  const [popupOpen, setPopupOpen] = useState(false)
  const [subject, setSubject] = useState('Checking in!')
  const [body, setBody] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Drag state
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })
  const dragStartPos = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const isDragging = useRef(false)

  useEffect(() => {
    if (!email) {
      setIsLoading(false)
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
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [email])

  // Reset popup fields each time it opens
  function openPopup() {
    const firstName = name?.split(' ')[0] ?? ''
    setSubject('Checking in!')
    setBody(firstName ? `Hey ${firstName}, checking in on ...` : 'Hey, checking in on ...')
    setSendStatus('idle')
    // Center in viewport
    setPopupPos({
      x: Math.round(window.innerWidth / 2 - 210),
      y: Math.round(window.innerHeight / 2 - 160),
    })
    setPopupOpen(true)
  }

  function closePopup() {
    setPopupOpen(false)
    setSendStatus('idle')
  }

  async function handleSend() {
    if (!email || !subject.trim() || !body.trim()) return
    setSendStatus('sending')
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_single_email', to: email, subject, body }),
      })
      const data = await res.json()
      if (data?.success) {
        setSendStatus('sent')
        setTimeout(closePopup, 1500)
      } else {
        setSendStatus('error')
      }
    } catch {
      setSendStatus('error')
    }
  }

  function onDragStart(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
    dragStartPos.current = { mx: e.clientX, my: e.clientY, px: popupPos.x, py: popupPos.y }
  }

  function onDragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    setPopupPos({
      x: dragStartPos.current.px + (e.clientX - dragStartPos.current.mx),
      y: dragStartPos.current.py + (e.clientY - dragStartPos.current.my),
    })
  }

  function onDragEnd() {
    isDragging.current = false
  }

  return (
    <>
      <div className={styles.header}>
        <h3 className={styles.title}>Notes</h3>
        <div className={styles.headerRight}>
          {saving && <span className={styles.status}>Saving...</span>}
          {!saving && saved && <span className={styles.status}>Saved</span>}
          {!saving && !saved && notesFromSheet?.notesUpdatedAt && (
            <span className={styles.status}>Last saved: {formatDateShort(notesFromSheet.notesUpdatedAt)}</span>
          )}
          {email && (
            <button type="button" className={styles.sendBtn} onClick={openPopup}>
              Send Email
            </button>
          )}
        </div>
      </div>

      <textarea
        className={styles.textarea}
        placeholder={isLoading ? 'Loading...' : 'No notes yet...'}
        disabled={isLoading}
        value={draft ?? (notesFromSheet?.notes ?? '')}
        onChange={e => {
          setDraft(e.target.value)
          setSaved(false)
        }}
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

      {popupOpen && (
        <div
          className={styles.popup}
          style={{ left: popupPos.x, top: popupPos.y }}
        >
          <div
            className={styles.popupHeader}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <span className={styles.popupTitle}>Send Email</span>
            <button type="button" className={styles.popupCloseBtn} onClick={closePopup}>✕</button>
          </div>

          <div className={styles.popupBody}>
            <div className={styles.popupField}>
              <label className={styles.popupLabel}>Subject</label>
              <input
                className={styles.popupInput}
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>
            <div className={styles.popupField}>
              <label className={styles.popupLabel}>Message</label>
              <textarea
                className={styles.popupTextarea}
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.popupFooter}>
            {sendStatus === 'sending' && <span className={styles.popupStatus}>Sending...</span>}
            {sendStatus === 'sent' && <span className={styles.popupStatus}>Sent!</span>}
            {sendStatus === 'error' && <span className={styles.popupStatusError}>Failed to send. Try again.</span>}
            <button
              type="button"
              className={styles.popupSubmit}
              onClick={handleSend}
              disabled={sendStatus === 'sending' || sendStatus === 'sent'}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
