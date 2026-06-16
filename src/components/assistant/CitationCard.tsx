'use client'

import { useState } from 'react'
import type { CitationRef, ListingType } from '@/lib/assistant/types'
import styles from './Assistant.module.css'

interface Props {
  citation: CitationRef
  /** Optional bot-written annotation that appears below the meta line */
  note?: string
  onClick?: (c: CitationRef) => void
}

function TypeIcon({ type }: { type: ListingType }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (type) {
    case 'job':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      )
    case 'funder':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 9.5c0-1 1-2 3-2s3 1 3 2-1 1.5-3 2-3 1-3 2 1 2 3 2 3-1 3-2" />
        </svg>
      )
    case 'advisor':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
        </svg>
      )
    case 'community':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
    case 'course':
      return (
        <svg {...common}>
          <path d="M4 19.5V5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2.5z" />
          <path d="M8 7h8M8 11h8" />
        </svg>
      )
    case 'founder-resource':
      return (
        <svg {...common}>
          <path d="M5 16l4-4-3-3 6-7 3 3 4-4" />
          <path d="M9 12l-3 8M14 18l-2 2" />
        </svg>
      )
    case 'project':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 10l2 2 4-4" />
        </svg>
      )
    case 'media-channel':
      return (
        <svg {...common}>
          <path d="M3 11v2a4 4 0 0 0 4 4h1l5 4V5l-5 4H7a4 4 0 0 0-4 2z" />
          <path d="M19 8a5 5 0 0 1 0 8" />
        </svg>
      )
    case 'org':
      return (
        <svg {...common}>
          <rect x="4" y="9" width="16" height="11" rx="1" />
          <path d="M9 20v-5h6v5M9 9V5h6v4" />
        </svg>
      )
  }
}

function metaSummary(c: CitationRef): string {
  const parts: string[] = []
  if (c.organization) parts.push(c.organization)
  if (c.type === 'job') {
    if (c.meta.workLocation) parts.push(c.meta.workLocation)
    if (c.meta.minimumExperience) parts.push(c.meta.minimumExperience)
  } else if (c.type === 'funder') {
    if (c.meta.acceptingApplications) parts.push(c.meta.acceptingApplications)
  } else if (c.type === 'community') {
    if (c.meta.platform) parts.push(c.meta.platform)
  } else if (c.type === 'course') {
    if (c.meta.category) parts.push(c.meta.category)
  } else if (c.type === 'media-channel' || c.type === 'founder-resource') {
    if (c.meta.type) parts.push(c.meta.type)
  }
  return parts.join(' · ')
}

export default function CitationCard({ citation, note, onClick }: Props) {
  const isExternal = /^https?:\/\//.test(citation.url)
  // A listing with no link of its own (e.g. a community with no website or join
  // link) has url "#". Send the card to its resource page instead, so the click
  // lands somewhere useful rather than doing nothing. Real links — including
  // mailto: — are left untouched. The assistant is also prompted to tell the
  // user the listing has no direct link and to find it on that page.
  const hasOwnLink = Boolean(citation.url) && citation.url !== '#'
  const href = hasOwnLink ? citation.url : citation.pageUrl || citation.url
  const summary = metaSummary(citation)
  const [imgFailed, setImgFailed] = useState(false)
  const showLogo = citation.logo && !imgFailed

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className={styles.citationCard}
      onClick={() => onClick?.(citation)}
    >
      <span className={styles.citationLogo}>
        {showLogo ? (
          // Plain <img>: logos are tiny (36px), come from many third-party
          // hosts (favicons, cdn URLs we don't control), and we're not
          // benefiting from next/image's pipeline.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={citation.logo!}
            alt=""
            width={36}
            height={36}
            className={styles.citationLogoImg}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <TypeIcon type={citation.type} />
        )}
      </span>
      <span className={styles.citationBody}>
        <span className={styles.citationName}>{citation.name}</span>
        {note ? (
          <span className={styles.citationNote}>{note}</span>
        ) : summary ? (
          <span className={styles.citationMeta}>{summary}</span>
        ) : null}
      </span>
    </a>
  )
}
