'use client'

import { useState } from 'react'
import Image from 'next/image'

// Card logo that removes itself (wrapper included) when the image fails to
// load, so a dead URL degrades to a logo-less card instead of the browser's
// broken-image icon. Matches ListingCard's onError behavior for the featured
// cards, which are server components and can't attach the handler themselves.
export default function CardLogo({ src, alt }: { src: string; alt: string }) {
  // Track the failed URL rather than a boolean so a new src gets a fresh try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (failedSrc === src) return null

  return (
    <div className="featured-img">
      <Image
        src={src}
        alt={alt}
        width={64}
        height={64}
        className="card-image"
        unoptimized
        onError={() => setFailedSrc(src)}
      />
    </div>
  )
}
