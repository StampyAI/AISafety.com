'use client'

import { AnchorHTMLAttributes, ReactNode } from 'react'
import { trackListingClick } from '@/lib/analytics'

interface TrackedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  trackingPage: string
  trackingName: string
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
  trackingPosition,
  trackingSource,
  href,
  children,
  onClick,
  ...rest
}: TrackedLinkProps) {
  return (
    <a
      href={href}
      onClick={e => {
        trackListingClick(
          trackingPage,
          trackingName,
          href,
          undefined,
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
