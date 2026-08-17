'use client'

import { Fragment, useEffect, useState } from 'react'
import base from '../page.module.css'
import styles from './page.module.css'
import {
  FIELDS,
  NOTES_KEY,
  OTHER_MAX,
  PROJECTS,
  RATINGS,
  SECTIONS,
  WHY_FROM,
  WHY_MAX,
  maxLen,
  needsTravelNotes,
  type Field,
} from './questions'

const PROJECTS_KEY = FIELDS.find(f => f.type === 'projects')?.key ?? 'projects'

type ProjectAnswer = { rating: number; why: string }

/** Answers by field key. Checkbox groups hold the ticked options; their
 *  free-text "Other" box is stored under `${key}Other`. */
type Values = {
  text: Record<string, string>
  multi: Record<string, string[]>
  agree: Record<string, boolean>
  projects: Record<string, ProjectAnswer>
}

const EMPTY: Values = {
  text: { website: '' },
  multi: {},
  agree: {},
  projects: {},
}

function Optional() {
  return <em className="color-teal-400">(optional)</em>
}

/** Render a label/hint string, turning [text](url) into links. */
function Text({ children }: { children: string }) {
  const parts = children.split(/(\[[^\]]+\]\([^)]+\))/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        return m ? (
          <a
            key={i}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="color-light-teal"
          >
            {m[1]}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      })}
    </>
  )
}

