'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import { usePeople } from '@/app/components/PeopleProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import {
  buildFosterDirectory,
  formatDateShort,
  type DogRecord,
} from '@/app/lib/fosterDirectory'
import layoutStyles from '../../candidates/candidates.module.css'
import styles from './page.module.css'

type DogsApiResponse = {
  success?: boolean
  dogs?: DogRecord[]
  error?: string
}

export default function FosterDetailsPage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const backHref = searchParams.get('from') === 'overview' ? '/fosters/overview' : '/fosters'
  const backLabel = searchParams.get('from') === 'overview' ? '← Back to Overview' : '← Back to Current Directory'
  const params = useParams<{ fosterId: string }>()
  const fosterId = params?.fosterId
  const { user, signOut } = useAuth()
  const { people } = usePeople()
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesFromSheet, setNotesFromSheet] = useState<{ notes: string; notesUpdatedAt: string } | null>(null)
  const [isLoadingNotes, setIsLoadingNotes] = useState(true)
  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [dogsError, setDogsError] = useState<string | null>(null)
  const [navWidth, setNavWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('app_nav_sidebar_width_v1')
      const n = raw ? Number(raw) : NaN
      return Number.isFinite(n) ? Math.max(180, Math.min(280, n)) : 208
    } catch {
      return 208
    }
  })
  const [isResizingNav, setIsResizingNav] = useState(false)
  const navStartXRef = useRef(0)
  const navStartWRef = useRef(208)

  useEffect(() => {
    let active = true
    async function loadDogs() {
      setIsLoadingDogs(true)
      setDogsError(null)
      try {
        const response = await fetch('/api/dogs', { method: 'GET', cache: 'no-store' })
        const data = (await response.json()) as DogsApiResponse
        if (!response.ok || !data?.success || !Array.isArray(data.dogs)) {
          throw new Error(data?.error || 'Failed to load foster details from Shelter Manager')
        }
        if (!active) return
        setDogs(data.dogs)
      } catch (error) {
        if (!active) return
        setDogsError(error instanceof Error ? error.message : 'Failed to load foster details from Shelter Manager')
      } finally {
        if (active) setIsLoadingDogs(false)
      }
    }
    loadDogs()
    return () => {
      active = false
    }
  }, [])

  const directory = useMemo(() => buildFosterDirectory(dogs), [dogs])
  const foster = useMemo(() => directory.find(f => f.id === fosterId), [directory, fosterId])
  const person = useMemo(
    () => people.find(p => p.email?.toLowerCase() === foster?.fosterEmail?.toLowerCase()),
    [people, foster]
  )

  // Decode the email from the slug immediately so notes can load in parallel with dogs.
  // fosterSlug() uses encodeURIComponent(email) when an email is available.
  const emailFromSlug = useMemo(() => {
    if (!fosterId) return null
    const decoded = decodeURIComponent(fosterId)
    return decoded.includes('@') ? decoded : null
  }, [fosterId])

  useEffect(() => {
    if (!emailFromSlug) {
      setIsLoadingNotes(false)
      return
    }
    let active = true
    fetch(`/api/foster-notes?email=${encodeURIComponent(emailFromSlug)}`)
      .then(r => r.json())
      .then(data => {
        if (!active) return
        if (data?.success) {
          setNotesFromSheet({ notes: data.notes || '', notesUpdatedAt: data.notesUpdatedAt || '' })
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setIsLoadingNotes(false) })
    return () => { active = false }
  }, [emailFromSlug])

  useEffect(() => {
    try {
      localStorage.setItem('app_nav_sidebar_width_v1', String(navWidth))
    } catch {
      // ignore
    }
  }, [navWidth])

  useEffect(() => {
    if (!isResizingNav) return
    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    function onMove(e: PointerEvent) {
      const delta = e.clientX - navStartXRef.current
      const next = Math.max(180, Math.min(280, navStartWRef.current + delta))
      setNavWidth(next)
    }
    function onUp() {
      setIsResizingNav(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      document.body.style.userSelect = prevUserSelect
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isResizingNav])

  return (
    <ProtectedRoute>
      <div className={layoutStyles.pageWrapper} style={{ ['--app-sidebar-width' as any]: `${navWidth}px` }}>
        <aside className={layoutStyles.sidebar}>
          <div className={layoutStyles.sidebarLogo}>
            <Image src="/assets/logo.png" alt="Wags & Walks" width={160} height={60} priority />
          </div>
          <nav className={layoutStyles.sidebarNav}>
            <Link href="/overview" className={layoutStyles.navItem}>
              <img src="/assets/Overview.svg" alt="" width={18} height={18} />
              Overview
            </Link>
            <Link href="/candidates" className={layoutStyles.navItem}>
              <img src="/assets/candidates.svg" alt="" width={18} height={18} />
              Applicants
            </Link>
            <Link
              href="/directory"
              className={`${layoutStyles.navItem} ${pathname === '/directory' ? layoutStyles.navItemActive : ''}`}
            >
              <img src="/assets/Search.svg" alt="" width={18} height={18} />
              Directory
            </Link>
            <Link
              href="/fosters/overview"
              className={`${layoutStyles.navItem} ${pathname?.startsWith('/fosters') ? layoutStyles.navItemActive : ''}`}
            >
              <img src="/assets/fosters.svg" alt="" width={18} height={18} />
              Fosters
            </Link>
          </nav>
          <div className={layoutStyles.sidebarProfile}>
            <div className={layoutStyles.profileAvatar}>
              {user?.email && user.email.charAt(0).toUpperCase()}
            </div>
            <div className={layoutStyles.profileInfo}>
              <span className={layoutStyles.profileName}>
                {user?.displayName || user?.email?.split('@')[0] || 'User'}
              </span>
              <a href="#" className={layoutStyles.profileEmail}>{user?.email}</a>
              <button type="button" className={layoutStyles.profileLogout} onClick={signOut}>Log Out</button>
            </div>
          </div>
        </aside>

        <div
          className={layoutStyles.navResizeHandle}
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            navStartXRef.current = e.clientX
            navStartWRef.current = navWidth
            setIsResizingNav(true)
          }}
        />

        <div className={layoutStyles.mainContent}>
          <div className={layoutStyles.topBar}>
            <h1 className={layoutStyles.topBarTitle}>Foster Details</h1>
            <NotificationPanel />
          </div>

          <div className={styles.wrap}>
            <Link href={backHref} className={styles.backLink}>{backLabel}</Link>

            {isLoadingDogs && <div className={layoutStyles.loadingContainer}>Loading foster details...</div>}
            {dogsError && <div className={layoutStyles.errorText}>{dogsError}</div>}

            {!isLoadingDogs && !dogsError && !foster && (
              <div className={styles.card}>No foster record found for this profile.</div>
            )}

            {!isLoadingDogs && foster && (
              <>
                <section className={styles.card}>
                  <h2 className={styles.title}>{foster.fosterName}</h2>
                  <div className={styles.metaGrid}>
                    <div><strong>Status:</strong> {foster.status}</div>
                    <div><strong>Currently fostering:</strong> {foster.dogs.length > 0 ? 'Yes' : 'No'}</div>
                    <div><strong>Dogs fostering:</strong> {foster.dogs.map(d => d.name).join(', ')}</div>
                    <div><strong>Last update:</strong> {formatDateShort(foster.lastUpdate)}</div>
                  </div>
                </section>

                <section className={styles.card}>
                  <h3 className={styles.sectionTitle}>Current Fostering Situation</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Dog</th>
                        <th>How long fostering</th>
                        <th>Last update</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foster.dogs.map(dog => (
                        <tr key={dog.id}>
                          <td>{dog.name}</td>
                          <td>{typeof dog.daysInFoster === 'number' ? `${dog.daysInFoster} days` : 'Unknown'}</td>
                          <td>{formatDateShort(dog.lastUpdate)}</td>
                          <td>{dog.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className={styles.card}>
                  <div className={styles.notesHeader}>
                    <h3 className={styles.sectionTitle}>Notes</h3>
                    {!notesSaving && notesSaved && <span className={styles.notesLastSaved}>Saved</span>}
                    {notesSaving && <span className={styles.notesLastSaved}>Saving...</span>}
                    {!notesSaving && !notesSaved && notesFromSheet?.notesUpdatedAt && (
                      <span className={styles.notesLastSaved}>Last saved: {formatDateShort(notesFromSheet.notesUpdatedAt)}</span>
                    )}
                  </div>
                  <textarea
                    className={styles.notesTextarea}
                    placeholder={isLoadingNotes ? 'Loading...' : 'No notes yet...'}
                    disabled={isLoadingNotes}
                    value={notesDraft ?? (notesFromSheet?.notes ?? '')}
                    onChange={e => {
                      setNotesDraft(e.target.value)
                      setNotesSaved(false)
                    }}
                    onBlur={async () => {
                      if (!foster.fosterEmail || notesDraft === null) return
                      setNotesSaving(true)
                      await fetch('/api/foster-notes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: foster.fosterEmail, content: notesDraft }),
                      })
                      setNotesSaving(false)
                      setNotesSaved(true)
                    }}
                  />
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

