'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from '../admin.module.css'

export default function LoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError('Wrong password')
        setBusy(false)
        return
      }
      router.push('/admin/chatbot/playground')
      router.refresh()
    } catch {
      setError('Network error')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={styles.loginForm}>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
        className={styles.loginInput}
        disabled={busy}
      />
      <button
        type="submit"
        className={styles.loginButton}
        disabled={busy || password.length === 0}
      >
        {busy ? 'Checking…' : 'Sign in'}
      </button>
      {error && <div className={styles.loginError}>{error}</div>}
    </form>
  )
}
