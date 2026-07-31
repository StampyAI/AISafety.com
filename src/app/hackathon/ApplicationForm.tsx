'use client'

import { useState } from 'react'
import styles from './page.module.css'

const EMPTY = {
  name: '',
  email: '',
  skills: '',
  dietary: '',
  medical: '',
  roomPreference: '',
  emergencyContact: '',
  anythingElse: '',
  arrival: '',
  departure: '',
  // Honeypot – hidden from people, filled in by naive bots.
  website: '',
}

function Optional() {
  return <em className="color-teal-400">(optional)</em>
}

export default function ApplicationForm() {
  const [form, setForm] = useState(EMPTY)
  const [over18, setOver18] = useState(false)
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
        body: JSON.stringify({ ...form, over18 }),
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
      <div className={styles.field}>
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

      <div className={styles.field}>
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
          What skills or experience could you bring to this hackathon (link to
          CV welcome, but not required)?
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
        <label className="paragraph-small color-teal-300" htmlFor="dietary">
          Do you have any allergies or dietary needs/preferences? If so, please
          list the allergen and its severity. All food will be vegan.{' '}
          <Optional />
        </label>
        <textarea
          id="dietary"
          className={`text-field ${styles.textarea}`}
          value={form.dietary}
          onChange={set('dietary')}
        />
      </div>

      <div className={`${styles.field} ${styles.full}`}>
        <label className="paragraph-small color-teal-300" htmlFor="medical">
          Do you have any particular medical or mental health needs you would
          like us to know about? <Optional />
        </label>
        <textarea
          id="medical"
          className={`text-field ${styles.textarea}`}
          value={form.medical}
          onChange={set('medical')}
        />
      </div>

      <div className={`${styles.field} ${styles.full}`}>
        <label
          className="paragraph-small color-teal-300"
          htmlFor="roomPreference"
        >
          It&apos;s possible that some people may need to share a room – either
          all female or all male, max 2 people per room. Do you have a
          preference for having your own room?
        </label>
        <select
          id="roomPreference"
          className="text-field"
          value={form.roomPreference}
          onChange={set('roomPreference')}
          required
        >
          <option value="" disabled>
            Choose one
          </option>
          <option>Fine with sharing</option>
          <option>Weak preference for own room</option>
          <option>Strong preference for own room</option>
        </select>
      </div>

      <p className={`paragraph-xs color-teal-300 ${styles.full}`}>
        We expect most participants will arrive on 16 or 17 September and depart
        on 20 or 21 September. If you can&apos;t make the whole event, list your
        arrival and departure dates below. <Optional />
      </p>

      <div className={styles.field}>
        <label className="paragraph-small color-teal-300" htmlFor="arrival">
          When would you arrive?
        </label>
        <input
          id="arrival"
          type="date"
          className={`text-field ${styles.date}`}
          value={form.arrival}
          onChange={set('arrival')}
        />
      </div>

      <div className={styles.field}>
        <label className="paragraph-small color-teal-300" htmlFor="departure">
          When would you leave?
        </label>
        <input
          id="departure"
          type="date"
          className={`text-field ${styles.date}`}
          value={form.departure}
          onChange={set('departure')}
        />
      </div>

      <div className={`${styles.field} ${styles.full}`}>
        <label
          className="paragraph-small color-teal-300"
          htmlFor="emergencyContact"
        >
          Please provide the name and contact details of your emergency contact.
          We would use this only in case of a medical or other emergency.
        </label>
        <input
          id="emergencyContact"
          type="text"
          className="text-field"
          value={form.emergencyContact}
          onChange={set('emergencyContact')}
          required
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

      <label className={`flex items-center cursor-pointer ${styles.full}`}>
        <input
          type="checkbox"
          className="checkbox"
          checked={over18}
          onChange={e => setOver18(e.target.checked)}
          required
        />
        <span className="paragraph-small color-teal-300">
          I will be at least 18 years old by the date of this event
        </span>
      </label>

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
