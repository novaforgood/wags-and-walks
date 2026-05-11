'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function UpdatesPage() {
  const params = useParams()
  const email = decodeURIComponent(params.email as string)

  return (
    <main style={{ padding: '40px 24px', background: '#f3f7f7', minHeight: '100vh', maxWidth: 720, margin: '0 auto' }}>
      <Link href={`/applicants/${encodeURIComponent(email)}`} style={{ color: '#05aaaf', fontSize: 14, fontWeight: 600 }}>
        ← Back to applicant
      </Link>

      <h1 style={{ margin: '24px 0 12px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
        Updates
      </h1>
      <p style={{ margin: 0, fontSize: 15, color: '#64748b', lineHeight: 1.5 }}>
        There is no separate updates timeline stored for this applicant yet. Use the applicant record and notes for the latest
        information.
      </p>
    </main>
  )
}
