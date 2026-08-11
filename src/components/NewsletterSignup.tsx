'use client'

import { useState } from 'react'
import Icon from '@/components/Icon'
import { trackNewsletterSignup } from '@/lib/analytics'
import styles from './NewsletterSignup.module.css'

const DEFAULT_SUBSCRIBE_URL =
  'https://aisafetyeventsandtraining.substack.com/subscribe'

// Temporary Substack subscribe box shared by /events, /training, and /funding
// until the custom newsletter platform lands.
export default function NewsletterSignup({
  heading = 'Get a weekly summary of all new events and training programs',
  subscribeUrl = DEFAULT_SUBSCRIBE_URL,
  trackingPage,
}: {
  heading?: string
  /** Substack subscribe page the box opens (defaults to events & training). */
  subscribeUrl?: string
  /** Analytics page name (e.g. 'Events'). When set, a submit records a
   *  newsletter_signup event under this page. */
  trackingPage?: string
}) {
  const [email, setEmail] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // On the form, not the button, so Enter submits count the same as clicks.
    if (trackingPage) trackNewsletterSignup(trackingPage)
    const trimmed = email.trim()
    const url = trimmed
      ? `${subscribeUrl}?email=${encodeURIComponent(trimmed)}`
      : subscribeUrl
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <form className={`width-4-col ${styles.card}`} onSubmit={handleSubmit}>
      <p className={`paragraph-small ${styles.heading}`}>{heading}</p>
      {/* A label so clicks anywhere on the pill focus the input. */}
      <label className={styles.field}>
        <input
          type="email"
          className={`paragraph-small ${styles.input}`}
          placeholder="Your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button type="submit" className={styles.submit} aria-label="Subscribe">
          <Icon
            src="/images/icons/arrow-right.svg"
            size={16}
            className="color-white"
          />
        </button>
      </label>
    </form>
  )
}
