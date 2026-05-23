'use client'

import { useId, useRef, useState, useEffect } from 'react'
import styles from './gmailCompose.module.css'

type Props = {
  email: string | null | undefined
  recipientName?: string
  dogNames?: string[]
}

export default function GmailCompose({ email, recipientName, dogNames }: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  function openModal() {
    const firstName = recipientName?.split(/\s+/)[0]?.trim() ?? ''
    const dogs = (dogNames ?? []).filter(Boolean)
    const dogList = dogs.length > 0
      ? dogs.length === 1 ? dogs[0] : `${dogs.slice(0, -1).join(', ')} and ${dogs[dogs.length - 1]}`
      : null
    const sub = dogList ? `Checking in on ${dogList}!` : 'Checking in!'
    const greeting = firstName ? `Hey ${firstName},` : 'Hey,'
    const bod = dogList
      ? `${greeting}\n\nJust checking in on ${dogList} — how are things going?`
      : `${greeting}\n\nJust checking in — how are things going?`
    setSubject(sub)
    setBody(bod)
    setPos(null)
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
    setPos(null)
  }

  function openInGmail() {
    const to = email!.trim()
    const url = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    closeModal()
  }

  function onHeaderMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return
    const rect = modalRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top }
    setDragging(true)
    e.preventDefault()
  }

  useEffect(() => {
    if (!dragging) return
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return
      setPos({
        x: dragRef.current.px + (e.clientX - dragRef.current.mx),
        y: dragRef.current.py + (e.clientY - dragRef.current.my),
      })
    }
    function onUp() { setDragging(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const modalStyle = pos
    ? { position: 'fixed' as const, left: pos.x, top: pos.y, margin: 0, transform: 'none' }
    : {}

  if (!email?.trim()) return null

  return (
    <>
      <button type="button" className={styles.trigger} onClick={openModal}>
        Compose email
      </button>

      {open && (
        <div
          className={styles.backdrop}
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            ref={modalRef}
            className={`${styles.modal} ${dragging ? styles.modalDragging : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={modalStyle}
          >
            <div
              className={`${styles.header} ${styles.headerDraggable}`}
              onMouseDown={onHeaderMouseDown}
            >
              <span id={titleId} className={styles.title}>Compose email</span>
              <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className={styles.body}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${titleId}-to`}>To</label>
                <input
                  id={`${titleId}-to`}
                  className={`${styles.input} ${styles.inputReadonly}`}
                  type="text"
                  value={email?.trim()}
                  readOnly
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${titleId}-sub`}>Subject</label>
                <input
                  id={`${titleId}-sub`}
                  className={styles.input}
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${titleId}-body`}>Message</label>
                <textarea
                  id={`${titleId}-body`}
                  className={styles.textarea}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={styles.gmailBtn} onClick={openInGmail}>
                Open in Gmail
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
