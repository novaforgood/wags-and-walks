'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  updateProfile,
} from 'firebase/auth'
import { auth } from '@/firebase'
import { getAllowedUser, UserRole } from '@/app/lib/allowedUsers'

type AuthContextType = {
  user: User | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Sends Firebase’s password-reset email (configure template in Firebase Console → Authentication → Templates). */
  resetPassword: (email: string) => Promise<void>
  /** Updates the signed-in user's `displayName` on Firebase Auth and refreshes context state. */
  updateDisplayName: (name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  // Bumped whenever a profile mutation refreshes auth.currentUser in place,
  // so consumers re-render and re-read fields like displayName.
  const [, setProfileBump] = useState(0)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser?.email) {
          const allowed = await getAllowedUser(firebaseUser.email)
          if (!allowed) {
            await firebaseSignOut(auth)
            setUser(null)
            setRole(null)
          } else {
            setUser(firebaseUser)
            setRole(allowed.role)
          }
        } else {
          setUser(null)
          setRole(null)
        }
      } catch {
        setUser(null)
        setRole(null)
      } finally {
        setLoading(false)
      }
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    await setPersistence(auth, browserLocalPersistence)
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const allowed = await getAllowedUser(cred.user.email!)
    if (!allowed) {
      await firebaseSignOut(auth)
      throw new Error("You don't have access to this portal. Contact an admin.")
    }
  }

  const signUp = async (email: string, password: string) => {
    const allowed = await getAllowedUser(email)
    if (!allowed) {
      throw new Error('Your email is not approved for access. Contact an admin.')
    }
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  const resetPassword = async (email: string) => {
    const trimmed = email.trim()
    if (!trimmed) throw new Error('Email is required')
    const continueUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined
    await sendPasswordResetEmail(
      auth,
      trimmed,
      continueUrl
        ? {
            url: continueUrl,
            handleCodeInApp: false,
          }
        : undefined
    )
  }

  const updateDisplayName = async (name: string) => {
    if (!auth.currentUser) throw new Error('You must be signed in to update your profile.')
    const trimmed = name.trim()
    await updateProfile(auth.currentUser, { displayName: trimmed || null })
    await auth.currentUser.reload()
    // Force a re-render so consumers re-read the now-mutated user object.
    setProfileBump((b) => b + 1)
  }

  return (
    <AuthContext.Provider
      value={{ user, role, loading, signIn, signUp, signOut, resetPassword, updateDisplayName }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
