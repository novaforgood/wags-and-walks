'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import { normalizeEmailKey } from '@/app/lib/peopleTypes'
import type { Person } from '@/app/lib/peopleTypes'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import PersonModal from '@/app/components/PersonModal'
import { DashboardShell } from '@/app/components/DashboardShell'
import layoutStyles from '@/app/candidates/candidates.module.css'

function normalizeFetchedPerson(raw: unknown): Person | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const email = typeof p.email === 'string' ? p.email : null
  if (!email?.trim()) return null
  return raw as Person
}

function ApplicantDetailInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawEmail = decodeURIComponent(params.email as string)
  const emailKey = normalizeEmailKey(rawEmail)

  const { people, isLoading: providerLoading } = usePeople()

  const contextPerson = people.find(p => normalizeEmailKey(p.email) === emailKey)

  const [fetchedPerson, setFetchedPerson] = useState<Person | null>(null)
  const [fetching, setFetching] = useState(false)
  const [hasStartedFetch, setHasStartedFetch] = useState(false)

  const person = contextPerson ?? fetchedPerson
  const waitingForProvider = !contextPerson && providerLoading && people.length === 0
  const isLoading = !person && (fetching || waitingForProvider)

  useEffect(() => {
    if (contextPerson) {
      setHasStartedFetch(true)
      return
    }
    if (providerLoading && people.length === 0) {
      return
    }
    setHasStartedFetch(true)
    setFetching(true)

    async function fetchData() {
      try {
        const res = await fetch('/api/people')
        const data = await res.json()
        const match = (data.people ?? []).find(
          (p: unknown) => normalizeEmailKey((p as Person).email) === emailKey
        )
        setFetchedPerson(normalizeFetchedPerson(match))
      } catch {
        setFetchedPerson(null)
      } finally {
        setFetching(false)
      }
    }

    void fetchData()
  }, [emailKey, contextPerson, providerLoading, people.length])

  const from = searchParams.get('from')
  function handleClose() {
    if (from === 'overview') router.push('/overview')
    else if (from === 'current') router.push('/current')
    else router.push('/candidates')
  }

  return (
    <DashboardShell>
      {isLoading && (
        <div className={layoutStyles.loadingContainer}>Loading applicant…</div>
      )}
      {!isLoading && !person && hasStartedFetch && (
        <div className={layoutStyles.mainContent} style={{ padding: 40 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Applicant not found</h1>
          <p style={{ color: '#666', marginBottom: 20 }}>
            No application for {rawEmail}.
          </p>
          <button
            type="button"
            onClick={() => router.push('/candidates')}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid #c4c4c4',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Back to Applicants
          </button>
        </div>
      )}
      {person && <PersonModal person={person} onClose={handleClose} />}
    </DashboardShell>
  )
}

export default function ApplicantDetailPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <DashboardShell>
            <div className={layoutStyles.loadingContainer}>Loading…</div>
          </DashboardShell>
        }
      >
        <ApplicantDetailInner />
      </Suspense>
    </ProtectedRoute>
  )
}
