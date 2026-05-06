import { getMapData, MapOrg } from '@/lib/data/map'
import PosterMapClient from './PosterMapClient'

export const metadata = {
  robots: { index: false, follow: false },
}

// Filter orgs that have map coordinates for the D3 map
function getMapOrgs(records: MapOrg[]): MapOrg[] {
  return records.filter(org => org.x !== null && org.y !== null)
}

export default async function PosterMapPage() {
  const { records } = await getMapData()
  const mapOrgs = getMapOrgs(records)

  return <PosterMapClient orgs={mapOrgs} />
}
