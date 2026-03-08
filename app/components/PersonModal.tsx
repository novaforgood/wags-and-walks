'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Person } from '@/app/lib/peopleTypes'
import styles from './PersonModal.module.css'

interface Props {
    person: Person | null
    onClose: () => void
}

type ProfileTab = 'profile' | 'documents' | 'updates' | 'pending'

// Raw keys already rendered in the structured sections — skip from the "Other" dump
const SHOWN_RAW_KEYS = new Set([
    'First Name', 'Last Name', 'Email', 'Phone', 'How old are you?',
    'Timestamp', 'Applicant Status', 'Flags', 'Review Status',
    'When would you like to take your foster dog home?',
    'Are there any dogs with special needs that you would be comfortable fostering?'
])

export default function PersonModal({ person, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<ProfileTab>('profile')

    if (!person) return null

    const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
    const statusLabel = person.status === 'in-progress' ? 'In Progress' : 'New'

    // All remaining raw fields not shown in structured sections
    const otherEntries = Object.entries(person.raw ?? {}).filter(
        ([key, value]) => !SHOWN_RAW_KEYS.has(key) && value && value.trim() !== ''
    )

    return (
        <div className={styles.overlay}>
            {/* Top bar */}
            <div className={styles.topBar}>
                <div className={styles.topBarLeft}>
                    <h2 className={styles.personName}>{name}</h2>
                    <div className={styles.statusDots}>
                        {/* TODO: replace with real foster availability status from data */}
                        <span className={styles.dot} style={{ background: '#aaa' }} />
                        <span className={styles.statusLabel}>{statusLabel}</span>
                    </div>
                </div>
                {/* Notification bell */}
                <div className={styles.topBarIcon}>
                    <Image src="/assets/bell.png" alt="Notifications" width={24} height={24} />
                </div>
            </div>

            {/* Tab row */}
            <div className={styles.tabRow}>
                <div className={styles.tabs}>
                    {(['profile', 'documents', 'updates', 'pending'] as ProfileTab[]).map(tab => {
                        const labels: Record<ProfileTab, string> = {
                            profile: 'Profile',
                            documents: 'Documents',
                            updates: 'Updates',
                            pending: 'Pending actions',
                        }
                        return (
                            <button
                                key={tab}
                                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {labels[tab]}
                            </button>
                        )
                    })}
                </div>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {activeTab === 'profile' && (
                    <ProfileTab person={person} otherEntries={otherEntries} />
                )}
                {activeTab === 'documents' && (
                    <Placeholder label="Documents" />
                )}
                {activeTab === 'updates' && (
                    <Placeholder label="Updates" />
                )}
                {activeTab === 'pending' && (
                    <Placeholder label="Pending actions" />
                )}
            </div>
        </div>
    )
}

// ---- Profile tab ----
function ProfileTab({ person, otherEntries }: { person: Person; otherEntries: [string, string][] }) {
    return (
        <div className={styles.profileContent}>
            {/* Personal information */}
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

            {/* All other raw sheet answers */}
            {otherEntries.length > 0 && (
                <Section title="Application answers">
                    <ThreeColGrid>
                        {otherEntries.map(([key, value]) => (
                            <Field key={key} label={key} value={value} />
                        ))}
                    </ThreeColGrid>
                </Section>
            )}
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

function Placeholder({ label }: { label: string }) {
    return (
        <div className={styles.placeholder}>
            {/* TODO: implement {label} tab */}
            <span className={styles.placeholderText}>{label} — coming soon</span>
        </div>
    )
}
