'use client'

import { useEffect, useState } from 'react'
import type { FostererHistory, FosterDog } from '@/app/lib/asmFosterHistory'
import {
  fosterFailOutcomeLabel,
  fosterHistoryHasFosterFail,
} from '@/app/lib/fosterOutcome'
import { authFetch } from '@/app/lib/authFetch'
import tableStyles from '../candidates/candidates.module.css'
import styles from './FosterHistoryPanel.module.css'

interface Props {
  email: string | null | undefined
  initialData?: FostererHistory | null
  sectionClassName?: string
  sectionTitleClassName?: string
}

export default function FosterHistoryPanel({ email, initialData, sectionClassName, sectionTitleClassName }: Props) {
  const hasInitialData = initialData !== undefined
  const [fetchedData, setFetchedData] = useState<FostererHistory | null>(null)
  const [loading, setLoading] = useState(() => Boolean(email) && !hasInitialData)
  const [error, setError] = useState<string | null>(null)
  const data = hasInitialData ? initialData : fetchedData

  useEffect(() => {
    if (hasInitialData) {
      return
    }

    if (!email) {
      queueMicrotask(() => {
        setFetchedData(null)
        setLoading(false)
      })
      return
    }
    let active = true
    queueMicrotask(() => {
      if (active) {
        setFetchedData(null)
        setLoading(true)
        setError(null)
      }
    })

    authFetch(`/api/foster-history?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(json => {
        if (!active) return
        if (json?.success) {
          setFetchedData(json.fosterer)
        } else {
          setError(json?.error ?? 'Failed to load foster history')
        }
      })
      .catch(() => { if (active) setError('Failed to load foster history') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [email, hasInitialData])

  const sc = sectionClassName ?? defaultSectionStyle
  const stc = sectionTitleClassName ?? undefined

  if (loading) {
    return (
      <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
        <SectionTitle className={stc}>Foster History</SectionTitle>
        <p className={styles.emptyText}>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
        <SectionTitle className={stc}>Foster History</SectionTitle>
        <p className={styles.errorText}>{error}</p>
      </div>
    )
  }

  if (!data || (data.currentFosters.length === 0 && data.pastFosters.length === 0)) {
    return (
      <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
        <SectionTitle className={stc}>Foster History</SectionTitle>
        <p className={styles.emptyText}>No foster history on record.</p>
      </div>
    )
  }

  const showFosterFailSummary = fosterHistoryHasFosterFail([
    ...data.currentFosters,
    ...data.pastFosters,
  ])

  return (
    <>
      {showFosterFailSummary && (
        <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
          <p className={styles.fosterFailSummary}>
            This fosterer adopted at least one foster dog (a foster fail). Matching
            placements are noted in the table below.
          </p>
        </div>
      )}
      {data.currentFosters.length > 0 && (
        <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
          <SectionTitle className={stc}>Currently Fostering</SectionTitle>
          <DogTable dogs={data.currentFosters} showEndDate={false} />
        </div>
      )}
      <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
        <SectionTitle className={stc}>Past Fosters</SectionTitle>
        {data.pastFosters.length === 0 ? (
          <p className={styles.emptyText}>No past fosters on record.</p>
        ) : (
          <DogTable dogs={data.pastFosters} showEndDate />
        )}
      </div>
    </>
  )
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  if (className) return <div className={className}>{children}</div>
  return <div style={titleStyle}>{children}</div>
}

function DogTable({ dogs, showEndDate }: { dogs: FosterDog[]; showEndDate: boolean }) {
  const showOutcome = dogs.some(d => d.fosterFailOutcome)
  return (
    <div className={tableStyles.tableEmbedScroll}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Breed</th>
            <th scope="col">Sex</th>
            <th scope="col">Start date</th>
            {showEndDate && <th scope="col">End date</th>}
            {showOutcome && <th scope="col">Outcome</th>}
          </tr>
        </thead>
        <tbody>
          {dogs.map((dog, i) => (
            <tr key={`${dog.animalId}-${dog.fosterStartDate}-${i}`}>
              <td>{dog.name ?? '—'}</td>
              <td>{dog.breed ?? '—'}</td>
              <td>{dog.sex ?? '—'}</td>
              <td>{fmtDate(dog.fosterStartDate)}</td>
              {showEndDate && <td>{fmtDate(dog.fosterEndDate)}</td>}
              {showOutcome && (
                <td>
                  {dog.fosterFailOutcome ? (
                    <span className={styles.outcomeNote}>
                      {fosterFailOutcomeLabel(dog.fosterFailOutcome, showEndDate)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function fmtDate(val?: string | null): string {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Fallback inline styles when no CSS class is provided (used in PersonModal context)
const defaultSectionStyle = ''
const defaultSectionObj: React.CSSProperties = {
  background: '#fbfbfb',
  border: '1px solid #d9e7e7',
  borderRadius: 12,
  padding: '20px 22px 22px',
  boxShadow: '0 2px 8px rgba(10,40,40,0.04)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: '#3b4b4b',
  borderBottom: '1px solid #e5eeee',
  paddingBottom: 10,
}
