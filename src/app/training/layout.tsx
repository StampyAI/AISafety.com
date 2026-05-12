import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Training – AISafety.com',
  description:
    'AI safety training: bootcamps, courses, internships, and research programs.',
  openGraph: {
    title: 'Training – AISafety.com',
    description:
      'AI safety training: bootcamps, courses, internships, and research programs.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
