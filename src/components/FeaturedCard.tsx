import Image from 'next/image'
import TrackedLink from './TrackedLink'
import styles from './FeaturedCard.module.css'

export interface FeaturedCardMeta {
  /** Path to a 16×16 svg icon in /images (already teal-300 tinted). */
  icon: string
  value: string
}

interface FeaturedCardProps {
  href?: string
  tagline: string
  name: string
  description: string
  logo?: string | null
  /** Metadata rows shown directly under the title (e.g. the creator). */
  titleMeta?: FeaturedCardMeta[]
  /** Metadata rows shown at the bottom of the card. */
  meta: FeaturedCardMeta[]
  trackingPage: string
  /** Position among the featured cards in the row (0-based). */
  index: number
  /** Total featured cards in the row. */
  count: number
}

// Gap between featured cards — must match the .featured-grid gap so the shared
// gradient lines up across cards.
const GRID_GAP = 40

function MetaRows({ rows }: { rows: FeaturedCardMeta[] }) {
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

// The redesigned featured card used at the top of the data-driven sub-pages.
export default function FeaturedCard({
  href,
  tagline,
  name,
  description,
  logo,
  titleMeta,
  meta,
  trackingPage,
  index,
  count,
}: FeaturedCardProps) {
  // One radial gradient shared across the whole row: each card paints its own
  // slice of a background sized to span every card plus the gaps between them
  // (left card → left slice … right card → right slice). A single card just
  // uses the gradient at its natural size.
  const gradientStyle =
    count > 1
      ? {
          backgroundSize: `calc(${count * 100}% + ${(count - 1) * GRID_GAP}px) 100%`,
          backgroundPosition: `${(index / (count - 1)) * 100}% top`,
        }
      : undefined

  const inner = (
    <>
      <Image
        src="/images/bookmark-small.svg"
        alt=""
        className={styles.bookmark}
        width={16}
        height={24}
        unoptimized
      />

      <span
        className={`${styles.pill} paragraph-xs-bold color-teal-300 inline-flex items-center gap-8px padding-left-8px padding-right-8px`}
      >
        <span className={styles.dot} />
        {tagline}
      </span>

      <div
        className={`flex gap-16px padding-top-24px padding-bottom-24px ${
          titleMeta && titleMeta.length > 0 ? 'items-start' : 'items-center'
        }`}
      >
        {logo && (
          <div className="featured-img">
            <Image
              src={logo}
              alt={`${name} logo`}
              width={64}
              height={64}
              className="card-image"
              unoptimized
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

      <p className="color-white padding-bottom-24px">{description}</p>

      <MetaRows rows={meta} />
    </>
  )

  if (!href) {
    return (
      <div
        className={`${styles.card} ${styles.cardStatic}`}
        style={gradientStyle}
      >
        {inner}
      </div>
    )
  }

  return (
    <TrackedLink
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      style={gradientStyle}
      trackingPage={trackingPage}
      trackingName={name}
    >
      {inner}
    </TrackedLink>
  )
}
