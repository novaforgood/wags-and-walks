'use client'

import { useEffect, useState } from 'react'
import styles from '../page.module.css'

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
    const person = people.find(p => p.email === email)

    const updated = people.map(p =>
      p.email === email ? { ...p, status: newStatus } : p
    )

    setPeople(updated)
    localStorage.setItem('people', JSON.stringify(updated))

    if (newStatus === 'current' && person) {
      const toSend = { ...person, status: newStatus }
      fetch('https://script.google.com/macros/s/AKfycbxbypLoDIBYX5OaKM--nmulOHA_RtoOSN_Di_W6jBkornRP3I1tHEwMnVERmxS1X-Lh/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSend),
      }).catch(err => console.error('Failed to append to sheet', err))
    }
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

              <button onClick={() => movePerson(person.email, 'current')}>
                Move to Current
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
