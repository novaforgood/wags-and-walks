'use client'

import { useRef, useState } from 'react'
import styles from './EmailModal.module.css'

interface Recipient {
  email: string
  firstName: string
  lastName: string
  fullName: string
}

export default function EmailModal() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [emailText, setEmailText] = useState(
    'Hi [insert]! thanks for your interest in fostering...'
  )
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleOpen = async () => {
    // Show modal immediately
    dialogRef.current?.showModal()
    
    // Fetch emails in the background
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailContent: emailText,
          subject: 'Test Email',
          testEmail: 'ja.thapar@gmail.com',
          sendEmails: true
        })
      })

      const rawText = await response.text()
      let data: { success?: boolean; recipients?: Recipient[]; emails?: string[]; error?: string } | null = null
      try {
        data = JSON.parse(rawText)
      } catch (parseError) {
        setError('Invalid JSON returned from server')
        console.error('JSON parse error:', parseError)
        return
      }

      console.log('API Response:', data)
      if (data?.success) {
        if (Array.isArray(data.recipients)) {
          setRecipients(data.recipients)
        } else if (Array.isArray(data.emails)) {
          setRecipients(
            data.emails.map(email => ({
              email,
              firstName: '',
              lastName: '',
              fullName: ''
            }))
          )
        } else {
          setRecipients([])
        }
      } else {
        setError(data?.error || 'Failed to fetch emails')
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

  const toggleEmail = (index: number) => {
    const newSelected = new Set(selectedIndices)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedIndices(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIndices.size === recipients.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(recipients.map((_, i) => i)))
    }
  }

  const handleSend = () => {
    const selectedRecipients = recipients.filter((_, i) => selectedIndices.has(i))
    console.log('Email content:', emailText)
    console.log('Selected recipients:', selectedRecipients)
    handleClose()
  }

  return (
    <>
      <button onClick={handleOpen} className={styles.button}>
        Send Email
      </button>

      <dialog ref={dialogRef} className={styles.dialog} style={{ transform: `translate(${position.x}px, ${position.y}px)` }} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
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

          <div className={styles.emailsList}>
            <p className={styles.emailsLabel}>
              {isLoading ? 'Loading recipients...' : `Recipients (${recipients.length}):`}
            </p>
            <button 
              className={styles.selectAllButton}
              onClick={toggleSelectAll}
              disabled={recipients.length === 0}
            >
              {selectedIndices.size === recipients.length ? 'Deselect All' : 'Select All'}
            </button>
            <ul className={styles.emailsListItems}>
              {recipients.map((recipient, index) => (
                <li key={index} className={selectedIndices.has(index) ? styles.emailItemSelected : ''}>
                  <input
                    type="checkbox"
                    checked={selectedIndices.has(index)}
                    onChange={() => toggleEmail(index)}
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
