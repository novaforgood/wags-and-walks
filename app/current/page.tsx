'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import type { Person } from '@/app/lib/peopleTypes'
import styles from '../page.module.css'

function displayName(p: Person): string {
  const n = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
  return n || p.email || 'Unknown'
}

export default function CurrentPage() {
  const { people, isLoading } = usePeople()

  const currentFosters = useMemo(() => {
    return people
      .filter(p => p.email?.trim() && String(p.status || '').toLowerCase() === 'current')
      .sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' }))
  }, [people])

  return (
    <ProtectedRoute>
      <main className={styles.main} style={{ justifyContent: 'flex-start', paddingTop: '3rem' }}>
        <div className={styles.container} style={{ textAlign: 'left' }}>
          <h1 className={styles.title} style={{ marginBottom: '0.75rem' }}>
            Current fosters
          </h1>
          <p className={styles.description} style={{ marginBottom: '2rem', textAlign: 'left' }}>
            Applicants marked <strong>current</strong> in the pipeline spreadsheet ({currentFosters.length}).
          </p>

          {isLoading && people.length === 0 ? (
            <p className={styles.description}>Loading…</p>
          ) : currentFosters.length === 0 ? (
            <p className={styles.description}>No one is listed as current yet. Update status from the Applicants tab.</p>
          ) : (
            <div className={styles.cardGrid}>
              {currentFosters.map(p => {
                const email = p.email!.trim()
                return (
                  <article key={email} className={styles.card}>
                    <h3>{displayName(p)}</h3>
                    <p style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>{email}</p>
                    <Link
                      href={`/applicants/${encodeURIComponent(email)}?from=current`}
                      style={{ color: '#05aaaf', fontWeight: 600, fontSize: 14 }}
                    >
                      View applicant →
                    </Link>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  )
}
