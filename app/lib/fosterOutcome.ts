/**
 * Wags & Walks marks foster-to-adopt / foster-fail dogs in ASM with name prefixes
 * (see JAY_TASKS.md). The Foster History report does not expose movement types, so
 * we infer adoption outcomes from the animal name on each history row.
 */
export type FosterFailOutcome = 'adopted' | 'adopting_in_progress'

export function fosterFailOutcomeFromName(name?: string): FosterFailOutcome | null {
  const lower = String(name || '').trim().toLowerCase()
  if (!lower) return null
  if (lower.startsWith('*poss ff')) return null
  if (lower.startsWith('*adopting') || lower.includes('*adopting')) {
    return 'adopting_in_progress'
  }
  if (lower.startsWith('*fta') || lower.startsWith('*ufta') || lower.startsWith('*ff')) {
    return 'adopted'
  }
  return null
}

export function fosterFailOutcomeLabel(
  outcome: FosterFailOutcome,
  isPast: boolean
): string {
  if (outcome === 'adopting_in_progress') {
    return 'Adoption in progress'
  }
  return isPast ? 'Adopted by foster' : 'Adopting'
}

export function fosterHistoryHasFosterFail(
  dogs: readonly { name?: string; fosterEndDate?: string | null }[]
): boolean {
  for (const dog of dogs) {
    const outcome = fosterFailOutcomeFromName(dog.name)
    if (!outcome) continue
    if (outcome === 'adopted') return true
    if (outcome === 'adopting_in_progress' && !dog.fosterEndDate) return true
  }
  return false
}
