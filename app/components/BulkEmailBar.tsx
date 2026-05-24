'use client'

import { useId, useRef, useState, useEffect } from 'react'
import styles from './bulkEmailBar.module.css'

type Props = {
  selectedEmails: string[]
  onClear: () => void
}

export default function BulkEmailBar({ selectedEmails, onClear }: Props) {
  const titleId = useId()
  const [modalOpen, setModalOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const count = selectedEmails.length

  function openModal() {
    setSubject('A note from Wags & Walks')
    setBody('Hi,\n\nThank you so much for fostering with Wags & Walks — we truly appreciate everything you do for our dogs!\n\n[Add your message here]\n\nWith gratitude,\nThe Wags & Walks Team')
    setPos(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setPos(null)
  }

  function openInGmail() {
    const bcc = selectedEmails.join(',')
    const url = `https://mail.google.com/mail/?view=cm&bcc=${encodeURIComponent(bcc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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

  return (
    <>
      <div className={`${styles.bar} ${count > 0 ? styles.barVisible : ''}`} aria-hidden={count === 0}>
        <span className={styles.count}>
          {count} selected
        </span>
        <div className={styles.barActions}>
          <button type="button" className={styles.composeBtn} onClick={openModal}>
            Compose email
          </button>
          <button type="button" className={styles.clearBtn} onClick={onClear} aria-label="Clear selection">
            Clear
          </button>
        </div>
      </div>

      {modalOpen && (
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
              <div className={styles.recipientsRow}>
                <span className={styles.recipientsLabel}>BCC</span>
                <span className={styles.recipientsValue}>
                  {count} recipient{count === 1 ? '' : 's'}
                </span>
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
                  placeholder="Subject"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${titleId}-body`}>Message</label>
                <textarea
                  id={`${titleId}-body`}
                  className={styles.textarea}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write your message…"
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
