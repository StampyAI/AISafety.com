'use client'

import { useState } from 'react'
import Icon from '@/components/Icon'
import { trackNewsletterSignup, trackNewsletterView } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'
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
   *  newsletter_signup event under this page, and a click on the card's
   *  link area records a newsletter_view. */
  trackingPage?: string
}) {
  const [email, setEmail] = useState('')
  // The publication's homepage — where the card link goes, so visitors can
  // read the newsletter before handing over an email.
  const homepageUrl = subscribeUrl.replace(/\/subscribe\/?$/, '')

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
      {/* The heading is a link stretched over the whole card, so clicking
          anywhere outside the email pill opens the newsletter itself —
          letting visitors read it without entering an email. */}
      <a
        href={trackingPage ? withUtm(homepageUrl, trackingPage) : homepageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`paragraph-small ${styles.heading}`}
        onClick={() => {
          if (trackingPage) trackNewsletterView(trackingPage)
        }}
      >
        {heading}
      </a>
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
