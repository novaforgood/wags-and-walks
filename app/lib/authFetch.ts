'use client'

import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/firebase'

/** Wait until Firebase has restored the session from the browser (not just React state). */
function waitForAuthUser(timeoutMs = 10_000): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)

  return new Promise(resolve => {
    let settled = false
    const finish = (user: User | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      unsubscribe()
      resolve(user)
    }

    const timer = window.setTimeout(() => finish(auth.currentUser), timeoutMs)
    const unsubscribe = onAuthStateChanged(auth, user => finish(user))
  })
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const user = await waitForAuthUser()
  if (!user) {
    throw new Error('You must be signed in. Go to /login and sign in again.')
  }

  const token = await user.getIdToken()
  if (!token) {
    throw new Error('You must be signed in. Go to /login and sign in again.')
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, { ...init, headers })
}
