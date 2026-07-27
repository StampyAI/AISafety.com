import { getJobs } from '@/lib/data/jobs'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler('jobs', getJobs)
export { OPTIONS }
