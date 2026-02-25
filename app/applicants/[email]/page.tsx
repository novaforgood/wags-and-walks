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
  <main style={{ padding: 40, background: '#f5f5f5', minHeight: '100vh' }}>
    <div style={{ display: 'flex', gap: 40 }}>

      {/* LEFT SIDE */}
      <div style={{ flex: 2, background: 'white', padding: 30, borderRadius: 12 }}>

        <button
          onClick={() => window.history.back()}
          style={{ marginBottom: 20 }}
        >
          ← Back
        </button>

        <h1 style={{ marginBottom: 10 }}>
          {person['First Name']} {person['Last Name']}
        </h1>

        {/* Large top placeholder section */}
        <div
  style={{
    background: '#ffffff',
    borderRadius: 8,
    padding: 20,
    marginBottom: 30
  }}
>
  <p><strong>City:</strong> {person['City']}</p>
  <p><strong>Living Arrangement:</strong> {person['What is your living arrangement?']}</p>
  <p><strong>Number of Pets at Home:</strong> {person['Please list ALL pets that you CURRENTLY own. Include: type (dog/cat) breed, age, gender, length of time in your care, etc.']}</p>
  <p><strong>Work Schedule:</strong> {person['What do you do for a living?']}</p>

</div>

        <h3>Dog Info (if adopting)</h3>

        <div style={{ display: 'flex', gap: 20, marginTop: 15 }}>
          
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
          <div style={{ flex: 1 }}>
            <p><strong>Email:</strong> {person.Email}</p>
            <p><strong>Age:</strong> {person['How old are you?']}</p>
            <p><strong>Phone:</strong> {person.Phone}</p>
            <p><strong>Status:</strong> {person['Applicant Status']}</p>
          </div>
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
            marginBottom: 10
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
            style={{ marginTop: 15 }}
            onClick={() =>
              window.location.href =
                `/applicants/${encodeURIComponent(person.Email)}/updates`
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
            padding: 8
          }}>
            Send Photos
          </button>

          <button style={{
            width: '100%',
            padding: 8
          }}>
            Send Follow-Up Email
          </button>
        </div>

      </div>
    </div>
  </main>
)
}
