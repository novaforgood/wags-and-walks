'use client'

import { useId, useRef, useState, useEffect } from 'react'
import {
  EMAIL_TEMPLATES,
  type EmailTemplateId,
  buildEmailFromTemplate,
  gmailComposeUrl,
  GMAIL_COMPOSE_URL_WARN_CHARS,
} from '@/app/lib/emailTemplates'
import styles from './emailTemplateCompose.module.css'

type Props = {
  email: string | null | undefined
  recipientName?: string
  dogNames?: string[]
  /** Which template to pre-select when the dialog opens. */
  defaultTemplateId?: EmailTemplateId
  label?: string
  /** `teal` — applicant modal; `pill` — foster profile hero */
  triggerVariant?: 'teal' | 'pill'
}

export default function EmailTemplateCompose({
  email,
  recipientName,
  dogNames,
  defaultTemplateId = 'check-in',
  label = 'Compose email',
  triggerVariant = 'teal',
}: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState<EmailTemplateId>(defaultTemplateId)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const bodyDirty = useRef(false)
  const subjectDirty = useRef(false)

  const vars = {
    firstName: recipientName?.split(/\s+/)[0]?.trim(),
    dogNames,
  }

  function applyTemplate(id: EmailTemplateId, resetDirty = true) {
    const built = buildEmailFromTemplate(id, vars)
    setTemplateId(id)
    if (resetDirty || !subjectDirty.current) setSubject(built.subject)
    if (resetDirty || !bodyDirty.current) setBody(built.body)
    if (resetDirty) {
      subjectDirty.current = false
      bodyDirty.current = false
    }
  }

  function openModal() {
    applyTemplate(defaultTemplateId, true)
    setCopyStatus('idle')
    setPos(null)
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
    setPos(null)
    setCopyStatus('idle')
  }

  function onTemplateChange(id: EmailTemplateId) {
    if (id === templateId) return
    if (subjectDirty.current || bodyDirty.current) {
      const switching = window.confirm(
        'Switch template? This will replace the subject and message with the selected template.',
      )
      if (!switching) return
    }
    applyTemplate(id, true)
  }

  function openInGmail() {
    const to = email?.trim()
    if (!to || !subject.trim() || !body.trim()) return
    window.open(gmailComposeUrl(to, subject, body), '_blank', 'noopener,noreferrer')
    closeModal()
  }

  async function copyToClipboard() {
    const text = `Subject: ${subject}\n\n${body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('error')
    }
  }

  function onHeaderMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button, select')) return
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
    function onUp() {
      setDragging(false)
    }
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

  const bodyTooLong = body.length > GMAIL_COMPOSE_URL_WARN_CHARS
  const triggerClass =
    triggerVariant === 'pill' ? styles.triggerPill : styles.triggerTeal

  if (!email?.trim()) return null

  return (
    <>
      <button type="button" className={triggerClass} onClick={openModal}>
        {label}
      </button>

      {open && (
        <div
          className={styles.backdrop}
          role="presentation"
          onClick={e => {
            if (e.target === e.currentTarget) closeModal()
          }}
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
              <span id={titleId} className={styles.title}>
                Email template
              </span>
              <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>

            <div className={styles.body}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${titleId}-to`}>
                  To
                </label>
                <input
                  id={`${titleId}-to`}
                  className={`${styles.input} ${styles.inputReadonly}`}
                  type="text"
                  value={email.trim()}
                  readOnly
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${titleId}-tpl`}>
                  Template
                </label>
                <select
                  id={`${titleId}-tpl`}
                  className={styles.select}
                  value={templateId}
                  onChange={e => onTemplateChange(e.target.value as EmailTemplateId)}
                >
                  {EMAIL_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className={styles.templateHint}>
                  {EMAIL_TEMPLATES.find(t => t.id === templateId)?.description}
                </p>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${titleId}-sub`}>
                  Subject
                </label>
                <input
                  id={`${titleId}-sub`}
                  className={styles.input}
                  type="text"
                  value={subject}
                  onChange={e => {
                    subjectDirty.current = true
                    setSubject(e.target.value)
                  }}
                  autoComplete="off"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${titleId}-body`}>
                  Message
                </label>
                <textarea
                  id={`${titleId}-body`}
                  className={styles.textarea}
                  value={body}
                  onChange={e => {
                    bodyDirty.current = true
                    setBody(e.target.value)
                  }}
                />
              </div>

              {bodyTooLong && (
                <p className={styles.warn}>
                  This message is long — Gmail may not pre-fill everything. Use &ldquo;Copy&rdquo; and
                  paste into Gmail if needed.
                </p>
              )}
            </div>

            <div className={styles.footer}>
              {copyStatus === 'copied' && (
                <span className={styles.footerStatus}>Copied to clipboard</span>
              )}
              {copyStatus === 'error' && (
                <span className={styles.footerStatusError}>Could not copy</span>
              )}
              <button type="button" className={styles.secondaryBtn} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={copyToClipboard}>
                Copy
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={openInGmail}
                disabled={!subject.trim() || !body.trim()}
              >
                Open in Gmail
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
