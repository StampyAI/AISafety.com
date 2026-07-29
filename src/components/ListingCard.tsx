'use client'

import Image from 'next/image'
import { trackListingClick } from '@/lib/analytics'
import styles from './ListingCard.module.css'

export interface ListingCardMeta {
  /** Path to a 16×16 svg icon in /images (already teal-300 tinted). */
  icon: string
  value: string
}

export interface ListingCardPill {
  label: string
  /** Optional color utility class, e.g. 'color-teal-bright-400'. */
  colorClass?: string
}

interface ListingCardProps {
  href: string
  name: string
  description: string
  logo?: string | null
  /** Pills shown above the logo (e.g. a category or type). */
  pills?: ListingCardPill[]
  /** Metadata rows shown directly under the title (e.g. event date/time). */
  titleMeta?: ListingCardMeta[]
  /** Metadata rows shown at the bottom of the card. */
  meta: ListingCardMeta[]
  trackingPage: string
  /** Airtable record id, stamped onto the click event. */
  listingId?: string
  /** The card's slot on the page ('F1', 'F2', '1', '2'…) at click time. */
  placement?: string
  /** Click source recorded with the event — the active view's slug on pages
   *  with a view toggle (e.g. 'online' / 'in-person' on Events). */
  trackingSource?: string
}

function MetaRows({ rows }: { rows: ListingCardMeta[] }) {
  return (
    <div className="flex flex-col gap-4px">
      {rows.map((field, i) => (
        <div key={i} className="flex items-center gap-8px">
          <Image src={field.icon} alt="" width={16} height={16} unoptimized />
          <p className="paragraph-xs color-teal-300">{field.value}</p>
        </div>
      ))}
    </div>
  )
}

// The card used in the listing grids on the data-driven sub-pages
// (self-study, communities, events …). Replaces the markup that used to be
// copy-pasted into every *Client component.
export default function ListingCard({
  href,
  name,
  description,
  logo,
  pills,
  titleMeta,
  meta,
  trackingPage,
  listingId,
  placement,
  trackingSource,
}: ListingCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="card"
      onClick={() =>
        trackListingClick(
          trackingPage,
          name,
          href,
          listingId,
          placement,
          trackingSource
        )
      }
    >
      {pills && pills.length > 0 && (
        <div className="flex gap-8px padding-bottom-24px">
          {pills.map((pill, i) => (
            <span
              key={i}
              className={`${styles.pill} ${pill.colorClass ?? 'color-teal-bright-400'}`}
            >
              {pill.label}
            </span>
          ))}
        </div>
      )}

      <div
        className={`flex gap-16px padding-bottom-24px ${
          titleMeta && titleMeta.length > 0 ? 'items-start' : 'items-center'
        }`}
      >
        {logo && (
          <div className="featured-img">
            <Image
              src={logo}
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
          </div>
        )}
        <div>
          <h3>{name}</h3>
          {titleMeta && titleMeta.length > 0 && (
            <div className="padding-top-8px">
              <MetaRows rows={titleMeta} />
            </div>
          )}
        </div>
      </div>

      <p className="paragraph-small color-white padding-bottom-24px">
        {description}
      </p>

      <MetaRows rows={meta} />
    </a>
  )
}
