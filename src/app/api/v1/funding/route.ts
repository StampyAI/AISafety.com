import { getFunders } from '@/lib/data/funding'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler('funding', getFunders)
export { OPTIONS }
