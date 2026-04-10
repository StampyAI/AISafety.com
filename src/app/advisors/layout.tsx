import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Advisors – AISafety.com',
  description:
    'Advisors offering free guidance calls to help you most effectively contribute to AI safety.',
  openGraph: {
    title: 'Advisors – AISafety.com',
    description:
      'Advisors offering free guidance calls to help you most effectively contribute to AI safety.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function AdvisorsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
