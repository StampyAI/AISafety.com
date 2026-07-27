import { ReactNode } from 'react'
import NewsletterSignup from './NewsletterSignup'
import RelativeDate from './RelativeDate'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  lastUpdated?: string | null
  /** ISO date — renders a live "Updated X ago" instead of "Last updated: X". */
  lastUpdatedIso?: string | null
  description: ReactNode
  id?: string
  topPadding?: string
  /** Show the newsletter signup beside the header (stacked below on mobile). */
  newsletter?: boolean
  /** Extra content under the description, e.g. a cross-link to a sister page. */
  children?: ReactNode
}

export default function PageHeader({
  title,
  lastUpdated,
  lastUpdatedIso,
  description,
  id,
  topPadding = 'padding-top-56px',
  newsletter,
  children,
}: PageHeaderProps) {
  const header = (
    <>
      <h1 className={`${topPadding} padding-bottom-8px`} id={id}>
        {title}
      </h1>
      {lastUpdatedIso ? (
        <RelativeDate
          iso={lastUpdatedIso}
          className="paragraph-small color-teal-300 margin-bottom-40px"
        />
      ) : (
        lastUpdated && (
          <p className="paragraph-small color-teal-300 margin-bottom-40px">
            Last updated: {lastUpdated}
          </p>
        )
      )}
      <h2 className="width-7-col margin-bottom-56px">{description}</h2>
      {children}
    </>
  )

  if (!newsletter) return header

  return (
    <div className={`${styles.heroRow} padding-bottom-56px`}>
      <div className={styles.heroHeader}>{header}</div>
      <div className={styles.newsletterSlot}>
        <NewsletterSignup />
      </div>
    </div>
  )
}
