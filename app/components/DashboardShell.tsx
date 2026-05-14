'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/app/components/AuthProvider'
import { SidebarGeneralSection } from '@/app/components/SidebarGeneralSection'
import { SidebarAccountSection } from '@/app/components/SidebarAccountSection'
import { SidebarProfile } from '@/app/components/SidebarProfile'
import layoutStyles from '@/app/candidates/candidates.module.css'

function MenuGlyph({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

type DashboardShellContentProps = {
  children: React.ReactNode
  pathname: string | null
}

function DashboardShellContent({ children, pathname }: DashboardShellContentProps) {
  const { user, role, signOut } = useAuth()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)')
    function clearIfDesktop() {
      if (mq.matches) setNavOpen(false)
    }
    mq.addEventListener('change', clearIfDesktop)
    return () => mq.removeEventListener('change', clearIfDesktop)
  }, [])

  useEffect(() => {
    if (!navOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  useEffect(() => {
    if (!navOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [navOpen])

  const fostersActive = pathname?.startsWith('/fosters') ?? false

  return (
    <div
      className={layoutStyles.pageWrapper}
      data-nav-open={navOpen ? 'true' : undefined}
    >
      <header className={layoutStyles.mobileTopBar}>
        <Link href="/overview" className={layoutStyles.mobileTopBarLogo} onClick={() => setNavOpen(false)}>
          <Image src="/assets/logo.svg" alt="Wags & Walks" width={132} height={48} priority />
        </Link>
        <button
          type="button"
          className={layoutStyles.mobileMenuBtn}
          aria-expanded={navOpen}
          aria-controls="app-dashboard-sidebar"
          aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setNavOpen(o => !o)}
        >
          <MenuGlyph open={navOpen} />
          <span className={layoutStyles.mobileMenuBtnLabel}>{navOpen ? 'Close' : 'Menu'}</span>
        </button>
      </header>

      {navOpen && (
        <button
          type="button"
          className={layoutStyles.navBackdrop}
          aria-label="Close navigation menu"
          tabIndex={-1}
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        id="app-dashboard-sidebar"
        className={`${layoutStyles.sidebar} ${navOpen ? layoutStyles.sidebarOpen : ''}`}
      >
        <div className={layoutStyles.sidebarHeader}>
          <div className={layoutStyles.sidebarLogo}>
            <Image src="/assets/logo.svg" alt="Wags & Walks" width={160} height={60} priority />
          </div>
        </div>

        <SidebarGeneralSection>
          <Link
            href="/overview"
            className={`${layoutStyles.navItem} ${pathname === '/overview' ? layoutStyles.navItemActive : ''}`}
            onClick={() => setNavOpen(false)}
          >
            <img src="/assets/Overview.svg" alt="" width={18} height={18} />
            Overview
          </Link>
          <Link
            href="/candidates"
            className={`${layoutStyles.navItem} ${pathname === '/candidates' || pathname?.startsWith('/applicants') ? layoutStyles.navItemActive : ''}`}
            onClick={() => setNavOpen(false)}
          >
            <img src="/assets/candidates.svg" alt="" width={18} height={18} />
            Applicants
          </Link>
          <Link
            href="/directory"
            className={`${layoutStyles.navItem} ${pathname === '/directory' ? layoutStyles.navItemActive : ''}`}
            onClick={() => setNavOpen(false)}
          >
            <img src="/assets/Search.svg" alt="" width={18} height={18} />
            Directory
          </Link>
          <Link
            href="/fosters"
            className={`${layoutStyles.navItem} ${fostersActive ? layoutStyles.navItemActive : ''}`}
            onClick={() => setNavOpen(false)}
          >
            <img src="/assets/fosters.svg" alt="" width={18} height={18} />
            Fosters
          </Link>
        </SidebarGeneralSection>

        <SidebarAccountSection pathname={pathname} role={role} />
        <SidebarProfile user={user} role={role} signOut={signOut} />
      </aside>

      <div className={layoutStyles.mainContent}>{children}</div>
    </div>
  )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <DashboardShellContent key={pathname ?? ''} pathname={pathname}>
      {children}
    </DashboardShellContent>
  )
}
