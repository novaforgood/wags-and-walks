'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePeople } from '@/app/components/PeopleProvider'
import { useAuth } from '@/app/components/AuthProvider'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import NotificationPanel from '@/app/components/NotificationPanel'
import type { Person, PersonStatus } from '@/app/lib/peopleTypes'
import layoutStyles from '../candidates/candidates.module.css'
import styles from './overview.module.css'

function hasEmail(p: Person): boolean {
    return !!p.email?.trim()
}

function isRejectedStatus(s?: PersonStatus): boolean {
    if (!s) return false
    if (s === 'rejected') return true
    return s.startsWith('rejected_')
}

function hasRedFlag(person: Person): boolean {
    const flags = String(person.raw?.['Flags'] || '').trim().toLowerCase()
    return !!(flags && flags !== 'ok' && flags !== 'none')
}

function buildConicGradient(segments: { count: number; color: string }[]): string | null {
    const total = segments.reduce((a, s) => a + Math.max(0, s.count), 0)
    if (total <= 0) return null
    let deg = 0
    const parts: string[] = []
    for (const s of segments) {
        if (s.count <= 0) continue
        const span = (s.count / total) * 360
        const end = deg + span
        parts.push(`${s.color} ${deg}deg ${end}deg`)
        deg = end
    }
    if (parts.length === 0) return null
    return `conic-gradient(${parts.join(', ')})`
}

