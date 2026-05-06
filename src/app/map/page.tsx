import MapClient from './MapClient'
import { getMapData } from '@/lib/data/map'

export const metadata = {
  title: 'Field Map – AISafety.com',
  description:
    'An overview of the key organizations, programs, and projects operating in the AI safety space.',
  alternates: { canonical: '/map' },
}

export default async function MapPage() {
  const { records, lastUpdated, suggestEntryLink, suggestCorrectionLink } =
    await getMapData()

  return (
    <MapClient
      orgs={records}
      lastUpdated={lastUpdated}
      suggestEntryLink={suggestEntryLink}
      suggestCorrectionLink={suggestCorrectionLink}
    />
  )
}
