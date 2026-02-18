'use client'

import { useMemo, useState } from 'react'
import styles from './page.module.css'
import { usePeople } from './components/PeopleProvider'
import type { Person } from './lib/peopleTypes'

const KNOWN_SPECIAL_NEEDS = [
  'Puppies',
  'Pregnant Dogs',
  'Sick Dogs',
  'Injured / Recovering Dogs',
  'Litters of Puppies Still Feeding From Mom',
  'Dogs that Need Training / Rehabilitation for Behavioral',
  'None of the Above'
]

const NONE_OF_THE_ABOVE = 'None of the Above'
// Expose the selectable set that ignores "None of the Above"
const SELECTABLE_SPECIAL_NEEDS = KNOWN_SPECIAL_NEEDS.filter(n => n !== NONE_OF_THE_ABOVE)

const availabilityRank = (text?: string) => {
  if (!text) return 99
  const t = text.toLowerCase()
  if (t.includes("ready")) return 0 // "I'm ready now!"
  if (t.includes("week")) return 1  // "Next week!"
  if (t.includes("month")) return 2 // "Next month!"
  // "I'm not sure..." and other unknowns go last
  return 3
}

export default function Home() {
  const { people, isLoading, error, refresh } = usePeople()
  const [sortOption, setSortOption] = useState<
    'none' | 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'availability-asc'
  >('none')

  // filter UI state
  const [showFilters, setShowFilters] = useState(true)
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([])

  // helper to toggle a special needs selection
  const toggleNeed = (need: string) => {
    setSelectedNeeds(prev => {
      // if already selected, remove it
      if (prev.includes(need)) return prev.filter(p => p !== need)

      // if selecting "None of the Above" clear other selections and keep only that
      if (need === NONE_OF_THE_ABOVE) return [NONE_OF_THE_ABOVE]

      // otherwise selecting a real need should remove "None of the Above" if present
      return [...prev.filter(p => p !== NONE_OF_THE_ABOVE), need]
    })
  }

  // derived list: apply filters first (AND semantics for multiple selections), then sorting
  const displayPeople = useMemo(() => {
    const filtered = people.filter(person => {
      if (!selectedNeeds || selectedNeeds.length === 0) return true

      const personNeeds = person.specialNeeds ?? []

      // If person selected 'None of the Above' treat them as having only that option.
      if (personNeeds.includes(NONE_OF_THE_ABOVE)) {
        // Only match when the user selected exactly 'None of the Above' (AND semantics)
        return selectedNeeds.length === 1 && selectedNeeds[0] === NONE_OF_THE_ABOVE
      }

      // Enforce AND: person must include every selected need
      return selectedNeeds.every(n => personNeeds.includes(n))
    })

    const copy = [...filtered]
    switch (sortOption) {
      case 'name-asc':
        return copy.sort((a, b) => {
          const na = `${a.firstName ?? ''} ${a.lastName ?? ''}`.toLowerCase()
          const nb = `${b.firstName ?? ''} ${b.lastName ?? ''}`.toLowerCase()
          return na.localeCompare(nb)
        })
      case 'name-desc':
        return copy.sort((a, b) => {
          const na = `${a.firstName ?? ''} ${a.lastName ?? ''}`.toLowerCase()
          const nb = `${b.firstName ?? ''} ${b.lastName ?? ''}`.toLowerCase()
          return nb.localeCompare(na)
        })
      case 'date-asc':
        // earliest first; missing timestamps go to the end
        return copy.sort((a, b) => {
          const da = a.appliedAt ? new Date(a.appliedAt).getTime() : Number.POSITIVE_INFINITY
          const db = b.appliedAt ? new Date(b.appliedAt).getTime() : Number.POSITIVE_INFINITY
          return da - db
        })
      case 'date-desc':
        // latest first; missing timestamps go to the end (use -Infinity so defined dates sort before missing)
        return copy.sort((a, b) => {
          const da = a.appliedAt ? new Date(a.appliedAt).getTime() : Number.NEGATIVE_INFINITY
          const db = b.appliedAt ? new Date(b.appliedAt).getTime() : Number.NEGATIVE_INFINITY
          return db - da
        })
      case 'availability-asc':
        // earliest availability first: ready now, next week, next month, unsure
        return copy.sort((a, b) => availabilityRank(a.availability) - availabilityRank(b.availability))
      case 'none':
      default:
        return copy
    }
  }, [people, sortOption, selectedNeeds])

  // UI helpers for filter box
  const toggleSelectAll = () => {
    // toggle: consider only selectable needs (ignore "None of the Above")
    const allSelectable = SELECTABLE_SPECIAL_NEEDS
    const allSelected = allSelectable.every(a => selectedNeeds.includes(a))

    if (allSelected) {
      // If "None of the Above" was selected earlier, preserve it, otherwise clear everything
      setSelectedNeeds(prev => prev.filter(n => n === NONE_OF_THE_ABOVE))
    } else {
      // Select all except "None of the Above"
      setSelectedNeeds([...allSelectable])
    }
  }

  const clearFilters = () => {
    setSelectedNeeds([])
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Welcome to Wags and Walks</h1>
        <p className={styles.description}>
          Navigate using the tabs above to view different pages.
        </p>

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

        {/* FILTER BOX */}
        <div
          style={{
            border: '1px solid #e6e6e6',
            padding: 16,
            marginBottom: 16,
            borderRadius: 8,
            background: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <strong style={{ cursor: 'pointer', fontSize: 16 }} onClick={() => setShowFilters(s => !s)}>
                Applicant Filters
              </strong>
              <span style={{ marginLeft: 4, color: '#000', fontSize: 13 }}>
                {selectedNeeds.length > 0 ? `(${selectedNeeds.length} selected)` : '(no filters applied)'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={toggleSelectAll}
                type="button"
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #ccc',
                  background: '#f7f7f7',
                  cursor: 'pointer'
                }}
              >
                {SELECTABLE_SPECIAL_NEEDS.every(a => selectedNeeds.includes(a)) ? 'Clear All' : 'Select all needs'}
              </button>
              <button
                onClick={clearFilters}
                type="button"
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #ccc',
                  background: '#fff',
                  cursor: 'pointer'
                }}
              >
                Clear filters
              </button>
            </div>
          </div>

          {showFilters && (
            <div style={{ marginTop: 14 }}>
              <div style={{ marginBottom: 10 }}>
                <em style={{ color: '#000' }}>
                  Filter applicants by which special needs they indicated they can foster.
                </em>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 8
                }}
              >
                {KNOWN_SPECIAL_NEEDS.map(need => (
                  <label
                    key={need}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: selectedNeeds.includes(need) ? '1px solid #0070f3' : '1px solid transparent',
                      background: selectedNeeds.includes(need) ? 'rgba(0,112,243,0.06)' : 'transparent'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedNeeds.includes(need)}
                      onChange={() => toggleNeed(need)}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ fontSize: 14 }}>{need}</span>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#000', fontSize: 14 }}>
                  <strong style={{ color: '#000' }}>{displayPeople.length}</strong>{' '}
                  {displayPeople.length === 1 ? 'applicant' : 'applicants'}
                </div>

                <div style={{ color: '#000', fontSize: 12 }}>
                  Selecting multiple options will show applicants who indicated all selected needs.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SORT */}
        <div style={{ margin: '1rem 0', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label>
            Sort:
            <select
              value={sortOption}
              onChange={e => setSortOption(e.target.value as any)}
              style={{ marginLeft: '0.5rem' }}
            >
              <option value="none">None</option>
              <option value="name-asc">Name A → Z</option>
              <option value="name-desc">Name Z → A</option>
              <option value="date-asc">Application date: Earliest → Latest</option>
              <option value="date-desc">Application date: Latest → Earliest</option>
              <option value="availability-asc">Availability: Earliest → Latest</option>
            </select>
          </label>
        </div>

        <div className={styles.cardGrid}>
          {displayPeople.map((person, i) => {
            // prefer parsed ISO -> formatted local string; fall back to raw timestamp strings if parsed missing
            const appliedDisplay =
              person.appliedAt
                ? new Date(person.appliedAt).toLocaleString()
                : person.raw && (person.raw['Timestamp'] || person.raw['timestamp'])
                ? (person.raw['Timestamp'] || person.raw['timestamp'])
                : undefined

            return (
              <div className={styles.card} key={i}>
                <h3>
                  {person.firstName ?? ''} {person.lastName ?? ''}
                </h3>

                {/* Primary fields */}
                <p><strong>Age:</strong> {person.age ?? '—'}</p>
                <p><strong>Email:</strong> {person.email ?? '—'}</p>
                <p><strong>Phone:</strong> {person.phone ?? '—'}</p>

                {/* Applied timestamp and availability */}
                {appliedDisplay && (
                  <p><strong>Applied:</strong> {appliedDisplay}</p>
                )}
                {person.availability && (
                  <p><strong>Availability:</strong> {person.availability}</p>
                )}

                {/* show parsed special needs summary (small) */}
                {person.specialNeeds && person.specialNeeds.length > 0 && (
                  <p style={{ marginTop: 6 }}><strong>Special needs:</strong> {person.specialNeeds.join(', ')}</p>
                )}

                {person.status && (
                  <p style={{ marginTop: 6 }}><strong>Status:</strong> {person.status}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
