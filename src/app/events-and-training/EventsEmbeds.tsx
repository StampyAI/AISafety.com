'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './page.module.css'

const EMBEDS = [
  {
    src: 'https://airtable.com/embed/appF8XfZUGXtfi40E/shrLgl03tMK4q6cyc?viewControls=on',
    height: 2800,
    className: `${styles['airtable-embed']} ${styles['airtable-embed-mobile']} margin-bottom-40px`,
  },
  {
    src: 'https://airtable.com/embed/appF8XfZUGXtfi40E/shrZ4Uh9OsbUryfjp',
    height: 3100,
    className: `${styles['airtable-embed']} margin-bottom-40px`,
  },
  {
    src: 'https://airtable.com/embed/appF8XfZUGXtfi40E/shrbap2hy8Yd3xojA',
    height: 1350,
    className: `${styles['airtable-embed']} margin-bottom-40px`,
  },
]

export default function EventsEmbeds() {
  const [activated, setActivated] = useState([false, false, false])
  const placeholderRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])

  // IntersectionObserver: activate the first embed that scrolls into view
  useEffect(() => {
    const observers: IntersectionObserver[] = []

    placeholderRefs.current.forEach((el, i) => {
      if (!el || activated[i]) return
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActivated(prev => {
              const next = [...prev]
              next[i] = true
              return next
            })
            observer.disconnect()
          }
        },
        { rootMargin: '500px' }
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach(o => o.disconnect())
  }, [activated])

  // When any embed finishes loading, activate the next unloaded one
  const handleLoad = useCallback(() => {
    setActivated(prev => {
      const next = [...prev]
      const firstInactive = next.indexOf(false)
      if (firstInactive !== -1) next[firstInactive] = true
      return next
    })
  }, [])

  function renderEmbed(index: number) {
    const embed = EMBEDS[index]
    if (!activated[index]) {
      return (
        <div
          ref={el => {
            placeholderRefs.current[index] = el
          }}
          style={{ height: embed.height }}
          className={embed.className}
        />
      )
    }
    return (
      <iframe
        src={embed.src}
        frameBorder={0}
        width="100%"
        height={embed.height}
        style={{ background: 'transparent', border: '1px solid #ccc' }}
        className={embed.className}
        onLoad={handleLoad}
      />
    )
  }

  return (
    <>
      <div className="container-wide">{renderEmbed(0)}</div>
      <div className="container-wide hide-mobile">{renderEmbed(1)}</div>

      <div className="container-default hide-mobile">
        <h2 className="padding-bottom-24px">
          Open for application/registration
        </h2>
      </div>

      <div className="container-wide hide-mobile">{renderEmbed(2)}</div>
    </>
  )
}
