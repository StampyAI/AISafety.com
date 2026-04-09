export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function formatRelativeDate(isoDate: string): string {
  const lastUpdatedDate = new Date(isoDate)
  const now = new Date()

  const lastUpdatedDay = Date.UTC(
    lastUpdatedDate.getUTCFullYear(),
    lastUpdatedDate.getUTCMonth(),
    lastUpdatedDate.getUTCDate()
  )
  const nowDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )

  const diffDays = Math.floor((nowDay - lastUpdatedDay) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Updated today'
  if (diffDays === 1) return 'Updated yesterday'
  if (diffDays < 7) return `Updated ${diffDays} days ago`
  if (diffDays < 14) return 'Updated 1 week ago'
  if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 60) return 'Updated 1 month ago'
  return `Updated ${Math.floor(diffDays / 30)} months ago`
}
