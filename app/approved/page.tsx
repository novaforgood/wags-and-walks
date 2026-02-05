'use client'

import styles from '../page.module.css'
import { usePeople } from '../components/PeopleProvider'

export default function ApprovedPage() {
  const { people, isLoading, error, setStatus, refresh } = usePeople()
  const filtered = people.filter(p => (p.status || 'new') === 'approved')

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Approved</h1>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 10 }}>
          <button
            type="button"
            onClick={refresh}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d6d6d6',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            Refresh from Sheet
          </button>
          {isLoading && <span style={{ alignSelf: 'center' }}>Loading…</span>}
          {error && <span style={{ alignSelf: 'center', color: '#b00020' }}>{error}</span>}
        </div>

        <div className={styles.cardGrid}>
          {filtered.map((person, i) => (
            <div className={styles.card} key={i}>
              <h3>{person.firstName ?? ''} {person.lastName ?? ''}</h3>
              <p><strong>Age:</strong> {person.age ?? '—'}</p>
              <p><strong>Email:</strong> {person.email ?? '—'}</p>
              <p><strong>Phone:</strong> {person.phone ?? '—'}</p>

              <button
                onClick={() => person.email && setStatus(person.email, 'new')}
                disabled={!person.email}
              >
                Move to New
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
