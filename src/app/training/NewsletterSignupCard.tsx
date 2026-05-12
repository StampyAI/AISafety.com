'use client'

import { useState, FormEvent } from 'react'
import styles from './page.module.css'

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

export default function NewsletterSignupCard() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus({ kind: 'submitting' })

    const response = await fetch('/api/newsletter-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setStatus({
        kind: 'error',
        message: data.error || 'Could not subscribe. Please try again later.',
      })
      return
    }

    setStatus({ kind: 'success' })
    setEmail('')
  }

  return (
    <div className={styles['signup-card']}>
      <p className={`paragraph-xs color-white ${styles['signup-title']}`}>
        Get a weekly summary of all new events and training
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-12px">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Your email"
          className={`paragraph-small ${styles['signup-input']}`}
          disabled={status.kind === 'submitting'}
        />
        <button
          type="submit"
          className="button-secondary"
          disabled={status.kind === 'submitting'}
        >
          {status.kind === 'submitting' ? 'Subscribing…' : 'Get the newsletter'}
        </button>
      </form>
      {status.kind === 'success' && (
        <p className={`paragraph-xs ${styles['signup-message']}`}>
          Subscribed. Check your inbox to confirm.
        </p>
      )}
      {status.kind === 'error' && (
        <p
          className={`paragraph-xs ${styles['signup-message']} ${styles['signup-message-error']}`}
        >
          {status.message}
        </p>
      )}
    </div>
  )
}
