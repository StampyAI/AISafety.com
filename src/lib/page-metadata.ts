import type { Metadata } from 'next'
import type { SitePage } from './site-pages'

/**
 * <head> metadata for a public page: <title>, description, canonical URL, and
 * matching Open Graph + Twitter Card tags so shared links unfurl with the
 * page's own title and blurb (X reads the twitter:* tags first, so they have
 * to be set per page rather than inherited from the root layout).
 *
 * The card image is the site-wide one unless the route has its own
 * `opengraph-image.tsx`.
 */
export function pageMetadata({ path, title, description }: SitePage): Metadata {
  const fullTitle = `${title} – AISafety.com`
  return {
    title: fullTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: 'AISafety.com',
      type: 'website',
      // A page's openGraph block replaces the root layout's wholesale, so the
      // site-wide card image has to be repeated here. Twitter falls back to it.
      // A route's opengraph-image.tsx, when present, takes precedence.
      images: [{ url: '/images/link-preview.png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  }
}
