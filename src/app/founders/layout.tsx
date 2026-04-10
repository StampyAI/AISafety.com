import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Founder toolkit – AISafety.com',
  description: 'Resources for starting and growing an AI safety organization.',
  openGraph: {
    title: 'Founder toolkit – AISafety.com',
    description:
      'Resources for starting and growing an AI safety organization.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function FoundersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
