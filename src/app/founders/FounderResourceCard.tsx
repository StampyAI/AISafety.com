'use client'

import Image from 'next/image'
import type { FounderResource } from '@/lib/data/founders'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'

interface FounderResourceCardProps {
  resource: FounderResource
  /** The card's slot on the page ('1', '2'…) at click time. */
  placement?: string
}

// The /founders card: hand-written rather than ListingCard because it shows
// a labelled Type row. The admin Queue's "how it will look on the site"
// preview renders this same component.
export default function FounderResourceCard({
  resource,
  placement,
}: FounderResourceCardProps) {
  return (
    <a
      id={resource.id}
      href={withUtm(resource.website, 'Founders')}
      target="_blank"
      rel="noopener noreferrer"
      className="card"
      onClick={() =>
        trackListingClick(
          'Founders',
          resource.name,
          resource.website,
          resource.id,
          placement
        )
      }
    >
      <div className="flex items-center gap-16px padding-bottom-24px">
        <div className="featured-img">
          {resource.image && (
            <Image
              src={resource.image}
              alt=""
              className="card-image"
              width={64}
              height={64}
              unoptimized
              loading="eager"
              onError={e => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
        </div>
        <h3>{resource.name}</h3>
      </div>
      <p className="paragraph-small padding-bottom-24px">
        {resource.description}
      </p>
      <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
        Type
      </p>
      <p className="paragraph-small">{resource.type}</p>
    </a>
  )
}
