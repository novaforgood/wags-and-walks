'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import FostersSubTabs from './FostersSubTabs'
import { buildFosterDirectory, formatDateShort, type DogRecord, type FosterStatus } from '@/app/lib/fosterDirectory'
import styles from '../candidates/candidates.module.css'

type DogsApiResponse = {
  success?: boolean
  dogs?: DogRecord[]
  error?: string
}

type TasksApiResponse = {
  success?: boolean
  taskStatusByAnimalId?: Record<string, import('@/app/lib/fosterDirectory').FosterStatus>
}

export default function FostersPage() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
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
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | FosterStatus>('all')
  const [dogs, setDogs] = useState<DogRecord[]>([])
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [dogsError, setDogsError] = useState<string | null>(null)
  const [taskStatusByAnimalId, setTaskStatusByAnimalId] = useState<Record<string, import('@/app/lib/fosterDirectory').FosterStatus>>({})

  useEffect(() => {
    let active = true
    async function loadData() {
      setIsLoadingDogs(true)
      setDogsError(null)
      try {
        const [dogsRes, tasksRes] = await Promise.all([
          fetch('/api/dogs', { cache: 'no-store' }),
          fetch('/api/tasks', { cache: 'no-store' }).catch(() => null),
        ])
        const dogsData = (await dogsRes.json()) as DogsApiResponse
        if (!dogsRes.ok || !dogsData?.success || !Array.isArray(dogsData.dogs)) {
          throw new Error(dogsData?.error || 'Failed to load current directory from Shelter Manager')
        }
        if (!active) return
        setDogs(dogsData.dogs)
        if (tasksRes) {
          try {
            const tasksData = (await tasksRes.json()) as TasksApiResponse
            if (tasksData?.taskStatusByAnimalId) {
              setTaskStatusByAnimalId(tasksData.taskStatusByAnimalId)
            }
          } catch { /* tasks not available yet */ }
        }
      } catch (error) {
        if (!active) return
        setDogsError(error instanceof Error ? error.message : 'Failed to load current directory from Shelter Manager')
      } finally {
        if (active) setIsLoadingDogs(false)
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [])

  const directoryRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const rows = buildFosterDirectory(dogs, taskStatusByAnimalId)
    return rows.filter(r => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      if (!matchesStatus) return false
      if (!q) return true
      return (
        r.fosterName.toLowerCase().includes(q) ||
        r.dogs.some(d => d.name.toLowerCase().includes(q)) ||
        r.status.toLowerCase().includes(q)
      )
    })
  }, [dogs, taskStatusByAnimalId, searchQuery, statusFilter])

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
      <div className={styles.pageWrapper} style={{ ['--app-sidebar-width' as any]: `${navWidth}px` }}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLogo}>
            <Image src="/assets/logo.svg" alt="Wags & Walks" width={160} height={60} priority />
          </div>

          <nav className={styles.sidebarNav}>
            <Link href="/overview" className={styles.navItem}>
              <img src="/assets/Overview.svg" alt="Overview" width={18} height={18} />
              Overview
            </Link>
            <Link href="/candidates" className={styles.navItem}>
              <img src="/assets/candidates.svg" alt="Applicants" width={18} height={18} />
              Applicants
            </Link>
            <Link
              href="/directory"
              className={`${styles.navItem} ${pathname === '/directory' ? styles.navItemActive : ''}`}
            >
              <img src="/assets/Search.svg" alt="Directory" width={18} height={18} />
              Directory
            </Link>
            <Link
              href="/fosters/overview"
              className={`${styles.navItem} ${pathname?.startsWith('/fosters') ? styles.navItemActive : ''}`}
            >
              <img src="/assets/fosters.svg" alt="Fosters" width={18} height={18} />
              Fosters
            </Link>
          </nav>

          <div className={styles.sidebarProfile}>
            <div className={styles.profileAvatar}>
              {user?.email && user.email.charAt(0).toUpperCase()}
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>
                {user?.displayName || user?.email?.split('@')[0] || 'User'}
              </span>
              <a href="#" className={styles.profileEmail}>{user?.email}</a>
              <button className={styles.profileLogout} onClick={signOut}>Log Out</button>
            </div>
          </div>
        </aside>

        <div
          className={styles.navResizeHandle}
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            navStartXRef.current = e.clientX
            navStartWRef.current = navWidth
            setIsResizingNav(true)
          }}
        />

        <div className={styles.mainContent}>
          <div className={styles.topBar}>
            <h1 className={styles.topBarTitle}>Onboarded Fosters</h1>
            <NotificationPanel />
          </div>

          <FostersSubTabs active="directory" />

          <div className={styles.toolbar}>
            <div className={styles.searchWrapper}>
              <input
                type="text"
                placeholder="Search foster, dog, or status"
                className={styles.searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className={styles.searchIconWrap}>
                <img src="/assets/Search.svg" alt="Search" width={16} height={16} />
              </div>
            </div>
            <div className={styles.toolbarRight}>
              <select
                className={`${styles.toolbarBtn} ${styles.statusFilterSelect}`}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as 'all' | FosterStatus)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="Good">Good</option>
                <option value="Needs Review">Needs Review</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          {isLoadingDogs && (
            <div className={styles.loadingContainer}>Loading current directory...</div>
          )}
          {dogsError && <div className={styles.errorText}>{dogsError}</div>}

          {!isLoadingDogs && (
            <div className={styles.tableWrapper}>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Foster Name</th>
                      <th>Dog(s) Fostering</th>
                      <th>Last update</th>
                      <th>Current Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {directoryRows.map(row => (
                      <tr key={row.id}>
                        <td>
                          <Link href={`/fosters/${row.id}`} className={styles.nameLink}>
                            {row.fosterName}
                          </Link>
                        </td>
                        <td>{row.dogs.map(d => d.name).join(', ')}</td>
                        <td>{formatDateShort(row.lastUpdate)}</td>
                        <td>{row.status}</td>
                        <td>
                          <Link
                            href={`/fosters/${row.id}`}
                            className={styles.infoIconBtn}
                            aria-label={`View details for ${row.fosterName}`}
                            title={`View details for ${row.fosterName}`}
                          >
                            i
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {directoryRows.length === 0 && !dogsError && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                          No directory rows found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

