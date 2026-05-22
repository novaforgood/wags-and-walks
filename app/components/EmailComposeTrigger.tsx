'use client'

import { useId, useRef, useState } from 'react'
import styles from './emailCompose.module.css'

type Props = {
  /** Recipient address (Gmail send via Apps Script). */
  email: string | null | undefined
  /** Used to personalize the default message body. */
  recipientName?: string
  /** Visible label on the trigger control. */
  label?: string
}

/**
 * One-off email compose (Sheet 1 proxy). Kept separate from foster notes on purpose —
 * notes are Sheet 2; this flow is unrelated outreach.
 */
export default function EmailComposeTrigger({
  email,
  recipientName,
  label = 'Compose email',
}: Props) {
  const titleId = useId()
  const [popupOpen, setPopupOpen] = useState(false)
  const [subject, setSubject] = useState('Checking in!')
  const [body, setBody] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })
  const dragStartPos = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const isDragging = useRef(false)

  if (!email?.trim()) return null

  function openPopup() {
    const first = recipientName?.split(/\s+/)[0]?.trim() ?? ''
    setSubject('Checking in!')
    setBody(first ? `Hey ${first}, checking in on …` : 'Hey, checking in on …')
    setSendStatus('idle')
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
    const to = email?.trim()
    if (!to || !subject.trim() || !body.trim()) return
    setSendStatus('sending')
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_single_email',
          to,
          subject,
          body,
        }),
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
      <button type="button" className={styles.trigger} onClick={openPopup}>
        {label}
      </button>

      {popupOpen && (
        <div
          className={styles.popup}
          style={{ left: popupPos.x, top: popupPos.y }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div
            className={styles.popupHeader}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <span id={titleId} className={styles.popupTitle}>
              Compose email
            </span>
            <button type="button" className={styles.popupCloseBtn} onClick={closePopup} aria-label="Close">
              ✕
            </button>
          </div>

          <div className={styles.popupBody}>
            <div className={styles.popupField}>
              <label className={styles.popupLabel} htmlFor={`${titleId}-sub`}>
                Subject
              </label>
              <input
                id={`${titleId}-sub`}
                className={styles.popupInput}
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className={styles.popupField}>
              <label className={styles.popupLabel} htmlFor={`${titleId}-body`}>
                Message
              </label>
              <textarea
                id={`${titleId}-body`}
                className={styles.popupTextarea}
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.popupFooter}>
            {sendStatus === 'sending' && <span className={styles.popupStatus}>Sending…</span>}
            {sendStatus === 'sent' && <span className={styles.popupStatus}>Sent</span>}
            {sendStatus === 'error' && (
              <span className={styles.popupStatusError}>Could not send. Try again.</span>
            )}
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
