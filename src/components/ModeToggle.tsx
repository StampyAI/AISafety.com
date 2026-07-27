'use client'

import Image from 'next/image'
import styles from './ModeToggle.module.css'

// The pill-shaped two-tab switch used by the listing pages' sticky bars
// (Upcoming/Recurring on /training, Online/In person on /events).
export default function ModeToggle<M extends string>({
  mode,
  onChange,
  ariaLabel,
  tabs,
}: {
  mode: M
  onChange: (m: M) => void
  ariaLabel: string
  tabs: { value: M; icon: string; label: string }[]
}) {
  return (
    <div className={styles.modeToggle} role="group" aria-label={ariaLabel}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          className={`paragraph-small-bold ${styles.modeTab} ${mode === tab.value ? styles.modeTabActive : ''}`}
          aria-pressed={mode === tab.value}
          onClick={() => onChange(tab.value)}
        >
          <Image src={tab.icon} alt="" width={16} height={16} unoptimized />
          {tab.label}
        </button>
      ))}
    </div>
  )
}
