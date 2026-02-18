export type PersonWithStatus = {
  email?: string
  status?: 'new' | 'in-progress' | 'approved' | 'current'
}

type SendEmailGetResponse = {
  success?: boolean
  rows?: Record<string, unknown>[]
  error?: string
}

async function fetchClearedEmails(): Promise<Set<string>> {
  const fields = ['Email', 'Flags'].join(',')
  const response = await fetch(
    `/api/send-email?mode=ok&fields=${encodeURIComponent(fields)}`,
    { method: 'GET' }
  )

  const data = (await response.json()) as SendEmailGetResponse
  if (!data?.success || !Array.isArray(data.rows)) return new Set()

  const cleared = new Set<string>()
  for (const row of data.rows) {
    const email = String(row['Email'] || '').trim().toLowerCase()
    const flags = String(row['Flags'] || '').trim()
    if (email && !flags) cleared.add(email)
  }
  return cleared
}

export async function promoteClearedToApproved<T extends PersonWithStatus>(
  people: T[]
): Promise<T[]> {
  const clearedEmails = await fetchClearedEmails()
  if (clearedEmails.size === 0) return people

  let changed = false
  const updated = people.map(person => {
    const emailKey = String(person.email || '').trim().toLowerCase()
    if (!emailKey) return person

    if (clearedEmails.has(emailKey) && person.status === 'new') {
      changed = true
      return { ...person, status: 'approved' } as T
    }
    return person
  })

  return changed ? updated : people
}

