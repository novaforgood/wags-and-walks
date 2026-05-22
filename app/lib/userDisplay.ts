/**
 * Derives a readable display name from an email local-part (no DB lookup).
 * Example: ja.thapar@gmail.com → "Ja Thapar". system → "System".
 */
export function friendlyNameFromEmail(email: string): string {
  const e = email.trim().toLowerCase()
  if (!e || e === 'system') return 'System'
  const local = e.split('@')[0] ?? ''
  const segments = local.split(/[._-]+/).filter(Boolean)
  if (segments.length === 0) return email.trim()

  return segments
    .map((seg) => {
      const lettersOnly = seg.replace(/\d+$/, '')
      const core = lettersOnly.length >= 2 ? lettersOnly : seg
      return core.charAt(0).toUpperCase() + core.slice(1).toLowerCase()
    })
    .join(' ')
}
