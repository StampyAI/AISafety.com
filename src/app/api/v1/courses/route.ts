import { getCourses } from '@/lib/data/self-study'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler('courses', getCourses)
export { OPTIONS }
