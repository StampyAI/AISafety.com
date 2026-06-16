import { getProjects } from '@/lib/data/projects'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler('projects', getProjects)
export { OPTIONS }
