'use client'

import { useEffect, useState } from 'react'
import styles from '../page.module.css'
import Link from 'next/link'

type Person = {
  firstName: string
  lastName: string
  email: string
  phone: string
  age: string
  status: 'new' | 'in-progress' | 'approved' | 'current'
}

export default function ApprovedPage() {
  const [people, setPeople] = useState<Person[]>([])

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('people') || '[]')
    setPeople(data)
  }, [])

  const movePerson = (email: string, newStatus: Person['status']) => {
    const updated = people.map(p =>
      p.email === email ? { ...p, status: newStatus } : p
    )

    setPeople(updated)
    localStorage.setItem('people', JSON.stringify(updated))
  }

  const filtered = people.filter(p => p.status === 'current')

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Approved</h1>

        <div className={styles.cardGrid}>
          {filtered.map((person, i) => (
  <Link
    key={person.email}
    href={`/applicants/${encodeURIComponent(person.email)}`}
    style={{ textDecoration: 'none', color: 'inherit' }}
  >
    <div className={styles.card} style={{ cursor: 'pointer' }}>
      <h3>{person.firstName} {person.lastName}</h3>
      <p><strong>Age:</strong> {person.age}</p>
      <p><strong>Email:</strong> {person.email}</p>
      <p><strong>Phone:</strong> {person.phone}</p>
    </div>
  </Link>
))}
        </div>
      </div>
    </main>
  )
}
