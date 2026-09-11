'use client'

import Image from 'next/image'
import type { MediaChannel } from '@/lib/data/media-channels'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'

interface MediaChannelCardProps {
  channel: MediaChannel
  /** The card's slot on the page ('1', '2'…) at click time. */
  placement?: string
}

// The /media-channels card: hand-written rather than ListingCard because it
// shows a labelled Type row. The admin Queue's "how it will look on the
// site" preview renders this same component.
export default function MediaChannelCard({
  channel,
  placement,
}: MediaChannelCardProps) {
  return (
    <a
      id={channel.id}
      href={withUtm(channel.url, 'Media channels')}
      target="_blank"
      rel="noopener noreferrer"
      className="card"
      onClick={() =>
        trackListingClick(
          'Media channels',
          channel.name,
          channel.url,
          channel.id,
          placement
        )
      }
    >
      <div className="flex items-center gap-16px padding-bottom-24px">
        <div className="featured-img">
          {channel.logo && (
            <Image
              src={channel.logo}
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
        <h3>{channel.name}</h3>
      </div>
      <p className="paragraph-small padding-bottom-24px">
        {channel.description}
      </p>
      <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
        Type
      </p>
      <p className="paragraph-small">{channel.type}</p>
    </a>
  )
}
