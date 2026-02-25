'use client'

import { useParams } from 'next/navigation'

export default function UpdatesPage() {
  const params = useParams()
  const email = decodeURIComponent(params.email as string)

  return (
    <main style={{ padding: 40, background: '#f5f5f5', minHeight: '100vh' }}>
      <button
        onClick={() => window.history.back()}
        style={{ marginBottom: 20 }}
      >
        ← Back
      </button>

      <h1 style={{ marginBottom: 30 }}>
        Recent Updates - {email}
      </h1>

      {[1, 2, 3, 4].map((_, i) => (
        <div
          key={i}
          style={{
            background: 'white',
            padding: 20,
            borderRadius: 12,
            marginBottom: 15
          }}
        >
          <div>Update Title</div>
          <small>8 hrs ago</small>
        </div>
      ))}
    </main>
  )
}