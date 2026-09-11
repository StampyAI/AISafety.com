'use client'

import { useEffect, useRef, useState } from 'react'
import ListingCard, { type CardProps } from '@/components/ListingCard'
import { communityCardProps } from '@/app/communities/card'
import { eventCardProps } from '@/app/events/card'
import {
  recurringProgramCardProps,
  trainingCardProps,
} from '@/app/training/card'
import { courseCardProps } from '@/app/self-study/card'
import { funderCardProps } from '@/app/funding/card'
import AdvisorCard from '@/app/advisors/AdvisorCard'
import FounderResourceCard from '@/app/founders/FounderResourceCard'
import MediaChannelCard from '@/app/media-channels/MediaChannelCard'
import ProjectCard from '@/app/projects/ProjectCard'
import MapOrgCard from '@/app/map/MapOrgCard'
import type { Community } from '@/lib/data/communities'
import type { EventListing } from '@/lib/data/events'
import type { RecurringProgram, TrainingProgram } from '@/lib/data/training'
import type { Course } from '@/lib/data/self-study'
import type { Funder } from '@/lib/data/funding'
import type { Advisor } from '@/lib/data/advisors'
import type { FounderResource } from '@/lib/data/founders'
import type { MediaChannel } from '@/lib/data/media-channels'
import type { Project } from '@/lib/data/projects'
import type { MapOrg } from '@/lib/data/map'
import type { PreviewKind } from '@/lib/admin/queue'
import styles from './queue.module.css'

// "How it will look on the site": the record is read live, the page's edits
// are laid over it, and the resource page's OWN record-to-listing mapper and
// card code build the card (src/lib/data/*.ts + src/app/<page>/card.ts or
// the page's card component). Bryce's ask, 9 Sept 2026: the preview must be
// exactly the site's card, not an approximation.

const PREVIEW_API = '/api/admin/queue/preview'

interface Preview {
  kind: PreviewKind | null
  listing?: unknown
}

/** The site's card for a listing. Its link opens in a new tab, as on the
 *  site; the admin page loads no analytics, so clicks are not counted. */
function Card({ kind, listing }: { kind: PreviewKind; listing: unknown }) {
  const listingCard = (props: CardProps) => (
    <ListingCard {...props} trackingPage="admin-queue" />
  )
  switch (kind) {
    case 'community':
      return listingCard(communityCardProps(listing as Community))
    case 'event':
      return listingCard(eventCardProps(listing as EventListing))
    case 'training':
      return listingCard(trainingCardProps(listing as TrainingProgram))
    case 'recurring':
      return listingCard(recurringProgramCardProps(listing as RecurringProgram))
    case 'course':
      return listingCard(courseCardProps(listing as Course))
    case 'funder':
      return listingCard(funderCardProps(listing as Funder))
    case 'advisor':
      return <AdvisorCard advisor={listing as Advisor} />
    case 'founder':
      return <FounderResourceCard resource={listing as FounderResource} />
    case 'mediaChannel':
      return <MediaChannelCard channel={listing as MediaChannel} />
    case 'project':
      return <ProjectCard project={listing as Project} />
    case 'mapOrg':
      return <MapOrgCard org={listing as MapOrg} />
  }
}

export default function SitePreview({
  itemId,
  page,
  edits,
  compact = false,
}: {
  itemId: string
  page: string | null
  /** The admin's edits in the field's own shape (see coerceEdits). */
  edits: Record<string, unknown>
  /** Scaled down so the whole item fits on one screen. */
  compact?: boolean
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const editsKey = JSON.stringify(edits)
  const latest = useRef(0)

  useEffect(() => {
    const seq = ++latest.current
    setError(null)
    // Edits arrive keystroke by keystroke; wait for a pause before asking.
    const t = setTimeout(
      () => {
        void (async () => {
          try {
            const res = await fetch(PREVIEW_API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: itemId, edits: JSON.parse(editsKey) }),
            })
            const data = (await res.json()) as Preview & { error?: string }
            if (seq !== latest.current) return
            if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
            setPreview(data)
          } catch (e) {
            if (seq === latest.current) {
              setError(e instanceof Error ? e.message : String(e))
            }
          }
        })()
      },
      preview ? 300 : 0
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, editsKey])

  return (
    <section className={styles.block}>
      <h3 className={styles.h3}>On {page ?? 'the site'}</h3>
      {preview?.kind && preview.listing ? (
        <div
          className={`${styles.siteFrame} ${compact ? styles.siteFrameCompact : ''}`}
        >
          <Card kind={preview.kind} listing={preview.listing} />
        </div>
      ) : preview && !preview.kind ? (
        <p className={styles.note}>
          The site would skip this record as it stands (a name or description is
          missing, most likely).
        </p>
      ) : error ? (
        <p className={styles.error}>Couldn’t build the preview: {error}</p>
      ) : (
        <p className={styles.note}>Building the card…</p>
      )}
    </section>
  )
}
