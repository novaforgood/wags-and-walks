'use client'

import { useState } from 'react'

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
import FosterHistoryPanel from './FosterHistoryPanel'
import styles from './PersonModal.module.css'

interface Props {
    person: Person | null
    onClose: () => void
}

type ModalTab = 'profile' | 'application' | 'foster-history'

const SHOWN_RAW_KEYS = new Set([
    'First Name', 'Last Name', 'Email', 'Phone', 'How old are you?',
    'Timestamp', 'Applicant Status', 'Flags', 'Review Status',
    'When would you like to take your foster dog home?',
    'Are there any dogs with special needs that you would be comfortable fostering?'
])

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
    'rowIndex'
])

export default function PersonModal({ person, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<ModalTab>('profile')

    if (!person) return null

    const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
    const statusLabel = pipelineStatusLabel(person.status)

    const otherEntries = Object.entries(person.raw ?? {}).filter(
        ([key, value]) => !SHOWN_RAW_KEYS.has(key) && value && value.trim() !== ''
    )

    return (
        <div className={styles.overlay}>
            <div className={styles.topBar}>
                <div className={styles.topBarLeft}>
                    <h2 className={styles.personName}>{name}</h2>
                    <div className={styles.statusDots}>
                        <span className={styles.dot} style={{ background: '#aaa' }} />
                        <span className={styles.statusLabel}>{statusLabel}</span>
                    </div>
                </div>
                <div className={layoutStyles.topBarActions}>
                    <NotificationPanel />
                    <TopBarProfileMenu />
                </div>
            </div>

            <div className={styles.tabRow}>
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'profile' ? styles.tabActive : styles.tabInactive}`}
                        type="button"
                        onClick={() => setActiveTab('profile')}
                    >
                        Profile
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'application' ? styles.tabActive : styles.tabInactive}`}
                        type="button"
                        onClick={() => setActiveTab('application')}
                    >
                        Application
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'foster-history' ? styles.tabActive : styles.tabInactive}`}
                        type="button"
                        onClick={() => setActiveTab('foster-history')}
                    >
                        Foster History
                    </button>
                </div>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className={styles.content}>
                {activeTab === 'profile' && (
                    <ProfileTab person={person} otherEntries={otherEntries} />
                )}
                {activeTab === 'application' && (
                    <ApplicationTab person={person} />
                )}
                {activeTab === 'foster-history' && (
                    <div className={styles.profileContent}>
                        <FosterHistoryPanel email={person.email} />
                    </div>
                )}
            </div>
        </div>
    )
}

// ---- Application tab ----
function ApplicationTab({ person }: { person: Person }) {
    const raw = person.raw ?? {}

    // Check if this person has any real application data
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
                <div className={styles.section} style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: '#555', marginBottom: 8 }}>
                        No Application on File
                    </div>
                    <div style={{ fontSize: 14 }}>
                        This applicant has not filled out the required application information.
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.profileContent}>
            {APPLICATION_FORM_SECTIONS.map(section => {
                return (
                    <div key={section.sectionTitle} className={styles.section}>
                        <div className={styles.sectionTitle}>{section.sectionTitle}</div>
                        <div className={styles.threeColGrid}>
                            {section.fields.map(field => {
                                const value = applicationFieldDisplayValue(person, field)
                                const empty = value.trim() === ''
                                const title = field.fullQuestionTitle ?? field.label
                                return (
                                    <div key={[...field.rawKeys].join('|')} className={styles.field}>
                                        <div className={styles.fieldLabel} title={title}>{field.label}</div>
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
                        <div className={styles.sectionTitle}>Additional Information</div>
                        <div className={styles.threeColGrid}>
                            {remaining.map(([key, value]) => (
                                <div key={key} className={styles.field}>
                                    <div className={styles.fieldLabel}>{key}:</div>
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

// ---- Profile tab ----
function ProfileTab({ person, otherEntries }: { person: Person; otherEntries: [string, string][] }) {
    return (
        <div className={styles.profileContent}>
            <Section title="Personal information">
                <ThreeColGrid>
                    {person.email && <Field label="Email" value={person.email} />}
                    {person.phone && <Field label="Phone number" value={person.phone} />}
                    {person.age && <Field label="Age" value={person.age} />}
                    {person.appliedAt && (
                        <Field
                            label="Applied"
                            value={new Date(person.appliedAt).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'short', day: 'numeric'
                            })}
                        />
                    )}
                    {person.availability && <Field label="Availability" value={person.availability} />}
                    {person.specialNeeds && person.specialNeeds.length > 0 && (
                        <Field label="Special needs" value={person.specialNeeds.join(', ')} />
                    )}
                </ThreeColGrid>
            </Section>

            {otherEntries.length > 0 && (
                <Section title="Application answers">
                    <ThreeColGrid>
                        {otherEntries.map(([key, value]) => (
                            <Field key={key} label={key} value={value} />
                        ))}
                    </ThreeColGrid>
                </Section>
            )}

            <div className={styles.section}>
                <NotesCard email={person.email} name={person.firstName} />
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className={styles.section}>
            <div className={styles.sectionTitle}>{title}</div>
            {children}
        </div>
    )
}

function ThreeColGrid({ children }: { children: React.ReactNode }) {
    return <div className={styles.threeColGrid}>{children}</div>
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className={styles.field}>
            <div className={styles.fieldLabel}>{label}:</div>
            <div className={styles.fieldValue}>{value}</div>
        </div>
    )
}