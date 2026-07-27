import { getEvents } from '@/lib/data/events'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler('events', getEvents)
export { OPTIONS }
