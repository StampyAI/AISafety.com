import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Volunteer projects – AISafety.com',
  description:
    'Online initiatives supporting the AI safety field and seeking volunteer help.',
  openGraph: {
    title: 'Volunteer projects – AISafety.com',
    description:
      'Online initiatives supporting the AI safety field and seeking volunteer help.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
