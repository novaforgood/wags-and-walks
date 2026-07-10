'use client'

import { useCallback, useEffect, useMemo } from 'react'
import type { Person } from '@/app/lib/peopleTypes'
import { normalizeEmailKey } from '@/app/lib/peopleTypes'
import {
  APPLICATION_FORM_SECTIONS,
  applicationFieldDisplayValue,
} from '@/app/lib/applicantApplicationFields'
import { usePeople } from '@/app/components/PeopleProvider'
import { resolveStarred } from '@/app/lib/applicantOverrides'
import candStyles from '@/app/candidates/candidates.module.css'
import styles from './ApplicantSlideOver.module.css'

type Props = {
  person: Person | null
  onClose: () => void
}

function sectionDomId(sectionTitle: string): string {
  return `slideover-section-${sectionTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}

export default function ApplicantSlideOver({ person, onClose }: Props) {
  const { toggleStar, people, overrides } = usePeople()

  const livePerson = useMemo((): Person | null => {
    if (!person) return null
    if (!person.email?.trim()) return person
    const key = normalizeEmailKey(person.email)
    const fromList = people.find(p => normalizeEmailKey(p.email) === key)
    const base = fromList ?? person
    const starred = resolveStarred(person.email, overrides, base)
    return { ...base, starred }
  }, [people, person, overrides])

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

  const scrollToSection = useCallback((sectionTitle: string) => {
    const id = sectionDomId(sectionTitle)
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  if (!person || !livePerson) return null

  const fullName =
    `${livePerson.firstName ?? ''} ${livePerson.lastName ?? ''}`.trim() || 'Unknown'
  const email = livePerson.email?.trim() ?? ''
  const canStar = Boolean(email)

  const starTitle = !canStar
    ? 'Email required'
    : livePerson.starred
      ? 'Remove VIP'
      : 'Mark VIP'

  const starAriaLabel = livePerson.starred
    ? `Remove VIP mark for ${fullName}`
    : `Mark ${fullName} as VIP`

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
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <h2 id="slideover-name" className={styles.name}>
              {fullName}
            </h2>
            <div className={styles.contactRow}>
              {livePerson.email && (
                <span className={styles.contactItem}>{livePerson.email}</span>
              )}
              {livePerson.phone && (
                <span className={styles.contactItem}>{livePerson.phone}</span>
              )}
            </div>
          </div>
          <div className={styles.headerTools}>
            <span className={styles.starWrap}>
              <button
                type="button"
                className={`${candStyles.actionIconBtn} ${
                  livePerson.starred ? candStyles.actionIconStarActive : candStyles.actionIconStar
                }`}
                disabled={!canStar}
                onClick={() => {
                  if (canStar) toggleStar(email)
                }}
                title={starTitle}
                aria-label={starAriaLabel}
                aria-pressed={livePerson.starred}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className={candStyles.actionIconSvg}>
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    fill={livePerson.starred ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </span>
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
          </div>
        </header>

        <div className={styles.body}>
          <nav className={styles.sectionNav} aria-label="Application sections">
            {APPLICATION_FORM_SECTIONS.map((section) => (
              <button
                key={section.sectionTitle}
                type="button"
                className={styles.sectionNavBtn}
                onClick={() => scrollToSection(section.sectionTitle)}
              >
                {section.sectionTitle}
              </button>
            ))}
          </nav>

          <div className={styles.sections}>
            {APPLICATION_FORM_SECTIONS.map((section) => (
              <section
                key={section.sectionTitle}
                id={sectionDomId(section.sectionTitle)}
                className={styles.sectionCard}
                tabIndex={-1}
              >
                <h3 className={styles.sectionHeading}>{section.sectionTitle}</h3>
                <dl className={styles.kvList}>
                  {section.fields.map((field) => {
                    const value = applicationFieldDisplayValue(livePerson, field)
                    const empty = value.trim() === ''
                    const title = field.fullQuestionTitle ?? field.label
                    return (
                      <div key={[...field.rawKeys].join('|')} className={styles.kvRow}>
                        <dt className={styles.kvLabel} title={title}>
                          {field.label}
                        </dt>
                        <dd className={empty ? styles.kvValueEmpty : styles.kvValue}>
                          {empty ? 'No answer' : value}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              </section>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
