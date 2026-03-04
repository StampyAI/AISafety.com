import Image from 'next/image'
import styles from './FeaturedCard.module.css'

interface MetadataField {
  label: string
  value: string
}

interface FeaturedCardProps {
  href: string
  tagline: string
  name: string
  description: string
  logo?: string
  metadata: MetadataField[]
}

export default function FeaturedCard({
  href,
  tagline,
  name,
  description,
  logo,
  metadata,
}: FeaturedCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col-mobile"
    >
      <div className={styles.card}>
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
              />
            </div>
            <h3>{name}</h3>
          </div>
        ) : (
          <h3 className="padding-bottom-24px">{name}</h3>
        )}
        <p className="padding-bottom-24px">{description}</p>
        {metadata.map((field, i) => (
          <div key={field.label}>
            <p className="paragraph-xs-bold color-teal-400 padding-bottom-4px">
              {field.label}
            </p>
            <p
              className={`paragraph-small${i < metadata.length - 1 ? ' padding-bottom-16px' : ''}`}
            >
              {field.value}
            </p>
          </div>
        ))}
      </div>
    </a>
  )
}
