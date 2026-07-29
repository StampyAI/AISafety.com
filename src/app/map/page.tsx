import MapClient from './MapClient'
import { getMapData } from '@/lib/data/map'
import { fetchLastUpdated } from '@/lib/data/last-updated'

export const metadata = {
  alternates: { canonical: '/map' },
}

export default async function MapPage() {
  const [{ records, suggestEntryLink, suggestCorrectionLink }, lastUpdated] =
    await Promise.all([getMapData(), fetchLastUpdated('map')])

  return (
    <MapClient
      orgs={records}
      lastUpdatedIso={lastUpdated.lastUpdated}
      suggestEntryLink={suggestEntryLink}
      suggestCorrectionLink={suggestCorrectionLink}
    />
  )
}
