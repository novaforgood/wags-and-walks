'use client'

import styles from './ApplicantCard.module.css'
import type { Person } from '../lib/peopleTypes'

type Props = {
    person: Person
    selected?: boolean
    onToggleSelect?: () => void
    onAction?: () => void
    actionLabel?: string
    isFlagged?: boolean
}

export default function ApplicantCard({
    person,
    selected,
    onToggleSelect,
    onAction,
    actionLabel = 'View',
    isFlagged = false
}: Props) {
    const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unknown'
    const needs = person.specialNeeds && person.specialNeeds.length > 0
        ? person.specialNeeds.join(', ')
        : 'No special needs'

    return (
        <div className={`${styles.card} ${selected ? styles.selected : ''} ${isFlagged ? styles.flagged : ''}`}>
            <div className={styles.checkboxWrapper}>
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

            <button className={styles.actionButton} onClick={onAction}>
                {actionLabel}
            </button>
        </div>
    )
}
