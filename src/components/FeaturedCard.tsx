import Image from 'next/image'
import TrackedLink from './TrackedLink'
import styles from './FeaturedCard.module.css'

interface MetadataField {
  label: string
  value: string | string[]
}

interface FeaturedCardProps {
  href?: string
  tagline: string
  name: string
  description: string
  logo?: string
  metadata: MetadataField[]
  trackingPage: string
}

export default function FeaturedCard({
  href,
  tagline,
  name,
  description,
  logo,
  metadata,
  trackingPage,
}: FeaturedCardProps) {
  const cardInner = (
    <div className={`${styles.card} ${href ? '' : styles.cardStatic}`}>
      <Image
        src="/images/bookmark-small.svg"
        alt=""
        className={styles.bookmark}
        width={16}
        height={24}
      />
      <p className="paragraph-small-bold color-teal-300 padding-bottom-16px">
        {tagline}
      </p>
      {logo ? (
        <div className="flex items-center gap-16px padding-bottom-24px">
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
          <h3>{name}</h3>
        </div>
      ) : (
        <h3 className="padding-bottom-24px">{name}</h3>
      )}
      <p className="padding-bottom-24px">{description}</p>
      {metadata.map((field, i) => {
        const values = Array.isArray(field.value) ? field.value : [field.value]
        return (
          <div key={field.label}>
            <p className="paragraph-xs-bold color-teal-400 padding-bottom-4px">
              {field.label}
            </p>
            {values.map((v, vi) => (
              <p
                key={vi}
                className={`paragraph-small${
                  vi === values.length - 1 && i < metadata.length - 1
                    ? ' padding-bottom-16px'
                    : ''
                }`}
              >
                {v}
              </p>
            ))}
          </div>
        )
      })}
    </div>
  )

  if (!href) return cardInner

  return (
    <TrackedLink
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col-mobile"
      trackingPage={trackingPage}
      trackingName={name}
    >
      {cardInner}
    </TrackedLink>
  )
}
