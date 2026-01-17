'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import Papa from 'papaparse'

type Person = {
  firstName: string
  lastName: string
  email: string
  phone: string
  age: string
}

export default function Home() {
  const [people, setPeople] = useState<Person[]>([])

  useEffect(() => {
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSn3Y4D4iYl7m8-ngX53udfHy-dwlv7TF9EsJsl960jG98hnk2FRXy6wtClk0abbWlZz6AL49eR4ULa/pub?output=csv')
      .then(res => res.text())
      .then(csv => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = (results.data as any[]).map(row => ({
              firstName: row['First Name'],
              lastName: row['Last Name'],
              email: row['Email'],
              phone: row['Phone'],
              age: row['How old are you?'],
            }))

            setPeople(data)
          },
        })
      })
  }, [])

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Welcome to Wags and Walks</h1>
        <p className={styles.description}>
          Navigate using the tabs above to view different pages.
        </p>

        <div className={styles.cardGrid}>
          {people.map((person, i) => (
            <div className={styles.card} key={i}>
              <h3>
                {person.firstName} {person.lastName}
              </h3>
              <p><strong>Age:</strong> {person.age}</p>
              <p><strong>Email:</strong> {person.email}</p>
              <p><strong>Phone:</strong> {person.phone}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
