'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
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

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
