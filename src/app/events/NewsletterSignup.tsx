'use client'

import { useState } from 'react'
import Image from 'next/image'
import styles from './NewsletterSignup.module.css'

const SUBSCRIBE_URL = 'https://aisafetyeventsandtraining.substack.com/subscribe'

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    const url = trimmed
      ? `${SUBSCRIBE_URL}?email=${encodeURIComponent(trimmed)}`
      : SUBSCRIBE_URL
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <form className={`width-4-col ${styles.card}`} onSubmit={handleSubmit}>
      <p className={`paragraph-small ${styles.heading}`}>
        Get a weekly summary of upcoming events
      </p>
      <div className={styles.field}>
        <input
          type="email"
          className={`paragraph-small ${styles.input}`}
          placeholder="Your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button type="submit" className={styles.submit} aria-label="Subscribe">
          <Image
            src="/images/icons/arrow-right.svg"
            alt=""
            width={16}
            height={16}
            unoptimized
          />
        </button>
      </div>
    </form>
  )
}
