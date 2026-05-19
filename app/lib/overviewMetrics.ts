import type { Person, PersonStatus } from '@/app/lib/peopleTypes'

function isRejectedStatus(s?: PersonStatus): boolean {
    if (!s) return false
    if (s === 'rejected') return true
    return s.startsWith('rejected_')
}

function parseDate(s?: string | null): Date | null {
    return parseCalendarDateLocal(s)
}

/** ASM / sheet dates in local calendar terms (M/D/YYYY or YYYY-MM-DD, not UTC midnight). */
export function parseCalendarDateLocal(s?: string | null): Date | null {
    if (!s?.trim()) return null
    const raw = s.trim()
    const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (mdy) {
        const d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]))
        return Number.isNaN(d.getTime()) ? null : d
    }
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (ymd) {
        const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
        return Number.isNaN(d.getTime()) ? null : d
    }
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
}

export function weekStartMondayLocal(now: Date = new Date()): Date {
    const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
    const day = d.getDay()
    const mondayOffset = (day + 6) % 7
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - mondayOffset)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
}

/** Human-readable range for the current calendar week (Mon 00:00 local → now). */
export function calendarWeekRangeLabel(now: Date = new Date()): string {
    const t = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
    const start = weekStartMondayLocal(t)
    const fmt = (d: Date) =>
        d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return `${fmt(start)} – ${fmt(t)}`
}

/**
 * Same row-level rule as {@link countApplicantsAppliedThisWeek}: has email, not rejected,
 * applied on or after Monday 00:00 local this week and not in the future.
 */
export function applicantAppliedThisWeek(p: Person, now: Date = new Date()): boolean {
    const t = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
    if (!p.email?.trim()) return false
    if (isRejectedStatus(p.status)) return false
    const applied = parseDate(p.appliedAt)
    if (!applied) return false
    if (applied < weekStartMondayLocal(t)) return false
    if (applied.getTime() > t.getTime()) return false
    return true
}

/** Applicants with an email who applied on or after Monday 00:00 local time this week (and not rejected). */
export function countApplicantsAppliedThisWeek(people: Person[], now: Date = new Date()): number {
    const t = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
    let n = 0
    for (const p of people) {
        if (applicantAppliedThisWeek(p, t)) n += 1
    }
    return n
}

