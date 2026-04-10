import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Media channels – AISafety.com',
  description:
    'The AI safety space is changing rapidly. These information sources can help you learn more and stay up to date.',
  openGraph: {
    title: 'Media channels – AISafety.com',
    description:
      'The AI safety space is changing rapidly. These information sources can help you learn more and stay up to date.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function MediaChannelsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
