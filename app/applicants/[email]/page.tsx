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
    <main style={{ padding: 40, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 40 }}>

        {/* LEFT SIDE */}
        <div style={{ flex: 2, background: 'white', padding: 30, borderRadius: 12 }}>

          <button
            onClick={() => window.history.back()}
            style={{ marginBottom: 20, cursor: 'pointer', background: 'transparent', border: 'none', color: '#0070f3', fontSize: 16 }}
          >
            ← Back
          </button>

          <h1 style={{ marginBottom: 10 }}>
            {firstName} {lastName}
          </h1>

          {/* Large top placeholder section */}
          <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 20, marginBottom: 30 }}>
            <p><strong>City:</strong> {getVal('City') || '—'}</p>
            <p><strong>Living Arrangement:</strong> {getVal('What is your living arrangement?') || '—'}</p>
            <p><strong>Number of Pets at Home:</strong> {getVal('Please list ALL pets that you CURRENTLY own. Include: type (dog/cat) breed, age, gender, length of time in your care, etc.') || '—'}</p>
            <p><strong>Work Schedule:</strong> {getVal('What do you do for a living?') || '—'}</p>
          </div>

          <h3>Overview</h3>

          <div style={{ display: 'flex', gap: 20, marginTop: 15, marginBottom: 30 }}>

            {/* Image Placeholder */}
            <div
              style={{
                width: 220,
                height: 220,
                background: '#ccc',
                borderRadius: 8
              }}
            />

            {/* Applicant Info */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p><strong>Email:</strong> {email}</p>
              <p><strong>Age:</strong> {age}</p>
              <p><strong>Phone:</strong> {phone}</p>
              <p><strong>Status:</strong> {person.status || getVal('Applicant Status') || '—'}</p>
            </div>
          </div>

          <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #eee' }} />

          <h3>All Application Data</h3>
          <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
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
        </div>

        {/* RIGHT SIDE */}
        <div style={{ flex: 1 }}>

          {/* Recent Updates */}
          <div style={{
            background: 'white',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20
          }}>
            <h3>Recent Updates</h3>

            <div style={{
              background: '#f0f0f0',
              padding: 15,
              borderRadius: 8,
              marginBottom: 10,
              marginTop: 15
            }}>
              <div>Photos Uploaded</div>
              <small>8 hrs ago</small>
            </div>

            <div style={{
              background: '#f0f0f0',
              padding: 15,
              borderRadius: 8
            }}>
              <div>Follow-up Email Sent</div>
              <small>1 day ago</small>
            </div>

            <button
              style={{ marginTop: 15, width: '100%', padding: '8px', cursor: 'pointer' }}
              onClick={() =>
                window.location.href =
                `/applicants/${encodeURIComponent(email)}/updates`
              }
            >
              View All
            </button>
          </div>

          {/* Pending Actions */}
          <div style={{
            background: 'white',
            padding: 20,
            borderRadius: 12
          }}>
            <h3>Pending Actions</h3>

            <button style={{
              width: '100%',
              marginBottom: 10,
              padding: 8,
              marginTop: 15,
              cursor: 'pointer'
            }}>
              Send Photos
            </button>

            <button style={{
              width: '100%',
              padding: 8,
              cursor: 'pointer'
            }}>
              Send Follow-Up Email
            </button>
          </div>

        </div>
      </div>
    </main>
  )
}
