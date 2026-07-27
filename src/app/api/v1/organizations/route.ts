import { getMapData } from '@/lib/data/map'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'

// The map data includes non-org "magic" control rows (Merch, Last updated,
// Suggest entry/correction) and an internal `isMagic` flag; strip both so the
// API returns only real organizations.
export const GET = createCollectionHandler('organizations', async () => {
  const { records } = await getMapData()
  return records
    .filter(record => !record.isMagic)
    .map(record =>
      Object.fromEntries(
        Object.entries(record).filter(([key]) => key !== 'isMagic')
      )
    )
})

export { OPTIONS }
