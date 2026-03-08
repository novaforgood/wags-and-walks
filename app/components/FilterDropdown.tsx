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

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Dynamically extract unique values for specific columns
    const livingOptions = useMemo(() => {
        const rawVals = people.map(p => String(p.raw?.['What is your living arrangement?'] || '').trim()).filter(Boolean)
        return Array.from(new Set(rawVals)).sort()
    }, [people])

    const experienceOptions = useMemo(() => {
        const rawVals = people.map(p => String(p.raw?.['How would you rate your experience with dogs?'] || '').trim()).filter(Boolean)
        return Array.from(new Set(rawVals)).sort()
    }, [people])

    const animalOptions = ['Currently owns pets', 'Previously owned pets', 'No past/current animals']
    const childrenOptions = ['Has children', 'No children']

    const dogTypeOptions = KNOWN_SPECIAL_NEEDS.filter(n => n !== 'None of the Above')

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
                Filter by {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
                <div className={`${styles.chevronImgWrapBtn} ${isOpen ? styles.chevronRotatedBtn : ''}`}>
                    <img src="/assets/Arrow.svg" alt="Toggle" width={11} height={7} />
                </div>
            </button>

            {isOpen && (
                <div className={styles.menu}>
                    <Category
                        title="Living situation"
                        options={livingOptions}
                        selected={filters.livingSituation}
                        isExpanded={expandedCategory === 'livingSituation'}
                        onToggleExpand={() => toggleCategory('livingSituation')}
                        onToggleOption={(val) => toggleFilter('livingSituation', val)}
                    />
                    <Category
                        title="Types of dogs willing to foster"
                        options={dogTypeOptions}
                        selected={filters.dogTypes}
                        isExpanded={expandedCategory === 'dogTypes'}
                        onToggleExpand={() => toggleCategory('dogTypes')}
                        onToggleOption={(val) => toggleFilter('dogTypes', val)}
                    />
                    <Category
                        title="Past and current animals"
                        options={animalOptions}
                        selected={filters.pastCurrentAnimals}
                        isExpanded={expandedCategory === 'pastCurrentAnimals'}
                        onToggleExpand={() => toggleCategory('pastCurrentAnimals')}
                        onToggleOption={(val) => toggleFilter('pastCurrentAnimals', val)}
                    />
                    <Category
                        title="Experience level"
                        options={experienceOptions}
                        selected={filters.experienceLevel}
                        isExpanded={expandedCategory === 'experienceLevel'}
                        onToggleExpand={() => toggleCategory('experienceLevel')}
                        onToggleOption={(val) => toggleFilter('experienceLevel', val)}
                    />
                    <Category
                        title="Children in the home"
                        options={childrenOptions}
                        selected={filters.children}
                        isExpanded={expandedCategory === 'children'}
                        onToggleExpand={() => toggleCategory('children')}
                        onToggleOption={(val) => toggleFilter('children', val)}
                    />

                    {/* Clear Filters Button */}
                    <div className={styles.clearFiltersWrap}>
                        <button
                            className={styles.clearFiltersBtn}
                            onClick={() => {
                                setFilters({
                                    livingSituation: [],
                                    dogTypes: [],
                                    pastCurrentAnimals: [],
                                    experienceLevel: [],
                                    children: []
                                })
                                setIsOpen(false)
                            }}
                            disabled={activeCount === 0}
                        >
                            Clear all filters
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

function Category({
    title, options, selected, isExpanded, onToggleExpand, onToggleOption
}: {
    title: string, options: string[], selected: string[], isExpanded: boolean,
    onToggleExpand: () => void, onToggleOption: (val: string) => void
}) {
    const activeCount = selected.length

    return (
        <div className={styles.categoryWrap}>
            <button className={styles.categoryBtn} onClick={onToggleExpand}>
                <span className={styles.categoryTitle}>{title}</span>
                <div className={styles.categoryRight}>
                    {activeCount > 0 && <span className={styles.catBadge}>{activeCount}</span>}
                    <div className={`${styles.chevronImgWrap} ${isExpanded ? styles.chevronRotated : ''}`}>
                        <img src="/assets/Arrow.svg" alt="Toggle" width={11} height={7} />
                    </div>
                </div>
            </button>

            {isExpanded && options.length > 0 && (
                <div className={styles.optionsList}>
                    {options.map(opt => (
                        <label key={opt} className={styles.optionLabel}>
                            <input
                                type="checkbox"
                                checked={selected.includes(opt)}
                                onChange={() => onToggleOption(opt)}
                                className={styles.checkbox}
                            />
                            <span className={styles.optionText}>{opt}</span>
                        </label>
                    ))}
                </div>
            )}
            {isExpanded && options.length === 0 && (
                <div className={styles.noOptions}>No options available</div>
            )}
        </div>
    )
}
