'use client'

import Link from 'next/link'
import styles from './ApplicantCard.module.css'
import type { Person } from '../lib/peopleTypes'

type Props = {
    person: Person
    selected?: boolean
    onToggleSelect?: () => void
    onAction?: () => void
    onReject?: () => void
    actionLabel?: string
    isFlagged?: boolean
    variant?: 'list' | 'grid'
}

export default function ApplicantCard({
    person,
    selected,
    onToggleSelect,
    onAction,
    onReject,
    actionLabel = 'View',
    isFlagged = false,
    variant = 'list'
}: Props) {
    const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
    const needs = person.specialNeeds && person.specialNeeds.length > 0
        ? person.specialNeeds.join(', ')
        : 'No special needs'

    const isRejected = person.status === 'rejected'

    const containerClass = `${styles.card} ${variant === 'grid' ? styles.grid : ''
        } ${selected ? styles.selected : ''
        } ${isFlagged ? styles.flagged : ''
        } ${isRejected ? styles.rejected : ''
        }`

    const content = (
        <div className={containerClass}>
            <div
                className={styles.checkboxWrapper}
                onClick={(e) => e.stopPropagation()}
            >
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onToggleSelect}
                    className={styles.checkbox}
                />
            </div>

            <div className={styles.avatar} />

            <div className={styles.info}>
                <div className={styles.name}>{name}</div>
                <div className={styles.details}>{needs}</div>
            </div>

            <div className={styles.actions}>
                {!isRejected && (
                    <button
                        className={styles.rejectButton}
                        title="Reject Applicant"
                        onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            onReject?.()
                        }}
                    >
                        ✕
                    </button>
                )}
                <button
                    className={styles.actionButton}
                    onClick={(e) => {
                        e.stopPropagation()
                        onAction?.()
                    }}
                >
                    {actionLabel}
                </button>
            </div>
        </div>
    )

    if (person.email) {
        return (
            <Link href={`/applicants/${encodeURIComponent(person.email)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                {content}
            </Link>
        )
    }

    return content
}
