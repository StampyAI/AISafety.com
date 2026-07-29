'use client'

import Link from 'next/link'
import { trackFooterClick } from '@/lib/analytics'

/** An external footer link that records its clicks — outbound, so nothing
 *  else would. The tiny client wrapper keeps Footer itself server-rendered. */
export default function FooterLink({
  href,
  section,
  label,
}: {
  href: string
  /** The footer column's heading, e.g. 'Help us out'. */
  section: string
  /** The link text, also what the click is recorded as. */
  label: string
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackFooterClick(section, label, href)}
    >
      {label}
    </Link>
  )
}
