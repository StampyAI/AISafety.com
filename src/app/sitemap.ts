import type { MetadataRoute } from 'next'

const BASE_URL = 'https://aisafety.com'

const ROUTES = [
  '/',
  '/about',
  '/advisors',
  '/communities',
  '/donation-guide',
  '/events-and-training',
  '/founders',
  '/funding',
  '/jobs',
  '/map',
  '/media-channels',
  '/projects',
  '/self-study',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return ROUTES.map(path => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency: path === '/' ? 'weekly' : 'daily',
    priority: path === '/' ? 1.0 : 0.8,
  }))
}
