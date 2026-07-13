'use client'

import { useState } from 'react'
import Image from 'next/image'
import styles from './NewsletterSignup.module.css'

const NEWSLETTER_URL = 'https://aisafetyeventsandtraining.substack.com/'

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')

  return (
    <form
      className={`width-4-col ${styles.card}`}
      onSubmit={e => e.preventDefault()}
    >
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
        <a
          href={NEWSLETTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.submit}
          aria-label="Subscribe"
        >
          <Image
            src="/images/icons/arrow-right.svg"
            alt=""
            width={16}
            height={16}
            unoptimized
          />
        </a>
      </div>
    </form>
  )
}
