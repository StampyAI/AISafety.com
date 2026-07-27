import { getMediaChannels } from '@/lib/data/media-channels'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler('media-channels', getMediaChannels)
export { OPTIONS }
