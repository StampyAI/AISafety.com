import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Events – AISafety.com',
  description:
    'AI safety events: conferences, competitions, meetups, talks, and workshops, both online and in-person.',
  openGraph: {
    title: 'Events – AISafety.com',
    description:
      'AI safety events: conferences, competitions, meetups, talks, and workshops, both online and in-person.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
