'use client'

import { useEffect, useState } from 'react'

import type { Person, PersonStatus } from '@/app/lib/peopleTypes'
import {
  ALL_APPLICATION_FIELD_RAW_KEYS,
  APPLICATION_FORM_SECTIONS,
  applicationFieldDisplayValue,
} from '@/app/lib/applicantApplicationFields'
import NotificationPanel from './NotificationPanel'
import TopBarProfileMenu from './TopBarProfileMenu'
import layoutStyles from '@/app/candidates/candidates.module.css'
import NotesCard from './NotesCard'
import EmailComposeTrigger from './EmailComposeTrigger'
import FosterHistoryPanel from './FosterHistoryPanel'
import styles from './PersonModal.module.css'

interface Props {
  person: Person | null
  onClose: () => void
}

type ModalTab = 'summary' | 'application' | 'foster-history'

const TAB_IDS: Record<ModalTab, string> = {
  summary: 'person-modal-tab-summary',
  application: 'person-modal-tab-application',
  'foster-history': 'person-modal-tab-history',
}

const PANEL_IDS: Record<ModalTab, string> = {
  summary: 'person-modal-panel-summary',
  application: 'person-modal-panel-application',
  'foster-history': 'person-modal-panel-history',
}

const TABS: { id: ModalTab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'application', label: 'Application' },
  { id: 'foster-history', label: 'Foster history' },
]

function pipelineStatusLabel(status?: PersonStatus): string {
  if (!status || status === 'new') return 'New'
  if (status === 'in-progress') return 'In Progress'
  if (status === 'approved') return 'Approved'
  if (status === 'current') return 'Current foster'
  if (status === 'rejected') return 'Rejected'
  if (status.startsWith('rejected_')) return 'Rejected'
  return 'New'
}

// Fields that count as "real" application data (exclude meta fields)
const META_FIELDS = new Set([
  'Submitted On', 'Name', 'Email', 'Phone', 'Address', 'Source',
  'Flag: Under 21', 'Flag: No Pet Experience', 'Flags', 'Review Status',
  'Applicant Status', 'Status Updated At', 'Status Updated By',
  'Email Sent', 'Email Sent At', 'Starred', 'Notes', 'Notes Updated At',
  'rowIndex',
])

