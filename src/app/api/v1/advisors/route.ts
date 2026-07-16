import { getAdvisors } from '@/lib/data/advisors'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler('advisors', getAdvisors)
export { OPTIONS }
