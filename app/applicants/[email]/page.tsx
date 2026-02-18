'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function ApplicantDetail() {
  const params = useParams()
  const email = decodeURIComponent(params.email as string)

  const [person, setPerson] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(
          'https://script.google.com/macros/s/AKfycbzU2k4tlSAGwxz6G2zqx_seW0-ZQWZLbMsnzfP5MBdYXDoe49JlcRuuu5KtPuqrL-3E/exec' // same URL as your doGet
        )
        const data = await res.json()

        const match = data.rows.find(
          (row: any) =>
            row.Email &&
            row.Email.toLowerCase() === email.toLowerCase()
        )

        setPerson(match || null)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [email])

  if (loading) return <p>Loading...</p>
  if (!person) return <p>Applicant not found.</p>

  return (
    <main style={{ padding: 40 }}>
      <h1>
        {person['First Name']} {person['Last Name']}
      </h1>

      <p><strong>Email:</strong> {person.Email}</p>
      <p><strong>Age:</strong> {person['How old are you?']}</p>
      <p><strong>Phone:</strong> {person.Phone}</p>

      <hr style={{ margin: '20px 0' }} />

      <h2>Full Application</h2>

      {Object.entries(person).map(([key, value]) => {
        if (key === 'rowIndex') return null

        return (
          <div key={key} style={{ marginBottom: 12 }}>
            <strong>{key}</strong>
            <div>{String(value)}</div>
          </div>
        )
      })}
    </main>
  )
}
