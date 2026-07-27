import { getProjects } from '@/lib/data/projects'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'

// `email` is a personal contact address. The site page still shows it to human
// visitors, but strip it from the API so it can't be bulk-harvested.
export const GET = createCollectionHandler('projects', async () => {
  const projects = await getProjects()
  return projects.map(project =>
    Object.fromEntries(
      Object.entries(project).filter(([key]) => key !== 'email')
    )
  )
})

export { OPTIONS }