export default function PersonModal({ person, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<ModalTab>('summary')

  useEffect(() => {
    if (!person?.email) return
    setActiveTab('summary')
  }, [person?.email])

  if (!person) return null

  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
  const statusLabel = pipelineStatusLabel(person.status)

  function onTabListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const ids = TABS.map(t => t.id)
    const i = ids.indexOf(activeTab)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveTab(TABS[(i + 1) % TABS.length].id)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveTab(TABS[(i - 1 + TABS.length) % TABS.length].id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveTab(TABS[0].id)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveTab(TABS[TABS.length - 1].id)
    }
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h2 className={styles.personName}>{name}</h2>
          <div className={styles.statusDots}>
            <span className={styles.dot} style={{ background: '#aaa' }} aria-hidden />
            <span className={styles.statusLabel}>{statusLabel}</span>
          </div>
        </div>
        <div className={layoutStyles.topBarActions}>
          <NotificationPanel />
          <TopBarProfileMenu />
        </div>
      </div>

      <div className={styles.tabRow}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Member detail sections"
          onKeyDown={onTabListKeyDown}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              id={TAB_IDS[t.id]}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              aria-controls={PANEL_IDS[t.id]}
              tabIndex={activeTab === t.id ? 0 : -1}
              className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : styles.tabInactive}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close profile">
          ✕
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'summary' && (
          <div
            id={PANEL_IDS.summary}
            role="tabpanel"
            aria-labelledby={TAB_IDS.summary}
            className={styles.tabPanel}
          >
            <SummaryTab person={person} onOpenApplication={() => setActiveTab('application')} />
          </div>
        )}
        {activeTab === 'application' && (
          <div
            id={PANEL_IDS.application}
            role="tabpanel"
            aria-labelledby={TAB_IDS.application}
            className={styles.tabPanel}
          >
            <ApplicationTab person={person} />
          </div>
        )}
        {activeTab === 'foster-history' && (
          <div
            id={PANEL_IDS['foster-history']}
            role="tabpanel"
            aria-labelledby={TAB_IDS['foster-history']}
            className={styles.tabPanel}
          >
            <div className={styles.profileContent}>
              <FosterHistoryPanel email={person.email} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Application tab ----
function ApplicationTab({ person }: { person: Person }) {
  const raw = person.raw ?? {}

  const hasApplicationData =
    APPLICATION_FORM_SECTIONS.some(section =>
      section.fields.some(f => applicationFieldDisplayValue(person, f).trim() !== '')
    ) ||
    Object.entries(raw).some(
      ([k, v]) =>
        !META_FIELDS.has(k) &&
        !ALL_APPLICATION_FIELD_RAW_KEYS.has(k) &&
        v &&
        v.trim() !== ''
    )

  if (!hasApplicationData) {
    return (
      <div className={styles.profileContent}>
        <div className={styles.emptyApplication}>
          <p className={styles.emptyApplicationTitle}>No application on file</p>
          <p className={styles.emptyApplicationBody}>
            There is no foster application data for this email in the pipeline sheet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.profileContent}>
      {APPLICATION_FORM_SECTIONS.map(section => {
        return (
          <div key={section.sectionTitle} className={styles.section}>
            <h3 className={styles.sectionTitle}>{section.sectionTitle}</h3>
            <div className={styles.threeColGrid}>
              {section.fields.map(field => {
                const value = applicationFieldDisplayValue(person, field)
                const empty = value.trim() === ''
                const title = field.fullQuestionTitle ?? field.label
                return (
                  <div key={[...field.rawKeys].join('|')} className={styles.field}>
                    <div className={styles.fieldLabel} title={title}>
                      {field.label}
                    </div>
                    <div className={empty ? styles.fieldValueEmpty : styles.fieldValue}>
                      {empty ? '—' : value}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {(() => {
        const remaining = Object.entries(raw).filter(
          ([k, v]) =>
            !ALL_APPLICATION_FIELD_RAW_KEYS.has(k) &&
            !META_FIELDS.has(k) &&
            v &&
            v.trim() !== ''
        )
        if (remaining.length === 0) return null
        return (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Additional information</h3>
            <div className={styles.threeColGrid}>
              {remaining.map(([key, value]) => (
                <div key={key} className={styles.field}>
                  <div className={styles.fieldLabel}>{key}</div>
                  <div className={styles.fieldValue}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ---- Summary tab (contact + link to application + notes only; no duplicate form answers) ----
function SummaryTab({
  person,
  onOpenApplication,
}: {
  person: Person
  onOpenApplication: () => void
}) {
  const raw = person.raw ?? {}
  const hasApplicationData =
    APPLICATION_FORM_SECTIONS.some(section =>
      section.fields.some(f => applicationFieldDisplayValue(person, f).trim() !== '')
    ) ||
    Object.entries(raw).some(
      ([k, v]) =>
        !META_FIELDS.has(k) &&
        !ALL_APPLICATION_FIELD_RAW_KEYS.has(k) &&
        v &&
        v.trim() !== ''
    )

  return (
    <div className={styles.profileContent}>
      <section className={styles.section} aria-labelledby="summary-contact-heading">
        <div className={styles.sectionHeaderRow}>
          <h3 id="summary-contact-heading" className={styles.sectionTitle}>
            Contact
          </h3>
          {hasApplicationData && (
            <button type="button" className={styles.sectionHeaderAction} onClick={onOpenApplication}>
              Application
            </button>
          )}
        </div>
        <div className={styles.threeColGrid}>
          {person.email && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Email</div>
              <div className={styles.fieldValue}>
                <a href={`mailto:${person.email}`}>{person.email}</a>
              </div>
            </div>
          )}
          {person.phone && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Phone</div>
              <div className={styles.fieldValue}>{person.phone}</div>
            </div>
          )}
          {person.age && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Age</div>
              <div className={styles.fieldValue}>{person.age}</div>
            </div>
          )}
          {person.appliedAt && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Applied</div>
              <div className={styles.fieldValue}>
                {new Date(person.appliedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          )}
          {person.availability && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Availability</div>
              <div className={styles.fieldValue}>{person.availability}</div>
            </div>
          )}
          {person.specialNeeds && person.specialNeeds.length > 0 && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Special needs</div>
              <div className={styles.fieldValue}>{person.specialNeeds.join(', ')}</div>
            </div>
          )}
        </div>
      </section>

      <section className={styles.section} aria-label="Notes">
        <NotesCard email={person.email} />
      </section>

      {person.email && (
        <section className={styles.section} aria-labelledby="summary-email-heading">
          <h3 id="summary-email-heading" className={styles.sectionTitle}>
            Email
          </h3>
          <EmailComposeTrigger email={person.email} recipientName={person.firstName} />
        </section>
      )}
    </div>
  )
}
