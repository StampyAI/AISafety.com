'use client'

import { useEffect } from 'react'

// A link like /training?view=recurring#rec… (the admin Queue's "see it on
// the site" link) names a card that only exists once the page has hydrated
// and picked its view, by which time the browser has given up on the hash.
// This keeps looking for the target for a few seconds and scrolls to it
// once, then leaves the visitor alone. Nothing happens without a hash or
// when the browser already managed the jump.
export default function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    let tries = 0
    const timer = window.setInterval(() => {
      const el = document.getElementById(id)
      if (el) {
        window.clearInterval(timer)
        el.scrollIntoView({ block: 'start' })
      } else if (++tries > 40) {
        window.clearInterval(timer)
      }
    }, 150)
    return () => window.clearInterval(timer)
  }, [])
  return null
}