/** Textareas grow with their content instead of scrolling internally. */
function grow(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + 2}px`
}

export default function DetailsForm() {
  const [values, setValues] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const setText = (key: string, value: string) =>
    setValues(v => ({ ...v, text: { ...v.text, [key]: value } }))
  const toggle = (key: string, option: string) =>
    setValues(v => {
      const current = v.multi[key] ?? []
      const next = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option]
      return { ...v, multi: { ...v.multi, [key]: next } }
    })
  const setAgree = (key: string, checked: boolean) =>
    setValues(v => ({ ...v, agree: { ...v.agree, [key]: checked } }))
  const setProject = (name: string, patch: Partial<ProjectAnswer>) =>
    setValues(v => ({
      ...v,
      projects: {
        ...v.projects,
        [name]: { ...(v.projects[name] ?? { rating: 0, why: '' }), ...patch },
      },
    }))

  // Rules the browser can't express with `required` alone are fed to it as
  // custom validity, so a failed submit scrolls to and flags the field like
  // any other: at least one option in required checkbox groups, and travel
  // notes when a check-in/out date is "Other". (Ratings use `required` on the
  // radios; the "why" box is only rendered when it's required.)
  useEffect(() => {
    for (const f of FIELDS) {
      if (f.type !== 'checkboxes' || !f.required) continue
      const first = document.querySelector<HTMLInputElement>(
        `#${f.key} input[type="checkbox"]`
      )
      const ok =
        (values.multi[f.key]?.length ?? 0) > 0 ||
        !!values.text[`${f.key}Other`]?.trim()
      first?.setCustomValidity(ok ? '' : 'Please choose at least one option.')
    }
    const notes = document.getElementById(
      NOTES_KEY
    ) as HTMLTextAreaElement | null
    notes?.setCustomValidity(
      needsTravelNotes(values.text)
        ? 'Please tell us your dates here, since you picked "Other" above.'
        : ''
    )
  }, [values])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/hackathon-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values.text,
          ...values.multi,
          ...values.agree,
          [PROJECTS_KEY]: values.projects,
        }),
      })
      if (res.ok) {
        setDone(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (res.status === 429) {
        setError(
          'Too many submissions from your connection – please try again in an hour.'
        )
      } else {
        setError(
          'Something went wrong sending your details. Please try again, or email bryceerobertson@gmail.com.'
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
        <h3 className="padding-bottom-16px">Thanks!</h3>
        <p className="color-teal-300">
          We&apos;ve emailed you a copy of your answers. If anything changes –
          especially your dates – just reply to that email. See you in
          Blackpool!
        </p>
      </div>
    )
  }

  function renderField(f: Field) {
    const width = 'half' in f && f.half ? '' : base.full
    const label = (
      <>
        <Text>{f.label}</Text> {!f.required && <Optional />}
        {f.hint && (
          <>
            <br />
            <span className="paragraph-xs color-teal-400">
              <Text>{f.hint}</Text>
            </span>
          </>
        )}
      </>
    )

    switch (f.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <div key={f.key} className={`${base.field} ${width}`}>
            <label className="paragraph-small color-teal-300" htmlFor={f.key}>
              {label}
            </label>
            <input
              id={f.key}
              type={f.type}
              className="text-field"
              value={values.text[f.key] ?? ''}
              onChange={e => setText(f.key, e.target.value)}
              required={f.required}
              maxLength={maxLen(f)}
            />
          </div>
        )

      case 'textarea':
        return (
          <div key={f.key} className={`${base.field} ${width}`}>
            <label className="paragraph-small color-teal-300" htmlFor={f.key}>
              {label}
            </label>
            <textarea
              id={f.key}
              className={`text-field ${base.textarea}`}
              value={values.text[f.key] ?? ''}
              onChange={e => {
                grow(e.target)
                setText(f.key, e.target.value)
              }}
              required={f.required}
              maxLength={maxLen(f)}
            />
          </div>
        )

      case 'select':
        return (
          <div key={f.key} className={`${base.field} ${width}`}>
            <label className="paragraph-small color-teal-300" htmlFor={f.key}>
              {label}
            </label>
            <select
              id={f.key}
              className="text-field cursor-pointer"
              value={values.text[f.key] ?? ''}
              onChange={e => setText(f.key, e.target.value)}
              required={f.required}
            >
              <option value="">Select…</option>
              {f.options.map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        )

      case 'checkboxes': {
        const ticked = values.multi[f.key] ?? []
        // The free-text box is sent as `${key}Other`; whether it's open is
        // UI-only state kept under a separate key.
        const otherKey = `${f.key}Other`
        const openKey = `${f.key}OtherOpen`
        const otherOpen = values.agree[openKey] ?? false
        return (
          <div
            key={f.key}
            id={f.key}
            role="group"
            aria-labelledby={`${f.key}-label`}
            className={`${base.field} ${base.full}`}
          >
            <p id={`${f.key}-label`} className="paragraph-small color-teal-300">
              {label}
            </p>
            <div className="flex flex-col gap-8px">
              {f.options.map(o => (
                <label key={o} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={ticked.includes(o)}
                    onChange={() => toggle(f.key, o)}
                  />
                  <span className="paragraph-small color-white">{o}</span>
                </label>
              ))}
              {f.other && (
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={otherOpen}
                    onChange={e => {
                      setAgree(openKey, e.target.checked)
                      if (!e.target.checked) setText(otherKey, '')
                    }}
                  />
                  <span className="paragraph-small color-white">{f.other}</span>
                </label>
              )}
              {f.other && otherOpen && (
                <input
                  type="text"
                  className="text-field"
                  aria-label={f.other}
                  value={values.text[otherKey] ?? ''}
                  onChange={e => setText(otherKey, e.target.value)}
                  maxLength={OTHER_MAX}
                  autoFocus
                />
              )}
            </div>
          </div>
        )
      }

      case 'agree':
        return (
          <label
            key={f.key}
            className={`flex items-center cursor-pointer ${base.full}`}
          >
            <input
              type="checkbox"
              className="checkbox"
              checked={values.agree[f.key] ?? false}
              onChange={e => setAgree(f.key, e.target.checked)}
              required={f.required}
            />
            <span className="paragraph-small color-white">{label}</span>
          </label>
        )

      case 'projects':
        return (
          <div
            key={f.key}
            id={f.key}
            role="group"
            aria-labelledby={`${f.key}-label`}
            className={`${base.field} ${base.full}`}
          >
            <p id={`${f.key}-label`} className="paragraph-small color-teal-300">
              {label}
            </p>
            <div className="flex flex-col gap-24px">
              {PROJECTS.map((p, i) => {
                const answer = values.projects[p.name]
                return (
                  <div key={p.name} className={styles.project}>
                    <div>
                      <p className="paragraph-small color-white">{p.name}</p>
                      <p className="paragraph-xs color-teal-400">{p.blurb}</p>
                    </div>
                    <div
                      className="flex gap-16px"
                      role="radiogroup"
                      aria-label={p.name}
                    >
                      {RATINGS.map(r => (
                        <label
                          key={r}
                          className="flex items-center cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`project-${i}`}
                            className={`checkbox ${styles.radio}`}
                            checked={answer?.rating === r}
                            // Dropping below WHY_FROM hides the "why" box, so
                            // clear it rather than send text they can't see.
                            onChange={() =>
                              setProject(
                                p.name,
                                r >= WHY_FROM
                                  ? { rating: r }
                                  : { rating: r, why: '' }
                              )
                            }
                            required={f.required}
                          />
                          <span className="paragraph-small color-white">
                            {r}
                          </span>
                        </label>
                      ))}
                    </div>
                    {(answer?.rating ?? 0) >= WHY_FROM && (
                      <textarea
                        className={`text-field ${base.textarea} ${base.full}`}
                        aria-label={`Why are you excited about ${p.name}, and what could you contribute?`}
                        placeholder="Why are you excited, and what could you contribute?"
                        value={answer?.why ?? ''}
                        onChange={e => {
                          grow(e.target)
                          setProject(p.name, { why: e.target.value })
                        }}
                        required
                        maxLength={WHY_MAX}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
    }
  }

  return (
    <form
      className={`${base.fields} padding-bottom-56px`}
      onSubmit={handleSubmit}
    >
      {SECTIONS.map((s, i) => (
        <Fragment key={s.title}>
          <div className={`${base.full} ${i > 0 ? 'padding-top-24px' : ''}`}>
            <h3 className={s.intro ? 'padding-bottom-8px' : ''}>{s.title}</h3>
            {s.intro && (
              <p className="paragraph-small color-teal-300">{s.intro}</p>
            )}
          </div>
          {s.fields.map(renderField)}
        </Fragment>
      ))}

      <div className={base.hp} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.text.website}
          onChange={e => setText('website', e.target.value)}
        />
      </div>

      <div className={base.full}>
        <button type="submit" className="button-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send details'}
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
