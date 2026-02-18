'use client'

import Link from 'next/link'
import styles from './ApplicantCard.module.css'
import type { Person } from '../lib/peopleTypes'

type Props = {
    person: Person
    selected?: boolean
    onToggleSelect?: () => void
    onAction?: () => void
    actionLabel?: string
    isFlagged?: boolean
    variant?: 'list' | 'grid'
}

export default function ApplicantCard({
    person,
    selected,
    onToggleSelect,
    onAction,
    actionLabel = 'View',
    isFlagged = false,
    variant = 'list'
}: Props) {
    const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
    const needs = person.specialNeeds && person.specialNeeds.length > 0
        ? person.specialNeeds.join(', ')
        : 'No special needs'

    const containerClass = `${styles.card} ${variant === 'grid' ? styles.grid : ''
        } ${selected ? styles.selected : ''
        } ${isFlagged ? styles.flagged : ''
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
