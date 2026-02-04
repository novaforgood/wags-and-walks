'use client'

import { useEffect, useState } from 'react'
import styles from '../page.module.css'
import EmailModal from '../components/EmailModal'
import { promoteClearedToApproved } from '../components/clearedRecipients'

type Person = {
  firstName: string
  lastName: string
  email: string
  phone: string
  age: string
  status: 'new' | 'in-progress' | 'approved' | 'current'
}

export default function NewPage() {
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

  const filtered = people.filter(p => p.status === 'new')

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>New</h1>

        <div className={styles.cardGrid}>
          {filtered.map((person, i) => (
            <div className={styles.card} key={i}>
              <h3>{person.firstName} {person.lastName}</h3>
              <p><strong>Age:</strong> {person.age}</p>
              <p><strong>Email:</strong> {person.email}</p>
              <p><strong>Phone:</strong> {person.phone}</p>

              <button onClick={() => movePerson(person.email, 'approved')}>
                Move to Approved
              </button>
            </div>
          ))}
        </div>
        <p className={styles.description}>
          This is the New page content.
        </p>
        <EmailModal
          onApprovedEmails={(emails) => {
            const approvedSet = new Set(emails.map(e => e.trim().toLowerCase()))
            setPeople(prev =>
              prev.map(p => {
                const emailKey = String(p.email || '').trim().toLowerCase()
                if (emailKey && approvedSet.has(emailKey) && p.status === 'new') {
                  return { ...p, status: 'approved' }
                }
                return p
              })
            )
          }}
        />
      </div>
    </main>
  )
}
