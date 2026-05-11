/** Relative label for a submission / event time (matches overview queue). */
export function formatRelativeTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = Date.now()
  const diffMs = now - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const startOf = (t: number) => {
    const x = new Date(t)
    x.setHours(0, 0, 0, 0)
    return x.getTime()
  }
  const dayDiff = Math.round((startOf(now) - startOf(d.getTime())) / 86400000)
  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff < 7) return `${dayDiff}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
