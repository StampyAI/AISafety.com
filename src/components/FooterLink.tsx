'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { trackFooterClick } from '@/lib/analytics'

/** An external footer link that records its clicks — outbound, so nothing
 *  else would. The tiny client wrapper keeps Footer itself server-rendered. */
export default function FooterLink({
  href,
  section,
  label,
  airtablePrefillField,
}: {
  href: string
  /** The footer column's heading, e.g. 'Help us out'. */
  section: string
  /** The link text, also what the click is recorded as. */
  label: string
  /** If set, appends `?prefill_<field>=<current path>` to href so Airtable
   *  captures which page the link was clicked from. */
  airtablePrefillField?: string
}) {
  // Internal links (e.g. /hackathon) navigate in place; external ones open a
  // new tab as before.
  const external = href.startsWith('http')
  const pathname = usePathname()
  const pageValue = pathname.replace(/^\//, '') || 'home'

  const finalHref = airtablePrefillField
    ? `${href}${href.includes('?') ? '&' : '?'}prefill_${encodeURIComponent(
        airtablePrefillField
      )}=${pageValue}`
    : href

  return (
    <Link
      href={finalHref}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onClick={() => trackFooterClick(section, label, href)}
    >
      {label}
    </Link>
  )
}