export default function OverviewPage() {
    const pathname = usePathname()
    const { people, isLoading, error } = usePeople()
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

    const stats = useMemo(() => {
        const rows = people.filter(hasEmail)

        let newCount = 0
        let inProgressCount = 0
        let approvedCount = 0
        let currentCount = 0
        let rejectedCount = 0

        for (const p of rows) {
            const s = p.status || 'new'
            if (isRejectedStatus(s)) {
                rejectedCount += 1
                continue
            }
            switch (s) {
                case 'new':
                    newCount += 1
                    break
                case 'in-progress':
                    inProgressCount += 1
                    break
                case 'approved':
                    approvedCount += 1
                    break
                case 'current':
                    currentCount += 1
                    break
                default:
                    break
            }
        }

        const pipelineCount = newCount + inProgressCount
        const flaggedInPipeline = rows.filter(p => {
            const s = p.status || 'new'
            if (s !== 'new' && s !== 'in-progress') return false
            return hasRedFlag(p)
        }).length

        const monthBuckets = new Map<string, number>()
        for (const p of rows) {
            if (!p.appliedAt) continue
            const d = new Date(p.appliedAt)
            if (Number.isNaN(d.getTime())) continue
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            monthBuckets.set(key, (monthBuckets.get(key) || 0) + 1)
        }
        const sortedMonths = [...monthBuckets.keys()].sort()
        const last12 = sortedMonths.slice(-12)
        const monthly = last12.map(key => ({
            key,
            label: formatMonthLabel(key),
            count: monthBuckets.get(key) || 0,
        }))
        const monthMax = Math.max(1, ...monthly.map(m => m.count))

        const statusMax = Math.max(1, newCount, inProgressCount, approvedCount, currentCount, rejectedCount)

        const rosterTotal = currentCount + pipelineCount + approvedCount + rejectedCount
        const donutSegments = [
            { key: 'current', label: 'Active fosters', count: currentCount, color: '#05aaaf' },
            { key: 'pipeline', label: 'In review', count: pipelineCount, color: '#7ecbcd' },
            { key: 'approved', label: 'Approved', count: approvedCount, color: '#3a9da0' },
            { key: 'rejected', label: 'Rejected', count: rejectedCount, color: '#9e9e9e' },
        ]
        const donutGradient = buildConicGradient(
            donutSegments.map(s => ({ count: s.count, color: s.color }))
        )

        return {
            newCount,
            inProgressCount,
            pipelineCount,
            approvedCount,
            currentCount,
            rejectedCount,
            flaggedInPipeline,
            monthly,
            monthMax,
            statusMax,
            rosterTotal,
            donutSegments,
            donutGradient,
        }
    }, [people])

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
                        <Link
                            href="/overview"
                            className={`${layoutStyles.navItem} ${pathname === '/overview' ? layoutStyles.navItemActive : ''}`}
                        >
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
                            className={`${layoutStyles.navItem} ${
                                pathname?.startsWith('/fosters') ? layoutStyles.navItemActive : ''
                            }`}
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
                            <button type="button" className={layoutStyles.profileLogout} onClick={signOut}>
                                Log Out
                            </button>
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
                        <h1 className={layoutStyles.topBarTitle}>Overview</h1>
                        <NotificationPanel />
                    </div>

                    {isLoading && people.length === 0 && (
                        <div className={styles.loadingBox}>Loading dashboard…</div>
                    )}
                    {error && <div className={styles.errorText}>{error}</div>}

                    {!isLoading && (
                        <div className={styles.contentPadding}>
                            <p className={styles.intro}>
                                Snapshot of your foster pipeline and roster,                                 based on the same applicant data as
                                Applicants and Fosters.
                            </p>

                            <div className={styles.statsGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Foster candidates (in review)</span>
                                    <span className={styles.statValue}>{stats.pipelineCount}</span>
                                    <span className={styles.statHint}>
                                        New + in progress (matches the Applicants list)
                                    </span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Active fosters</span>
                                    <span className={styles.statValue}>{stats.currentCount}</span>
                                    <span className={styles.statHint}>Active on the Fosters page</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Approved (not yet current)</span>
                                    <span className={styles.statValue}>{stats.approvedCount}</span>
                                    <span className={styles.statHint}>Approved, awaiting placement</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Red flags (in pipeline)</span>
                                    <span className={styles.statValue}>{stats.flaggedInPipeline}</span>
                                    <span className={styles.statHint}>Among new & in-progress with flags set</span>
                                </div>
                            </div>

                            <div className={styles.chartsRow}>
                                <div className={styles.panel}>
                                    <h2 className={styles.panelTitle}>Pipeline mix</h2>
                                    <p className={styles.panelSubtitle}>
                                        Share of records by status (people with an email in the sheet)
                                    </p>
                                    {stats.rosterTotal === 0 ? (
                                        <div className={styles.emptyChart}>No applicant data yet.</div>
                                    ) : (
                                        <div className={styles.donutRow}>
                                            <div className={styles.donutOuter}>
                                                <div
                                                    className={styles.donutRing}
                                                    style={{
                                                        background:
                                                            stats.donutGradient ??
                                                            'conic-gradient(#e0e0e0 0deg 360deg)',
                                                    }}
                                                />
                                                <div className={styles.donutHole} />
                                                <div className={styles.donutCenterLabel}>
                                                    <span className={styles.donutCenterValue}>
                                                        {stats.rosterTotal}
                                                    </span>
                                                    <span className={styles.donutCenterHint}>total</span>
                                                </div>
                                            </div>
                                            <div className={styles.donutLegend}>
                                                {stats.donutSegments.map(seg => (
                                                    <div key={seg.key} className={styles.legendItem}>
                                                        <span
                                                            className={styles.legendSwatch}
                                                            style={{ background: seg.color }}
                                                        />
                                                        <span className={styles.legendLabel}>{seg.label}</span>
                                                        <span className={styles.legendValue}>{seg.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.panel}>
                                    <h2 className={styles.panelTitle}>Applications by month</h2>
                                    <p className={styles.panelSubtitle}>
                                        Count of applications with a submission date (last 12 months in data)
                                    </p>
                                    {stats.monthly.length === 0 ? (
                                        <div className={styles.emptyChart}>
                                            No submission dates found — dates will appear as applicants include
                                            them.
                                        </div>
                                    ) : (
                                        <div className={styles.monthBars}>
                                            {stats.monthly.map(m => (
                                                <div key={m.key} className={styles.monthCol}>
                                                    <div className={styles.monthTrack}>
                                                        <div
                                                            className={styles.monthFill}
                                                            style={{
                                                                height: `${(m.count / stats.monthMax) * 100}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className={styles.monthCount}>{m.count}</span>
                                                    <span className={styles.monthLabel}>{m.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.panel}>
                                <h2 className={styles.panelTitle}>Headcount by status</h2>
                                <p className={styles.panelSubtitle}>Raw counts across workflow stages</p>
                                <div className={styles.statusBars}>
                                    {[
                                        {
                                            label: 'New',
                                            count: stats.newCount,
                                            className: styles.barNew,
                                        },
                                        {
                                            label: 'In progress',
                                            count: stats.inProgressCount,
                                            className: styles.barInProgress,
                                        },
                                        {
                                            label: 'Approved',
                                            count: stats.approvedCount,
                                            className: styles.barApproved,
                                        },
                                        {
                                            label: 'Active',
                                            count: stats.currentCount,
                                            className: styles.barCurrent,
                                        },
                                        {
                                            label: 'Rejected',
                                            count: stats.rejectedCount,
                                            className: styles.barRejected,
                                        },
                                    ].map(col => (
                                        <div key={col.label} className={styles.statusBarCol}>
                                            <div className={styles.statusBarTrack}>
                                                <div
                                                    className={`${styles.statusBarFill} ${col.className}`}
                                                    style={{
                                                        height: `${(col.count / stats.statusMax) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className={styles.statusBarCount}>{col.count}</span>
                                            <span className={styles.statusBarLabel}>{col.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    )
}

function formatMonthLabel(ym: string): string {
    const [y, m] = ym.split('-').map(Number)
    if (!y || !m) return ym
    const d = new Date(y, m - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
