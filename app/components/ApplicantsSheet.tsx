'use client'

import { useMemo, useState } from 'react'
import type { PersonStatus, Person } from '@/app/lib/peopleTypes'
import { normalizeEmailKey } from '@/app/lib/peopleTypes'
import { usePeople } from '@/app/components/PeopleProvider'
import styles from './ApplicantsSheet.module.css'
import ApplicantCard from './ApplicantCard'

type Props = {
  title: string
  status: PersonStatus | PersonStatus[]
  moveToStatus?: PersonStatus
  moveButtonLabel?: string
  toolbarCenter?: React.ReactNode
  highlightEmails?: Set<string>
  selectedEmails?: Set<string>
  onSelectedEmailsChange?: (next: Set<string>) => void
  splitFlagged?: boolean
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
  highlightEmails,
  selectedEmails: controlledSelectedEmails,
  onSelectedEmailsChange,
  splitFlagged = false
}: Props) {
  const { people, isLoading, error, setStatus, refresh } = usePeople()
  const [internalSelectedEmails, setInternalSelectedEmails] = useState<Set<string>>(
    new Set()
  )
  const selectedEmails = controlledSelectedEmails ?? internalSelectedEmails

  const filtered = useMemo(
    () => {
      const targetStatuses = Array.isArray(status) ? status : [status]
      return people.filter(p => targetStatuses.includes(p.status || 'new'))
    },
    [people, status]
  )

  // Split logic for Onboarding
  const { mainList, flaggedList } = useMemo(() => {
    // If not split, just return filtered as mainList, but sorted by flagged status
    const sortFlaggedFirst = (list: Person[]) => {
      return [...list].sort((a, b) => {
        const aFlagged = (String(a.raw?.['Flags'] || '').trim().toLowerCase() !== 'ok' && String(a.raw?.['Flags'] || '').trim() !== '')
        const bFlagged = (String(b.raw?.['Flags'] || '').trim().toLowerCase() !== 'ok' && String(b.raw?.['Flags'] || '').trim() !== '')
        if (aFlagged === bFlagged) return 0
        return aFlagged ? -1 : 1
      })
    }

    if (!splitFlagged) {
      return { mainList: sortFlaggedFirst(filtered), flaggedList: [] }
    }

    // For split view (Onboarding), user wants ALL applicants in the left column (sorted),
    // AND flagged applicants in the right column.

    const flagged: Person[] = []
    // We want the main list to be EVERYONE from 'filtered', just sorted.
    const main = sortFlaggedFirst(filtered)

    for (const p of filtered) {
      const rawFlags = String(p.raw?.['Flags'] || '').trim()
      if (rawFlags && rawFlags.toLowerCase() !== 'ok') flagged.push(p)
    }
    return { mainList: main, flaggedList: flagged }
  }, [filtered, splitFlagged])

  const selectedCount = selectedEmails.size
  const canMove = Boolean(moveToStatus)

  const setSelected = (next: Set<string>) => {
    if (controlledSelectedEmails) {
      onSelectedEmailsChange?.(next)
      return
    }
    setInternalSelectedEmails(next)
    onSelectedEmailsChange?.(next)
  }

  const toggleSelected = (email?: string) => {
    const key = normalizeEmailKey(email)
    if (!key) return
    const next = new Set(selectedEmails)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }

  const moveSelected = () => {
    if (!moveToStatus || selectedEmails.size === 0) return
    for (const email of selectedEmails) setStatus(email, moveToStatus)
    setSelected(new Set())
  }

  // View toggle state
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  // Determine which list(s) to show
  // If splitFlagged is false, just show "mainList" (sorted/filtered)
  const isGrid = viewMode === 'grid'
  const containerClass = isGrid ? styles.gridContainer : styles.cardList

  const renderCardList = (list: Person[]) => (
    <div className={containerClass}>
      {list.map((person, i) => {
        const emailKey = normalizeEmailKey(person.email)
        const isSelected = Boolean(emailKey && selectedEmails.has(emailKey))
        const rawFlags = String(person.raw?.['Flags'] || '').trim()
        const isFlagged = rawFlags && rawFlags.toLowerCase() !== 'ok'

        return (
          <ApplicantCard
            key={emailKey || i}
            person={person}
            selected={isSelected}
            onToggleSelect={() => toggleSelected(person.email)}
            actionLabel="View"
            onAction={() => { }}
            isFlagged={!!isFlagged}
            variant={viewMode}
          />
        )
      })}
    </div>
  )

  return (
    <main className={styles.pageMain}>
      <div className={styles.pageContainer}>
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
              {selectedCount > 0 && <span>{selectedCount} selected</span>}
            </div>
          </div>

          <div className={styles.toolbarCenter}>{toolbarCenter}</div>

          <div className={styles.toolbarRight}>
            <button type="button" onClick={refresh} className={styles.refreshButton}>
              Refresh
            </button>
            {isLoading && <span>Loading…</span>}
            {error && <span style={{ color: '#b00020' }}>{error}</span>}
          </div>
        </div>

        {splitFlagged ? (
          <div className={styles.splitLayout}>
            <div className={styles.mainColumn}>
              <div className={styles.columnHeader}>
                <div className={styles.recentGroup}>
                  <h2 className={styles.columnTitle}>Recent</h2>
                  <div className={styles.viewToggle}>
                    <button
                      className={`${styles.toggleOption} ${viewMode === 'list' ? styles.activeToggle : ''}`}
                      onClick={() => setViewMode('list')}
                    >
                      List
                    </button>
                    <button
                      className={`${styles.toggleOption} ${viewMode === 'grid' ? styles.activeToggle : ''}`}
                      onClick={() => setViewMode('grid')}
                    >
                      Grid
                    </button>
                  </div>
                </div>
              </div>
              {renderCardList(mainList)}
            </div>
            <div className={styles.flaggedColumn}>
              <h3 className={styles.flaggedTitle}>▲ Red Flags</h3>
              {renderCardList(flaggedList)}
            </div>
          </div>
        ) : (
          renderCardList(filtered)
        )}
      </div>
    </main>
  )
}
function formatAppliedAt(appliedAt: string | undefined, raw: Record<string, string> | undefined) {
  if (appliedAt) {
    const d = new Date(appliedAt)
    return isNaN(d.getTime()) ? appliedAt : d.toLocaleString()
  }
  const rawTs = raw && (raw['Timestamp'] || raw['timestamp'])
  return rawTs ? String(rawTs) : ''
}
