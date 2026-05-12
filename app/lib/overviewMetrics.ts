import type { FostererHistory } from '@/app/lib/asmFosterHistory'
import type { Person, PersonStatus } from '@/app/lib/peopleTypes'

function isRejectedStatus(s?: PersonStatus): boolean {
    if (!s) return false
    if (s === 'rejected') return true
    return s.startsWith('rejected_')
}

function parseDate(s?: string | null): Date | null {
    if (!s?.trim()) return null
    const d = new Date(s.trim())
    return Number.isNaN(d.getTime()) ? null : d
}

/** Applicants with an email who applied on or after Monday 00:00 local time this week (and not rejected). */
export function countApplicantsAppliedThisWeek(people: Person[], now = new Date()): number {
    const day = now.getDay()
    const mondayOffset = (day + 6) % 7
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - mondayOffset)
    weekStart.setHours(0, 0, 0, 0)

    let n = 0
    for (const p of people) {
        if (!p.email?.trim()) continue
        if (isRejectedStatus(p.status)) continue
        const applied = parseDate(p.appliedAt)
        if (!applied || applied < weekStart) continue
        if (applied.getTime() > now.getTime()) continue
        n += 1
    }
    return n
}

/**
 * Unique animals with a foster start date in the current calendar month (month-to-date, local).
 * Uses ASM grouped foster history (current + past dogs per fosterer).
 */
export function countUniqueAnimalsPlacedThisMonth(fosterers: FostererHistory[], now = new Date()): number {
    const y = now.getFullYear()
    const m = now.getMonth()
    const monthStart = new Date(y, m, 1, 0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)

    const seen = new Set<string>()
    for (const f of fosterers) {
        for (const dog of [...f.currentFosters, ...f.pastFosters]) {
            const start = parseDate(dog.fosterStartDate)
            if (!start) continue
            if (start < monthStart || start > end) continue
            if (start.getFullYear() !== y || start.getMonth() !== m) continue
            seen.add(dog.animalId)
        }
    }
    return seen.size
}
