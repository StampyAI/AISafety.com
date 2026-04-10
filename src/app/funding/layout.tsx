import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Funding – AISafety.com',
  description:
    'Sources of financial support for organizations and individuals working on AI safety.',
  openGraph: {
    title: 'Funding – AISafety.com',
    description:
      'Sources of financial support for organizations and individuals working on AI safety.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function FundingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
