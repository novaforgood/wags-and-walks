'use client'

import { useMemo, useState } from 'react'
import type { PersonStatus } from '@/app/lib/peopleTypes'
import { normalizeEmailKey } from '@/app/lib/peopleTypes'
import { usePeople } from '@/app/components/PeopleProvider'
import styles from './ApplicantsSheet.module.css'

type Props = {
  title: string
  status: PersonStatus
  moveToStatus?: PersonStatus
  moveButtonLabel?: string
  toolbarCenter?: React.ReactNode
  highlightEmails?: Set<string>
}

function formatAppliedAt(appliedAt?: string, raw?: Record<string, string>) {
  if (appliedAt) {
    const d = new Date(appliedAt)
    return isNaN(d.getTime()) ? appliedAt : d.toLocaleString()
  }
  const rawTs = raw && (raw['Timestamp'] || raw['timestamp'])
  return rawTs ? String(rawTs) : ''
}

function renderFlags(rawFlags: string) {
  const normalized = String(rawFlags || '').trim()
  const parts = normalized
    ? normalized
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : ['OK']

  const badgeClass = (flag: string) => {
    const f = flag.toUpperCase()
    if (f === 'UNDER_21') return `${styles.badge} ${styles.badgeAmber}`
    if (f === 'NO_PET_EXPERIENCE') return `${styles.badge} ${styles.badgeInfo}`
    if (f === 'OK') return `${styles.badge} ${styles.badgeGreen}`
    return `${styles.badge} ${styles.badgeGrey}`
  }

  return (
    <div className={styles.badges}>
      {parts.map(flag => (
        <span key={flag} className={badgeClass(flag)}>
          {flag}
        </span>
      ))}
    </div>
  )
}

function renderReviewStatus(raw: string) {
  const text = String(raw || '').trim()
  const normalized = text.toLowerCase()
  const isNeeds = normalized.includes('needs review')
  const isOk = normalized === 'ok' || normalized.includes('cleared')

  if (!text) return <span className={styles.muted}>—</span>

  if (isOk) {
    return (
      <span className={`${styles.reviewStatus} ${styles.reviewOk}`}>
        <span className={styles.reviewDot} />
        <span className={styles.reviewIcon}>✓</span>
        <span>{text}</span>
      </span>
    )
  }

  if (isNeeds) {
    return (
      <span className={`${styles.reviewStatus} ${styles.reviewNeeds}`}>
        <span className={styles.reviewDot} />
        <span>{text}</span>
      </span>
    )
  }

  return (
    <span className={styles.reviewStatus}>
      <span className={styles.reviewDot} />
      <span>{text}</span>
    </span>
  )
}

export default function ApplicantsSheet({
  title,
  status,
  moveToStatus,
  moveButtonLabel,
  toolbarCenter,
  highlightEmails
}: Props) {
  const { people, isLoading, error, setStatus, refresh } = usePeople()
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())

  const filtered = useMemo(
    () => people.filter(p => (p.status || 'new') === status),
    [people, status]
  )

  const selectedCount = selectedEmails.size
  const canMove = Boolean(moveToStatus)

  const toggleSelected = (email?: string) => {
    const key = normalizeEmailKey(email)
    if (!key) return
    setSelectedEmails(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const moveSelected = () => {
    if (!moveToStatus || selectedEmails.size === 0) return
    for (const email of selectedEmails) setStatus(email, moveToStatus)
    setSelectedEmails(new Set())
  }

  const highlighted = highlightEmails || new Set<string>()

  return (
    <main className={styles.pageMain}>
      <div className={styles.pageContainer}>
        <h1 className={styles.pageTitle}>{title}</h1>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <button
              type="button"
              className={styles.moveButton}
              onClick={moveSelected}
              disabled={!canMove || selectedCount === 0}
            >
              {moveButtonLabel || (moveToStatus ? `Move to ${moveToStatus}` : 'Move')}
            </button>
            <div className={styles.selectionMeta}>
              {selectedCount === 0 ? (
                <span className={styles.muted}>
                  {canMove ? 'Select applicants to move' : 'Selection disabled'}
                </span>
              ) : (
                <span>{selectedCount} selected</span>
              )}
            </div>
          </div>

          <div className={styles.toolbarCenter}>{toolbarCenter}</div>

          <div className={styles.toolbarRight}>
            <button type="button" onClick={refresh} className={styles.refreshButton}>
              Refresh from Sheet
            </button>
            {isLoading && <span className={styles.selectionMeta}>Loading…</span>}
            {error && (
              <span className={styles.selectionMeta} style={{ color: '#b00020' }}>
                {error}
              </span>
            )}
          </div>
        </div>

        <div className={styles.tableViewport} role="region" aria-label={`${title} applicants table`}>
          <table className={styles.sheet}>
            <thead>
              <tr>
                <th
                  className={`${styles.th} ${styles.stickyCheckbox} ${styles.stickyHeaderCheckbox}`}
                  aria-label="Select"
                />
                <th className={`${styles.th} ${styles.stickyName} ${styles.stickyHeaderName}`}>
                  Applicant
                </th>
                <th className={styles.th}>Age</th>
                <th className={styles.th}>Email</th>
                <th className={styles.th}>Phone</th>
                <th className={styles.th}>Applied</th>
                <th className={styles.th}>Availability</th>
                <th className={styles.th}>Special needs</th>
                <th className={styles.th}>Flags</th>
                <th className={styles.th}>Review status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person, i) => {
                const emailKey = normalizeEmailKey(person.email)
                const highlight = Boolean(
                  emailKey && (selectedEmails.has(emailKey) || highlighted.has(emailKey))
                )

                const name =
                  `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
                const email = String(person.email || '').trim()
                const applied = formatAppliedAt(person.appliedAt, person.raw)
                const availability = String(person.availability || '').trim()
                const needs = (person.specialNeeds || []).filter(Boolean)
                const flags = String(person.raw?.['Flags'] || '').trim()
                const reviewStatus = String(person.raw?.['Review Status'] || '').trim()

                return (
                  <tr
                    key={emailKey || `${name}-${i}`}
                    className={`${styles.row} ${highlight ? styles.rowHighlight : ''}`}
                  >
                    <td className={`${styles.td} ${styles.stickyCheckbox}`}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${name}`}
                        checked={Boolean(emailKey && selectedEmails.has(emailKey))}
                        onChange={() => toggleSelected(person.email)}
                        disabled={!canMove || !emailKey}
                      />
                    </td>
                    <td className={`${styles.td} ${styles.stickyName}`}>
                      <div className={styles.nameCell}>
                        <div className={styles.namePrimary}>{name}</div>
                        {email && <div className={styles.nameSecondary}>{email}</div>}
                      </div>
                    </td>
                    <td className={styles.td}>{person.age ?? '—'}</td>
                    <td className={styles.td}>{email || '—'}</td>
                    <td className={styles.td}>{person.phone ?? '—'}</td>
                    <td className={styles.td}>{applied || '—'}</td>
                    <td className={`${styles.td} ${styles.wrap}`}>{availability || '—'}</td>
                    <td className={`${styles.td} ${styles.wrap}`}>
                      {needs.length > 0 ? needs.join(', ') : '—'}
                    </td>
                    <td className={`${styles.td} ${styles.wrap}`}>{renderFlags(flags)}</td>
                    <td className={styles.td}>{renderReviewStatus(reviewStatus)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
