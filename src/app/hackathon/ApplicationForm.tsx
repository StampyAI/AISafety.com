'use client'

import { useState } from 'react'
import styles from './page.module.css'

const EMPTY = {
  name: '',
  email: '',
  skills: '',
  links: '',
  anythingElse: '',
  // Honeypot – hidden from people, filled in by naive bots.
  website: '',
}

function Optional() {
  return <em className="color-teal-400">(optional)</em>
}

export default function ApplicationForm() {
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof typeof EMPTY) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => setForm({ ...form, [field]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/hackathon-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setDone(true)
      } else if (res.status === 429) {
        setError(
          'Too many applications from your connection – please try again in an hour.'
        )
      } else {
        setError(
          'Something went wrong sending your application. Please try again, or email bryceerobertson@gmail.com.'
        )
      }
    } catch {
      setError('Network error – please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="padding-bottom-56px">
        <h3 className="padding-bottom-16px">Application received!</h3>
        <p className="color-teal-300">
          We&apos;ve emailed you a confirmation. Application results will be
          announced by 21 August.
        </p>
      </div>
    )
  }

  return (
    <form
      className={`${styles.fields} padding-bottom-56px`}
      onSubmit={handleSubmit}
    >
      <div className={`${styles.field} ${styles.full}`}>
        <label className="paragraph-small color-teal-300" htmlFor="name">
          Full name
        </label>
        <input
          id="name"
          type="text"
          className="text-field"
          value={form.name}
          onChange={set('name')}
          required
        />
      </div>

      <div className={`${styles.field} ${styles.full}`}>
        <label className="paragraph-small color-teal-300" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="text-field"
          value={form.email}
          onChange={set('email')}
          required
        />
      </div>

      <div className={`${styles.field} ${styles.full}`}>
        <label className="paragraph-small color-teal-300" htmlFor="skills">
          What skills or experience could you bring to this hackathon?
        </label>
        <textarea
          id="skills"
          className={`text-field ${styles.textarea}`}
          value={form.skills}
          onChange={set('skills')}
          required
        />
      </div>

      <div className={`${styles.field} ${styles.full}`}>
        <label className="paragraph-small color-teal-300" htmlFor="links">
          Please share any personal links e.g. LinkedIn, LessWrong, CV, etc.{' '}
          <Optional />
        </label>
        <textarea
          id="links"
          className={`text-field ${styles.textarea}`}
          value={form.links}
          onChange={set('links')}
        />
      </div>

      <div className={`${styles.field} ${styles.full}`}>
        <label
          className="paragraph-small color-teal-300"
          htmlFor="anythingElse"
        >
          Anything else you&apos;d like us to know? <Optional />
        </label>
        <textarea
          id="anythingElse"
          className={`text-field ${styles.textarea}`}
          value={form.anythingElse}
          onChange={set('anythingElse')}
        />
      </div>

      <div className={styles.hp} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={set('website')}
        />
      </div>

      <div className={styles.full}>
        <button type="submit" className="button-primary" disabled={busy}>
          {busy ? 'Applying…' : 'Apply'}
        </button>
        {error && (
          <p className="paragraph-small color-orange margin-top-16px">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}
