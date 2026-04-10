import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Donation guide – AISafety.com',
  description:
    'A short guide on how to donate most effectively to the AI safety field.',
  openGraph: {
    title: 'Donation guide – AISafety.com',
    description:
      'A short guide on how to donate most effectively to the AI safety field.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function DonationGuideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
