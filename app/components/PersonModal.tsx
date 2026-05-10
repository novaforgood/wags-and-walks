'use client'

import { useState } from 'react'

import type { Person } from '@/app/lib/peopleTypes'
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

const APPLICATION_SECTIONS = [
    {
        title: 'Personal Information',
        fields: [
            'Submitted On',
            'Name',
            'Email',
            'Phone',
            'Address',
            'How old are you',
            'What do you do for a living',
        ],
    },
    {
        title: 'Household',
        fields: [
            'What is your living arrangement',
            'How many children are in your home',
            'How old are they Check all that apply',
            'Other than yourself how many additional adults do you share your home with',
            'How old are they',
            'What is their relationship to you',
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
    {
        title: 'Agreements',
        fields: [
            'Wags and Walks dogs will often have a transition period of 12 weeks after leaving the shelter and may exhibit signs of separation anxiety andor may have accidents in their new foster homes until they feel safe Please check that you agree to understanding that there could be a transition period',
            'Aside from emergencies we require 48 hours notice if you need to return your foster dog Is that something you feel you can accommodate',
            'I understand that any misrepresentation of the above information authorizes Wags  Walks to deny application andor reclaim the pet that is in my home I acknowledge that Wags  Walks cannot guarantee any animals against parasites diseases or destructive behavior If I foster a dog from Wags  Walks I will not hold Wags  Walks responsible nor seek any compensation for damages medical fees or other liabilities incurred by the pet I foster',
            'I understand that I must follow all Wags and Walks protocols for fostering a dog which includes always having a collar on keeping a leash on my foster dog at all times when in public and using a crate for my foster dog when heshe is alone',
        ],
    },
]

const ALL_SECTION_FIELDS = new Set(APPLICATION_SECTIONS.flatMap(s => s.fields))

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
    const statusLabel = person.status === 'in-progress' ? 'In Progress' : 'New'

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
    const hasApplicationData = Object.entries(raw).some(
        ([k, v]) => !META_FIELDS.has(k) && v && v.trim() !== ''
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
            {APPLICATION_SECTIONS.map(section => {
                const rows = section.fields
                    .map(field => ({ label: field, value: raw[field] ?? '' }))
                    .filter(row => row.value.trim() !== '')

                if (rows.length === 0) return null

                return (
                    <div key={section.title} className={styles.section}>
                        <div className={styles.sectionTitle}>{section.title}</div>
                        <div className={styles.threeColGrid}>
                            {rows.map(({ label, value }) => (
                                <div key={label} className={styles.field}>
                                    <div className={styles.fieldLabel}>{label}:</div>
                                    <div className={styles.fieldValue}>{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}

            {(() => {
                const remaining = Object.entries(raw).filter(
                    ([k, v]) => !ALL_SECTION_FIELDS.has(k) && !META_FIELDS.has(k) && v && v.trim() !== ''
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