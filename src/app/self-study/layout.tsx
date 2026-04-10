import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Self-study – AISafety.com',
  description:
    'Curricula and reading lists enabling you to dive deeper into AI safety through independent learning.',
  openGraph: {
    title: 'Self-study – AISafety.com',
    description:
      'Curricula and reading lists enabling you to dive deeper into AI safety through independent learning.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function SelfStudyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
