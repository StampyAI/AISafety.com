'use client'

import { AnchorHTMLAttributes, ReactNode } from 'react'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'

interface TrackedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  trackingPage: string
  trackingName: string
  /** Airtable record id of the listing, when there is one — the stable join
   *  key back to the source record (names and urls change; the id doesn't). */
  trackingId?: string
  /** Slot the listing sits in ('F1'/'F2' or a number), recorded with the click
   *  so the analytics dashboard can tie clicks to page position. */
  trackingPosition?: string
  /** Click source ('cards' for card surfaces on map pages), so the dashboard
   *  can separate card clicks from map clicks. */
  trackingSource?: string
  href: string
  children: ReactNode
}

/**
 * Anchor wrapper that fires a Matomo listing-click event on click.
 * Use inside server components where we can't attach onClick directly.
 */
export default function TrackedLink({
  trackingPage,
  trackingName,
  trackingId,
  trackingPosition,
  trackingSource,
  href,
  children,
  onClick,
  ...rest
}: TrackedLinkProps) {
  return (
    <a
      href={withUtm(href, trackingPage)}
      onClick={e => {
        trackListingClick(
          trackingPage,
          trackingName,
          href,
          trackingId,
          trackingPosition,
          trackingSource
        )
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
