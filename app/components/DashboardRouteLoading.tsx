import ProtectedRoute from '@/app/components/ProtectedRoute'
import { DashboardShell } from '@/app/components/DashboardShell'
import styles from './DashboardRouteLoading.module.css'

type LoadingKind = 'overview' | 'table' | 'detail'

type DashboardRouteLoadingProps = {
  title: string
  kind?: LoadingKind
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return <span className={`${styles.skeleton} ${className}`} aria-hidden="true" />
}

function OverviewLoading() {
  return (
    <>
      <div className={styles.statGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div className={styles.statCard} key={index}>
            <SkeletonLine className={styles.statLabel} />
            <SkeletonLine className={styles.statValue} />
          </div>
        ))}
      </div>
      <div className={styles.panelGrid}>
        {Array.from({ length: 2 }).map((_, panelIndex) => (
          <section className={styles.panel} key={panelIndex}>
            <div className={styles.panelHeader}>
              <SkeletonLine className={styles.panelTitle} />
              {panelIndex === 0 && <SkeletonLine className={styles.panelPill} />}
            </div>
            <div className={styles.listRows}>
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <div className={styles.listRow} key={rowIndex}>
                  <SkeletonLine className={styles.avatar} />
                  <span className={styles.rowCopy}>
                    <SkeletonLine className={styles.rowTitle} />
                    <SkeletonLine className={styles.rowMeta} />
                  </span>
                  <SkeletonLine className={styles.rowTail} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

function TableLoading() {
  return (
    <>
      <div className={styles.toolbar}>
        <SkeletonLine className={styles.search} />
        <SkeletonLine className={styles.filter} />
      </div>
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonLine className={styles.tableHeadCell} key={index} />
          ))}
        </div>
        {Array.from({ length: 9 }).map((_, rowIndex) => (
          <div className={styles.tableRow} key={rowIndex}>
            {Array.from({ length: 5 }).map((_, cellIndex) => (
              <SkeletonLine
                className={cellIndex === 0 ? styles.tableCellWide : styles.tableCell}
                key={cellIndex}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

function DetailLoading() {
  return (
    <div className={styles.detailGrid}>
      <section className={styles.detailMain}>
        <SkeletonLine className={styles.detailTitle} />
        <SkeletonLine className={styles.detailSub} />
        {Array.from({ length: 6 }).map((_, index) => (
          <div className={styles.detailRow} key={index}>
            <SkeletonLine className={styles.detailLabel} />
            <SkeletonLine className={styles.detailValue} />
          </div>
        ))}
      </section>
      <aside className={styles.detailSide}>
        <SkeletonLine className={styles.panelTitle} />
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonLine className={styles.sideLine} key={index} />
        ))}
      </aside>
    </div>
  )
}

export function DashboardRouteLoading({ title, kind = 'table' }: DashboardRouteLoadingProps) {
  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className={styles.topBar}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.actions}>
            <SkeletonLine className={styles.icon} />
            <SkeletonLine className={styles.profile} />
          </div>
        </div>
        <main className={styles.content} role="status" aria-live="polite" aria-label={`Loading ${title}`}>
          {kind === 'overview' ? <OverviewLoading /> : kind === 'detail' ? <DetailLoading /> : <TableLoading />}
        </main>
      </DashboardShell>
    </ProtectedRoute>
  )
}
