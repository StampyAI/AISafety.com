'use client'

import { useState } from 'react'
import Image from 'next/image'
import styles from './NewsletterSignup.module.css'

// Substack's bot protection rejects any signup request not made by the
// visitor's own browser on substack.com itself, so the form hands off to
// Substack's subscribe page with the email pre-filled (one click to finish).
const SUBSCRIBE_URL = 'https://aisafetyeventsandtraining.substack.com/subscribe'

type Status = 'idle' | 'success' | 'error'

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    // Must be synchronous within the submit event, or popup blockers kill it.
    const tab = window.open(
      `${SUBSCRIBE_URL}?email=${encodeURIComponent(trimmed)}`,
      '_blank'
    )
    if (tab) tab.opener = null
    // Best-effort log so every address is recoverable even if the visitor
    // doesn't finish on Substack. Never blocks or fails the signup UX.
    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed, newsletter: 'events' }),
      keepalive: true,
    }).catch(() => {})
    setStatus(tab ? 'success' : 'error')
  }

  return (
    <form className={`width-4-col ${styles.card}`} onSubmit={submit}>
      <p className={`paragraph-small ${styles.heading}`}>
        Get a weekly summary of upcoming events
      </p>
      {status === 'success' ? (
        <p
          className={`paragraph-xs color-light-teal ${styles.status}`}
          aria-live="polite"
        >
          Almost done — finish subscribing in the Substack tab that just opened.
        </p>
      ) : (
        <>
          <div className={styles.field}>
            <input
              type="email"
              required
              className={`paragraph-small ${styles.input}`}
              placeholder="Your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button
              type="submit"
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
            </button>
          </div>
          {status === 'error' && (
            <p
              className={`paragraph-xs color-teal-300 ${styles.status}`}
              aria-live="polite"
            >
              The signup tab didn&apos;t open. You can{' '}
              <a
                href={`${SUBSCRIBE_URL}?email=${encodeURIComponent(email.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="color-white"
              >
                subscribe on Substack
              </a>{' '}
              instead.
            </p>
          )}
        </>
      )}
    </form>
  )
}
