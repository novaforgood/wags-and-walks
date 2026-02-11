'use client'

import { useMemo, useRef, useState } from 'react'
import styles from './EmailModal.module.css'
import { usePeople } from './PeopleProvider'
import type { PersonStatus } from '@/app/lib/peopleTypes'
import { normalizeEmailKey } from '@/app/lib/peopleTypes'

interface Recipient {
  rowIndex: number
  email: string
  firstName: string
  lastName: string
  fullName: string
  isFlagged: boolean
}

type EmailModalProps = {
  onSentEmails?: (emails: string[]) => void
  sendToStatus?: PersonStatus
  onSelectedEmailsChange?: (emails: string[]) => void
}

export default function EmailModal({
  onSentEmails,
  sendToStatus = 'in-progress',
  onSelectedEmailsChange
}: EmailModalProps) {
  const { setStatus, people } = usePeople()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [emailText, setEmailText] = useState(
    'Hi [insert]! thanks for your interest in fostering...'
  )
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const clearedRecipients = recipients.filter(recipient => !recipient.isFlagged)
  const flaggedRecipients = recipients.filter(recipient => recipient.isFlagged)
  const allFlaggedSelected =
    flaggedRecipients.length > 0 && selectedRowIds.size === flaggedRecipients.length

  const localRecipients = useMemo<Recipient[]>(() => {
    const mapped = people
      .map(p => {
        const rowIndex = Number(p.rowIndex)
        const email = String(p.email || '').trim()
        const firstName = String(p.firstName || '').trim()
        const lastName = String(p.lastName || '').trim()
        const flags = String(p.raw?.['Flags'] || '').trim()
        if (!Number.isFinite(rowIndex) || !email) return null
        return {
          rowIndex,
          email,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim(),
          isFlagged: Boolean(flags)
        } satisfies Recipient
      })
      .filter(Boolean) as Recipient[]

    // Prefer stable ordering by rowIndex (sheet order)
    mapped.sort((a, b) => a.rowIndex - b.rowIndex)
    return mapped
  }, [people])

  const emitSelectedEmails = (nextSelected: Set<number>) => {
    const emails = flaggedRecipients
      .filter(r => nextSelected.has(r.rowIndex))
      .map(r => String(r.email || '').trim())
      .filter(Boolean)
    onSelectedEmailsChange?.(emails)
  }

  const handleOpen = async () => {
    // Show modal immediately
    dialogRef.current?.showModal()
    setPosition({ x: 0, y: 0 })
    
    // Use already-fetched people data when available (avoids extra round trip / wait time).
    if (localRecipients.length > 0) {
      setRecipients(localRecipients)
      const empty = new Set<number>()
      setSelectedRowIds(empty)
      onSelectedEmailsChange?.([])
      setIsLoading(false)
      setError(null)
      setDebugInfo(null)
      return
    }

    // Fallback: fetch emails in the background (legacy path).
    setIsLoading(true)
    setError(null)
    setDebugInfo(null)
    try {
      const fields = [
        'Timestamp',
        'First Name',
        'Last Name',
        'Email',
        'Flags',
        'Review Status'
      ].join(',')
      const response = await fetch(
        `/api/send-email?mode=ok&fields=${encodeURIComponent(fields)}`,
        { method: 'GET' }
      )

      const rawText = await response.text()
      let data:
        | { success?: boolean; rows?: Record<string, unknown>[]; error?: string }
        | null = null
      try {
        data = JSON.parse(rawText)
      } catch (parseError) {
        setError('Invalid JSON returned from server')
        console.error('JSON parse error:', parseError)
        return
      }

      console.log('API Response:', data)
      if (data?.success) {
        const rows = Array.isArray(data.rows) ? data.rows : []
        const mapped = rows
          .map(row => {
            const firstName = String(row['First Name'] || '').trim()
            const lastName = String(row['Last Name'] || '').trim()
            const email = String(row['Email'] || '').trim()
            const flags = String(row['Flags'] || '').trim()
            const rowIndex = Number(row.rowIndex)
            return {
              rowIndex,
              email,
              firstName,
              lastName,
              fullName: `${firstName} ${lastName}`.trim(),
              isFlagged: Boolean(flags)
            }
          })
          .filter(r => Number.isFinite(r.rowIndex) && r.email)
        setRecipients(mapped)
        const empty = new Set<number>()
        setSelectedRowIds(empty)
        onSelectedEmailsChange?.([])
      } else {
        setError(data?.error || 'Failed to fetch emails')
        try {
          const debugResponse = await fetch('/api/send-email?debug=1')
          const debugData = await debugResponse.json()
          setDebugInfo(JSON.stringify(debugData, null, 2))
        } catch (debugErr) {
          console.error('Debug fetch error:', debugErr)
        }
      }
    } catch (err) {
      setError('Error connecting to Google Sheets')
      console.error('Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    dialogRef.current?.close()
    setPosition({ x: 0, y: 0 })
    onSelectedEmailsChange?.([])
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    setIsDragging(true)
    setDragStart({ 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: Math.max(0, e.clientY - dragStart.y)
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const toggleEmail = (rowId: number) => {
    if (!Number.isFinite(rowId)) return
    const newSelected = new Set(selectedRowIds)
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId)
    } else {
      newSelected.add(rowId)
    }
    setSelectedRowIds(newSelected)
    emitSelectedEmails(newSelected)
  }

  const toggleSelectAll = () => {
    if (flaggedRecipients.length === 0) return
    if (selectedRowIds.size === flaggedRecipients.length) {
      const empty = new Set<number>()
      setSelectedRowIds(empty)
      onSelectedEmailsChange?.([])
    } else {
      const next = new Set(flaggedRecipients.map(r => r.rowIndex))
      setSelectedRowIds(next)
      emitSelectedEmails(next)
    }
  }

  const handleSend = async () => {
    const rowIndices = flaggedRecipients
      .filter(r => selectedRowIds.has(r.rowIndex))
      .map(r => r.rowIndex)

    if (rowIndices.length === 0) {
      setError('Select at least one recipient')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const selectedRecipients = flaggedRecipients.filter(r =>
        selectedRowIds.has(r.rowIndex)
      )

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: 'Foster Interest',
          emailContent: emailText,
          sendEmails: true,
          mode: 'ok',
          rowIndices
        })
      })

      const data = await response.json()
      if (!data?.success) {
        setError(data?.error || 'Failed to send emails')
        return
      }

      // Optimistically update UI immediately; background sync to Sheets is handled by PeopleProvider.
      const approvedEmails = selectedRecipients
        .map(r => normalizeEmailKey(r.email))
        .filter(Boolean)
      for (const email of approvedEmails) setStatus(email, sendToStatus)
      onSentEmails?.(approvedEmails)
      onSelectedEmailsChange?.([])

      handleClose()
    } catch (err) {
      setError('Error sending emails')
      console.error('Send error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button onClick={handleOpen} className={styles.button}>
        Send Email
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        style={{
          transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className={styles.modalContent}>
          <div className={styles.modalHeader} onMouseDown={handleMouseDown}>
            <h2>Send Foster Interest Email</h2>
            <button
              onClick={handleClose}
              className={styles.closeButton}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>

          {error && (
            <div className={styles.error}>
              Error: {error}
            </div>
          )}
          {debugInfo && (
            <pre className={styles.error}>
              {debugInfo}
            </pre>
          )}

          <div className={styles.emailsList}>
            <div className={styles.listSection}>
              <p className={styles.emailsLabel}>
                {isLoading ? 'Loading recipients...' : `Cleared (${clearedRecipients.length}):`}
              </p>
              <ul className={styles.emailsListItems}>
                {clearedRecipients.map(recipient => (
                  <li
                    key={recipient.rowIndex}
                    className={`${styles.emailItemSelected} ${styles.emailItemMuted} ${styles.emailItemNoCheckbox}`}
                  >
                    <div className={styles.recipientInfo}>
                      <span className={styles.recipientName}>
                        {recipient.fullName || 'Unknown'}
                      </span>
                      <span className={styles.recipientEmail}>{recipient.email}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.listSection}>
              <p className={styles.emailsLabel}>
                {isLoading ? 'Loading recipients...' : `Flagged (${flaggedRecipients.length}):`}
              </p>
              <button 
                className={styles.selectAllButton}
                onClick={toggleSelectAll}
                disabled={flaggedRecipients.length === 0}
              >
                {allFlaggedSelected ? 'Deselect All' : 'Select All'}
              </button>
              <ul className={styles.emailsListItems}>
                {flaggedRecipients.map(recipient => (
                  <li
                    key={recipient.rowIndex}
                    className={selectedRowIds.has(recipient.rowIndex) ? styles.emailItemSelected : ''}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRowIds.has(recipient.rowIndex)}
                      onChange={() => toggleEmail(recipient.rowIndex)}
                      className={styles.emailCheckbox}
                    />
                    <div className={styles.recipientInfo}>
                      <span className={styles.recipientName}>
                        {recipient.fullName || 'Unknown'}
                      </span>
                      <span className={styles.recipientEmail}>{recipient.email}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            className={styles.textarea}
            placeholder="Enter email text..."
            disabled={isLoading}
          />

          <div className={styles.buttonGroup}>
            <button onClick={handleClose} className={styles.cancelButton} disabled={isLoading}>
              Cancel
            </button>
            <button onClick={handleSend} className={styles.sendButton} disabled={isLoading || recipients.length === 0}>
              Send
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
