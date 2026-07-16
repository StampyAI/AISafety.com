'use client'

import { useRef, useState } from 'react'
import { DONATION_GUIDE_LAST_UPDATED } from '@/lib/donation-guide-date'
import { formatDate } from '@/lib/format-date'
import styles from './page.module.css'
import { DONATION_TABS, type DonationTabKey } from './content'

const donationGuideDate = formatDate(new Date(DONATION_GUIDE_LAST_UPDATED))

export default function DonationGuidePage() {
  const [activeTab, setActiveTab] = useState<DonationTabKey>('tab1')
  const [fading, setFading] = useState(false)
  const pendingTab = useRef<DonationTabKey | null>(null)

  function handleTabClick(key: DonationTabKey) {
    if (key === activeTab) return
    pendingTab.current = key
    setFading(true)
    setTimeout(() => {
      setActiveTab(pendingTab.current!)
      pendingTab.current = null
      setFading(false)
    }, 100)
  }

  return (
    <div>
      <div className="container-default">
        <h1 className="padding-top-56px padding-bottom-8px">Donation guide</h1>
        <div className="padding-bottom-40px paragraph-small color-teal-300">
          Last updated: {donationGuideDate}
        </div>
        <h2 className="width-7-col padding-bottom-56px">
          This guide can help you determine the most effective way to{' '}
          <span className="color-light-teal">
            financially support work on AI safety,
          </span>{' '}
          given the funds and time you have available.
        </h2>
        <p className="padding-bottom-32px">Choose a donation amount:</p>

        <div className={styles.tabsContainer}>
          <div className={`${styles.tabsMenu} width-3-col`}>
            {DONATION_TABS.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tabLink} ${activeTab === tab.key ? styles.tabLinkActive : ''}`}
                onClick={() => handleTabClick(tab.key)}
              >
                <p>{tab.label}</p>
              </button>
            ))}
          </div>

          <div
            className={`width-9-col ${styles.tabContent} ${fading ? styles.tabContentFading : ''}`}
          >
            {DONATION_TABS.map(tab => {
              const Content = tab.Content
              return activeTab === tab.key ? <Content key={tab.key} /> : null
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
