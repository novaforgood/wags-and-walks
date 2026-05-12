'use client'

import { useEffect } from 'react'
import type { Person } from '@/app/lib/peopleTypes'
import type { TriageOutcome } from '@/app/lib/applicantTriage'
import styles from './ApplicantSlideOver.module.css'

/** Sections in the slide-over. Mirrors PersonModal's application sections so volunteers see
 *  the same canonical answers, but presented as a single scroll (no tabs) for triage speed. */
const APPLICATION_SECTIONS: { title: string; fields: string[] }[] = [
  {
    title: 'Personal',
    fields: [
      'How old are you',
      'What do you do for a living',
      'Address',
    ],
  },
  {
    title: 'Household',
    fields: [
      'What is your living arrangement',
      'How many children are in your home',
      'How old are they Check all that apply',
      'Other than yourself how many additional adults do you share your home with',
    ],
  },
  {
    title: 'Pet Experience',
    fields: [
      'Have you ever owned a pet before',
      'What kind of pets have you owned check all that apply',
      'Do you currently have any pets at home',
      'Please list ALL pets that you CURRENTLY own Include type dogcat breed age gender length of time in your care etc',
      'Are your current pets spayedneutered',
    ],
  },
  {
    title: 'Foster Preferences',
    fields: [
      'How would you rate your experience with dogs',
      'Where will your foster dog be when you are not home',
      'Where will your foster dog sleep during the night',
      'When would you like to take your foster dog home',
      'Please share your preferences in terms of size breed energy level etc Fosters for large dogs 45 lbs are always our biggest need Please note that you do not need a house or yard to foster a large dog Many bigger dogs are just fine in apartments and our team will pair you with a dog that will be a great match',
      'Are you willing to foster dogs with special needs If so please check all that apply below',
      'Are you willing to foster dogs with medical needs',
      'Are you willing to foster pregnant mamas andor mamas and their litters',
      'Are you willing to foster dogs that need training upkeepbehavior rehabilitation',
    ],
  },
  {
    title: 'How They Found Us',
    fields: [
      'How did you hear about us',
      'If someone referred you please list their name here so we may thank them',
    ],
  },
]

type Props = {
  person: Person | null
  /** Local-only mark (volunteer's own tag — does not affect the pipeline). */
  mark?: TriageOutcome
  onClose: () => void
  /** Set or toggle a mark. Passing the current mark again clears it. */
  onSetMark: (outcome: TriageOutcome) => void
  onClearMark: () => void
}

export default function ApplicantSlideOver({
  person,
  mark,
  onClose,
  onSetMark,
  onClearMark,
}: Props) {
  useEffect(() => {
    if (!person) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [person, onClose])

  if (!person) return null

  const fullName = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
  const raw = person.raw ?? {}

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-name"
      >
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.headerTitleRow}>
              <h2 id="slideover-name" className={styles.name}>{fullName}</h2>
              {mark === 'approved' && (
                <span className={styles.triageBadgeApproved}>Marked Approved</span>
              )}
              {mark === 'rejected' && (
                <span className={styles.triageBadgeRejected}>Marked Rejected</span>
              )}
            </div>
            <div className={styles.contactRow}>
              {person.email && <span className={styles.contactItem}>{person.email}</span>}
              {person.phone && <span className={styles.contactItem}>{person.phone}</span>}
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* Scrolling body */}
        <div className={styles.body}>
          {APPLICATION_SECTIONS.map((section) => {
            const rows = section.fields
              .map((field) => ({ label: field, value: raw[field] ?? '' }))
              .filter((r) => r.value.trim() !== '')
            if (rows.length === 0) return null
            return (
              <section key={section.title} className={styles.section}>
                <h3 className={styles.sectionTitle}>{section.title}</h3>
                <dl className={styles.kvList}>
                  {rows.map(({ label, value }) => (
                    <div key={label} className={styles.kvRow}>
                      <dt className={styles.kvLabel}>{label}</dt>
                      <dd className={styles.kvValue}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )
          })}
        </div>

        {/* Sticky footer — local-only mark; doesn't affect the pipeline */}
        <footer className={styles.footer}>
          <div className={styles.footerHint}>
            Add a personal tag <span className={styles.footerHintMuted}>· local to this browser</span>
          </div>
          <div className={styles.footerTriage}>
            {mark && (
              <button
                type="button"
                className={styles.btnNeutral}
                onClick={onClearMark}
              >
                Unmark
              </button>
            )}
            <button
              type="button"
              className={`${styles.btnTriage} ${mark === 'approved' ? styles.btnTriageApprovedActive : ''}`}
              onClick={() => (mark === 'approved' ? onClearMark() : onSetMark('approved'))}
              aria-pressed={mark === 'approved'}
            >
              {mark === 'approved' ? '✓ Approved' : 'Mark Approved'}
            </button>
            <button
              type="button"
              className={`${styles.btnTriage} ${mark === 'rejected' ? styles.btnTriageRejectedActive : ''}`}
              onClick={() => (mark === 'rejected' ? onClearMark() : onSetMark('rejected'))}
              aria-pressed={mark === 'rejected'}
            >
              {mark === 'rejected' ? '✕ Rejected' : 'Mark Rejected'}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
