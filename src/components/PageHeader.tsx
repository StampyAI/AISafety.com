import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  lastUpdated?: string | null
  description: ReactNode
  id?: string
  topPadding?: string
}

export default function PageHeader({
  title,
  lastUpdated,
  description,
  id,
  topPadding = 'padding-top-56px',
}: PageHeaderProps) {
  return (
    <>
      <h1 className={`${topPadding} padding-bottom-8px`} id={id}>
        {title}
      </h1>
      {lastUpdated && (
        <p className="paragraph-small color-teal-300 margin-bottom-40px">
          Last updated: {lastUpdated}
        </p>
      )}
      <h2 className="width-7-col margin-bottom-56px">{description}</h2>
    </>
  )
}
