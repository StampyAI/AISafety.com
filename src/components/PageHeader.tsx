import { ReactNode } from 'react'
import RelativeDate from './RelativeDate'

interface PageHeaderProps {
  title: string
  lastUpdated?: string | null
  /** ISO date — renders a live "Updated X ago" instead of "Last updated: X". */
  lastUpdatedIso?: string | null
  description: ReactNode
  id?: string
  topPadding?: string
}

export default function PageHeader({
  title,
  lastUpdated,
  lastUpdatedIso,
  description,
  id,
  topPadding = 'padding-top-56px',
}: PageHeaderProps) {
  return (
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
    </>
  )
}
