'use client'

import { useEffect, useState } from 'react'
import styles from '../page.module.css'
import { promoteClearedToApproved } from '../components/clearedRecipients'

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
    const load = async () => {
      const data = JSON.parse(localStorage.getItem('people') || '[]') as Person[]
      try {
        const updated = await promoteClearedToApproved(data)
        setPeople(updated)
        if (updated !== data) {
          localStorage.setItem('people', JSON.stringify(updated))
        }
      } catch {
        setPeople(data)
      }
    }
    load()
  }, [])

  const movePerson = (email: string, newStatus: Person['status']) => {
    const updated = people.map(p =>
      p.email === email ? { ...p, status: newStatus } : p
    )

    setPeople(updated)
    localStorage.setItem('people', JSON.stringify(updated))
  }

  const filtered = people.filter(p => p.status === 'approved')

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Approved</h1>

        <div className={styles.cardGrid}>
          {filtered.map((person, i) => (
            <div className={styles.card} key={i}>
              <h3>{person.firstName} {person.lastName}</h3>
              <p><strong>Age:</strong> {person.age}</p>
              <p><strong>Email:</strong> {person.email}</p>
              <p><strong>Phone:</strong> {person.phone}</p>

              <button onClick={() => movePerson(person.email, 'new')}>
                Move to New
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
