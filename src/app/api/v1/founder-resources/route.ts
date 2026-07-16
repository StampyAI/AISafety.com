import { getFounderResources } from '@/lib/data/founders'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler(
  'founder-resources',
  getFounderResources
)
export { OPTIONS }
