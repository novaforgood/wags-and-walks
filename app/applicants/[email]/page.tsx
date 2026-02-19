'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import { normalizeEmailKey } from '@/app/lib/peopleTypes'

export default function ApplicantDetail() {
  const params = useParams()
  const rawEmail = decodeURIComponent(params.email as string)
  const emailKey = normalizeEmailKey(rawEmail)

  const { people } = usePeople()

  // Try to find the person in the loaded context first
  const contextPerson = people.find(p => normalizeEmailKey(p.email) === emailKey)

  const [fetchedPerson, setFetchedPerson] = useState<any>(null)
  const [fetching, setFetching] = useState(false)
  const [hasStartedFetch, setHasStartedFetch] = useState(false)

  // Determine what to display: context person (fast) > fetched person (fallback)
  const person = contextPerson || fetchedPerson

  // We are loading if:
  // 1. We don't have a person yet AND
  // 2. We are either fetching ourselves OR the provider is still loading and hasn't given us data yet
  // If provider is loading, we should wait for it before giving up and fetching ourselves
  const { isLoading: providerLoading } = usePeople()
  const waitingForProvider = !contextPerson && providerLoading && people.length === 0

  const isLoading = !person && (fetching || waitingForProvider)

  useEffect(() => {
    // If we already have the person from context, no need to fetch
    if (contextPerson) {
      setHasStartedFetch(true)
      return
    }

    // If provider is still loading (and has no data), let's wait for it.
    // It might yield the person from cache or network momentarily.
    if (providerLoading && people.length === 0) {
      return
    }

    // Provider is done (or has data), and we still didn't find them.
    // Now we fetch.
    setHasStartedFetch(true)
    setFetching(true)

    async function fetchData() {
      try {
        console.log('Fetching details for:', emailKey)
        const res = await fetch(
          'https://script.google.com/macros/s/AKfycbzU2k4tlSAGwxz6G2zqx_seW0-ZQWZLbMsnzfP5MBdYXDoe49JlcRuuu5KtPuqrL-3E/exec'
        )
        const data = await res.json()

        const match = data.rows.find(
          (row: any) =>
            row.Email &&
            normalizeEmailKey(row.Email) === emailKey
        )

        setFetchedPerson(match || null)
      } catch (err) {
        console.error('Fetch error:', err)
      } finally {
        setFetching(false)
      }
    }

    fetchData()
  }, [emailKey, contextPerson, providerLoading, people.length])

  if (isLoading) return <p style={{ padding: 40, textAlign: 'center', color: '#666' }}>Loading details...</p>

  if (!person && !fetching && hasStartedFetch) {
    return (
      <main style={{ padding: 40, textAlign: 'center' }}>
        <h2>Applicant not found</h2>
        <p>Could not find an application for {rawEmail}</p>
      </main>
    )
  }

  // Helper to safely access properties whether from Person object or raw fetch
  const getVal = (key: string, altKey?: string) => {
    if ('raw' in person && person.raw) {
      return person.raw[key] || person.raw[altKey || '']
    }
    return person[key] || person[altKey || '']
  }

  const firstName = person.firstName || getVal('First Name')
  const lastName = person.lastName || getVal('Last Name')
  const email = person.email || getVal('Email')
  const age = person.age || getVal('How old are you?')
  const phone = person.phone || getVal('Phone')

  return (
    <main style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
      <h1>
        {firstName} {lastName}
      </h1>

      <div style={{ display: 'grid', gap: 8, margin: '20px 0' }}>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Age:</strong> {age}</p>
        <p><strong>Phone:</strong> {phone}</p>
      </div>

      <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <h2>Full Application</h2>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Render all raw fields if available, or just the object keys if raw fetch */}
        {person.raw ? (
          Object.entries(person.raw).map(([key, value]) => {
            if (key === 'rowIndex') return null
            return (
              <div key={key}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{key}</div>
                <div style={{ fontSize: 15 }}>{String(value)}</div>
              </div>
            )
          })
        ) : (
          Object.entries(person).map(([key, value]) => {
            if (key === 'rowIndex' || key === 'loading') return null
            return (
              <div key={key}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{key}</div>
                <div style={{ fontSize: 15 }}>{String(value)}</div>
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
