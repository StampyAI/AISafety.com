import { getProjects } from '@/lib/data/projects'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

export const dynamic = 'force-dynamic'

// `email` is a personal contact address. The site page still shows it to human
// visitors, but strip it from the API so it can't be bulk-harvested.
// `descriptionLong` is internal background never displayed on the site, and it
// can name people who never agreed to appear in a public dump — strip it too.
const PRIVATE_KEYS = ['email', 'descriptionLong']

export const GET = createCollectionHandler('projects', async () => {
  const projects = await getProjects()
  return projects.map(project =>
    Object.fromEntries(
      Object.entries(project).filter(([key]) => !PRIVATE_KEYS.includes(key))
    )
  )
})

export { OPTIONS }
