'use client'

import { AnchorHTMLAttributes, ReactNode } from 'react'
import { trackListingClick } from '@/lib/analytics'

interface TrackedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  trackingPage: string
  trackingName: string
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
  href,
  children,
  onClick,
  ...rest
}: TrackedLinkProps) {
  return (
    <a
      href={href}
      onClick={e => {
        trackListingClick(trackingPage, trackingName, href)
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
