'use client'

import { useEffect, useState } from 'react'
import { formatRelativeDate } from '@/lib/format-date'

interface RelativeDateProps {
  iso: string
  className?: string
}

// Computes "Updated X days ago" in the browser using the user's actual current
// time, instead of at build time. The build-time approach made the text grow
// stale between deploys (e.g. a card stuck on "Updated 3 days ago" for a week).
// Renders nothing on first paint to avoid a hydration mismatch — the server has
// no way to know the viewer's current time.
export default function RelativeDate({ iso, className }: RelativeDateProps) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    setText(formatRelativeDate(iso))
  }, [iso])

  if (!text) return null
  return <p className={className}>{text}</p>
}
