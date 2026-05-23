'use client'

import { auth } from '@/firebase'

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('You must be signed in')

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, { ...init, headers })
}
