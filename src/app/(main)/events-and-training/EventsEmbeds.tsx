'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './page.module.css'

const EMBEDS = [
  {
    src: 'https://airtable.com/embed/appF8XfZUGXtfi40E/shrLgl03tMK4q6cyc?viewControls=on',
    height: 2300,
    className: `${styles['airtable-embed']} margin-bottom-40px`,
  },
  {
    src: 'https://airtable.com/embed/appF8XfZUGXtfi40E/shrZ4Uh9OsbUryfjp',
    height: 2880,
    className: `${styles['airtable-embed']} hide-mobile`,
  },
  {
    src: 'https://airtable.com/embed/appF8XfZUGXtfi40E/shrbap2hy8Yd3xojA',
    height: 1000,
    className: `${styles['airtable-embed']} hide-mobile`,
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
      <div className={styles['airtable-section']}>
        {renderEmbed(0)}
        {renderEmbed(1)}
      </div>

      <div className="container-default">
        <h2 className="hide-mobile">Open for application/registration</h2>
      </div>

      <div className={styles['airtable-section']}>{renderEmbed(2)}</div>
    </>
  )
}
