'use client'

import Image from 'next/image'
import type { Advisor } from '@/lib/data/advisors'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'

interface AdvisorCardProps {
  advisor: Advisor
  /** The card's slot on the page ('1', '2'…) at click time. */
  placement?: string
}

// The /advisors card: hand-written rather than ListingCard because it shows
// labelled Focus and Status rows. The admin Queue's "how it will look on the
// site" preview renders this same component.
export default function AdvisorCard({ advisor, placement }: AdvisorCardProps) {
  return (
    <a
      href={withUtm(advisor.url, 'Advisors')}
      target="_blank"
      rel="noopener noreferrer"
      className="card"
      onClick={() =>
        trackListingClick(
          'Advisors',
          advisor.name,
          advisor.url,
          advisor.id,
          placement
        )
      }
    >
      <div className="flex items-center gap-16px padding-bottom-24px">
        <div className="featured-img">
          {advisor.logo && (
            <Image
              src={advisor.logo}
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
        <h3>{advisor.name}</h3>
      </div>
      <p className="paragraph-small padding-bottom-24px">
        {advisor.description}
      </p>
      <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
        Focus
      </p>
      <p className="paragraph-small padding-bottom-16px">{advisor.focus}</p>
      <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
        Status
      </p>
      <p className="paragraph-small">{advisor.status}</p>
    </a>
  )
}
