'use client'

import { useEffect, useState } from 'react'
import type { FostererHistory, FosterDog } from '@/app/lib/asmFosterHistory'

interface Props {
  email: string | null | undefined
  sectionClassName?: string
  sectionTitleClassName?: string
}

export default function FosterHistoryPanel({ email, sectionClassName, sectionTitleClassName }: Props) {
  const [data, setData] = useState<FostererHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!email) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)

    fetch(`/api/foster-history?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(json => {
        if (!active) return
        if (json?.success) {
          setData(json.fosterer)
        } else {
          setError(json?.error ?? 'Failed to load foster history')
        }
      })
      .catch(() => { if (active) setError('Failed to load foster history') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [email])

  const sc = sectionClassName ?? defaultSectionStyle
  const stc = sectionTitleClassName ?? undefined

  if (loading) {
    return (
      <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
        <SectionTitle className={stc}>Foster History</SectionTitle>
        <p style={{ color: '#888', margin: 0, fontSize: 14 }}>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
        <SectionTitle className={stc}>Foster History</SectionTitle>
        <p style={{ color: '#c00', margin: 0, fontSize: 14 }}>{error}</p>
      </div>
    )
  }

  if (!data || (data.currentFosters.length === 0 && data.pastFosters.length === 0)) {
    return (
      <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
        <SectionTitle className={stc}>Foster History</SectionTitle>
        <p style={{ color: '#888', margin: 0, fontSize: 14 }}>No foster history on record.</p>
      </div>
    )
  }

  return (
    <>
      {data.currentFosters.length > 0 && (
        <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
          <SectionTitle className={stc}>Currently Fostering</SectionTitle>
          <DogTable dogs={data.currentFosters} showEndDate={false} />
        </div>
      )}
      <div className={sc} style={!sectionClassName ? defaultSectionObj : undefined}>
        <SectionTitle className={stc}>Past Fosters</SectionTitle>
        {data.pastFosters.length === 0 ? (
          <p style={{ color: '#888', margin: 0, fontSize: 14 }}>No past fosters on record.</p>
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
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr>
          <Th>Name</Th>
          <Th>Breed</Th>
          <Th>Sex</Th>
          <Th>Start date</Th>
          {showEndDate && <Th>End date</Th>}
        </tr>
      </thead>
      <tbody>
        {dogs.map(dog => (
          <tr key={`${dog.animalId}-${dog.fosterStartDate}`} style={{ borderBottom: '1px solid #f0f4f4' }}>
            <Td>{dog.name ?? '—'}</Td>
            <Td>{dog.breed ?? '—'}</Td>
            <Td>{dog.sex ?? '—'}</Td>
            <Td>{fmtDate(dog.fosterStartDate)}</Td>
            {showEndDate && <Td>{fmtDate(dog.fosterEndDate)}</Td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#3b4b4b', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e5eeee' }}>
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '8px 8px', color: '#222' }}>{children}</td>
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
