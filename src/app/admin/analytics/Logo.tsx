'use client'

/* eslint-disable @next/next/no-img-element -- tiny internal-admin logos from
   arbitrary external/cached hosts; next/image optimization isn't worth the
   remote-pattern config here. */

import { useState } from 'react'
import styles from './analytics.module.css'

/** A small listing logo for dashboard rows. Always renders a fixed-size slot so
 *  rows stay aligned: the image when it loads, a neutral box if it's missing or
 *  fails to load (a server component can't use onError, hence this client bit). */
export default function Logo({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return <span className={styles.logoFallback} aria-hidden="true" />
  }
  return (
    <img
      src={src}
      alt=""
      className={styles.logo}
      onError={() => setFailed(true)}
    />
  )
}
