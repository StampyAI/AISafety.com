import { getCommunities } from '@/lib/data/communities'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler('communities', getCommunities)
export { OPTIONS }
