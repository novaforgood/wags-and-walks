'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { Person } from '@/app/lib/peopleTypes'
import { KNOWN_SPECIAL_NEEDS } from '@/app/lib/peopleTypes'

import styles from './FilterDropdown.module.css'

export type FilterState = {
    livingSituation: string[]
    dogTypes: string[]
    pastCurrentAnimals: string[]
    experienceLevel: string[]
    children: string[]
}

interface Props {
    people: Person[]
    filters: FilterState
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>
}

type CategoryKey = keyof FilterState

export default function FilterDropdown({ people, filters, setFilters }: Props) {
    const [isOpen, setIsOpen] = useState(false)
    const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const livingOptions = useMemo(() => {
        const rawVals = people.map(p =>
            String(p.raw?.['What is your living arrangement?'] || p.raw?.['What is your living arrangement'] || '').trim()
        ).filter(Boolean)
        return Array.from(new Set(rawVals)).sort()
    }, [people])

    const experienceOptions = useMemo(() => {
        const rawVals = people.map(p =>
            String(
                p.raw?.['How would you rate your experience with dogs?'] ||
                p.raw?.['How would you rate your experience with dogs'] ||
                ''
            ).trim()
        ).filter(Boolean)
        return Array.from(new Set(rawVals)).sort()
    }, [people])

    const animalOptions = ['Currently owns pets', 'Previously owned pets', 'No past/current animals']
    const childrenOptions = ['Has children', 'No children']
    const dogTypeOptions = KNOWN_SPECIAL_NEEDS.filter(n => n !== 'None of the Above')

    const categories: { key: CategoryKey; title: string; options: string[] }[] = [
        { key: 'livingSituation', title: 'Living situation', options: livingOptions },
        { key: 'dogTypes', title: 'Types of dogs willing to foster', options: dogTypeOptions },
        { key: 'pastCurrentAnimals', title: 'Past and current animals', options: animalOptions },
        { key: 'experienceLevel', title: 'Experience level', options: experienceOptions },
        { key: 'children', title: 'Children in the home', options: childrenOptions },
    ]

    const toggleCategory = (cat: CategoryKey) => {
        setExpandedCategory(prev => prev === cat ? null : cat)
    }

    const toggleFilter = (cat: CategoryKey, val: string) => {
        setFilters(prev => {
            const current = prev[cat]
            const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val]
            return { ...prev, [cat]: next }
        })
    }

    const activeCount = Object.values(filters).flat().length

    return (
        <div className={styles.dropdownContainer} ref={dropdownRef}>
            <button
                className={`${styles.filterBtn} ${activeCount > 0 ? styles.filterBtnActive : ''} ${isOpen ? styles.filterBtnOpen : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                Filter by
                {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
                <span className={`${styles.chevron} ${isOpen ? styles.chevronUp : ''}`}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </span>
            </button>

            {isOpen && (
                <div className={styles.menu}>
                    <div className={styles.menuHeader}>
                        <span className={styles.menuTitle}>Filters</span>
                        {activeCount > 0 && (
                            <button
                                className={styles.clearBtn}
                                onClick={() => {
                                    setFilters({ livingSituation: [], dogTypes: [], pastCurrentAnimals: [], experienceLevel: [], children: [] })
                                }}
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    <div className={styles.categoriesList}>
                        {categories.map(({ key, title, options }) => {
                            const selected = filters[key]
                            const isExpanded = expandedCategory === key
                            const hasSelected = selected.length > 0

                            return (
                                <div key={key} className={`${styles.categoryWrap} ${isExpanded ? styles.categoryWrapExpanded : ''}`}>
                                    <button
                                        className={styles.categoryBtn}
                                        onClick={() => toggleCategory(key)}
                                    >
                                        <span className={styles.categoryLeft}>
                                            <span className={styles.categoryTitle}>{title}</span>
                                            {hasSelected && (
                                                <span className={styles.catBadge}>{selected.length}</span>
                                            )}
                                        </span>
                                        <span className={`${styles.categoryChevron} ${isExpanded ? styles.categoryChevronOpen : ''}`}>
                                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        </span>
                                    </button>

                                    {isExpanded && (
                                        <div className={styles.optionsList}>
                                            {options.length === 0 ? (
                                                <span className={styles.noOptions}>No options available</span>
                                            ) : (
                                                options.map(opt => (
                                                    <label key={opt} className={styles.optionLabel}>
                                                        <span className={`${styles.customCheckbox} ${selected.includes(opt) ? styles.customCheckboxChecked : ''}`}>
                                                            {selected.includes(opt) && (
                                                                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                                                    <path d="M1 3.5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                                </svg>
                                                            )}
                                                        </span>
                                                        <input
                                                            type="checkbox"
                                                            checked={selected.includes(opt)}
                                                            onChange={() => toggleFilter(key, opt)}
                                                            className={styles.hiddenCheckbox}
                                                        />
                                                        <span className={styles.optionText}>{opt}</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}