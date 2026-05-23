'use client'

import { useState } from 'react'
import { auth } from '@/firebase'
import styles from './syncButton.module.css'

type Props = {
  /** ISO string of when data was last synced — shown as "Last synced X ago" */
  updatedAt?: string
  /** Called after a successful sync so the parent can re-fetch fresh data */
  onRefresh: () => void
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function SyncButton({ updatedAt, onRefresh }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(false)
  const statusLabel = error ? 'Sync failed' : updatedAt ? `Synced ${formatAgo(updatedAt)}` : null

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    setError(false)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('You must be signed in to sync')
      const res = await fetch('/api/sync/all', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Sync failed with status ${res.status}`)
      onRefresh()
    } catch {
      setError(true)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className={styles.wrap}>
      {statusLabel && !syncing && (
        <span className={`${styles.label} ${error ? styles.labelError : ''}`}>
          {statusLabel}
        </span>
      )}
      {syncing && <span className={styles.label}>Syncing…</span>}
      <button
        type="button"
        className={styles.btn}
        onClick={handleSync}
        disabled={syncing}
        aria-label="Sync data from upstream sources"
        title="Pull latest data from ASM and Google Group"
      >
        <svg
          className={`${styles.icon} ${syncing ? styles.iconSpin : ''}`}
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path
            d="M13.25 6.25a5.5 5.5 0 1 0-1.46 5.27"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.25 2.75v3.5h-3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {syncing ? 'Syncing' : 'Sync'}
      </button>
    </div>
  )
}
