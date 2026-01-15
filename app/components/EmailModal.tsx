'use client'

import { useRef, useState } from 'react'
import styles from './EmailModal.module.css'

export default function EmailModal() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [emailText, setEmailText] = useState(
    'Hi [insert]! thanks for your interest in fostering...'
  )

  const handleOpen = () => {
    dialogRef.current?.showModal()
  }

  const handleClose = () => {
    dialogRef.current?.close()
  }

  const handleSend = () => {
    console.log('Email content:', emailText)
    handleClose()
  }

  return (
    <>
      <button onClick={handleOpen} className={styles.button}>
        Send Email
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h2>Send Foster Interest Email</h2>
            <button
              onClick={handleClose}
              className={styles.closeButton}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>

          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            className={styles.textarea}
            placeholder="Enter email text..."
          />

          <div className={styles.buttonGroup}>
            <button onClick={handleClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button onClick={handleSend} className={styles.sendButton}>
              Send
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
