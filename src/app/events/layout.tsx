import type { Metadata } from 'next'

const title = 'Events – AISafety.com'
const description =
  'Find conferences, competitions, meetups, talks, and workshops in AI safety, both online and in person.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/events' },
  openGraph: {
    title,
    description,
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
