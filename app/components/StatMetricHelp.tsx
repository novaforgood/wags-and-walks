'use client'

import type { ReactNode } from 'react'
import styles from './StatMetricHelp.module.css'

type Props = {
  label: string
  /** Short label for the (i) button, e.g. "How new applicants this week is calculated" */
  helpAriaLabel: string
  children: ReactNode
  /** Optional control beside the label (month picker, etc.) */
  trailing?: ReactNode
}

export default function StatMetricHelp({ label, helpAriaLabel, children, trailing }: Props) {
  return (
    <div className={styles.labelRow}>
      <span className={styles.label}>{label}</span>
      {trailing}
      <div className={styles.helpWrap}>
        <button
          type="button"
          className={styles.helpBtn}
          aria-label={helpAriaLabel}
        >
          i
        </button>
        <div className={styles.helpPop} role="tooltip">
          {children}
        </div>
      </div>
    </div>
  )
}
