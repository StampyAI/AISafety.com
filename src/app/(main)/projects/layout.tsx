import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Volunteer Projects – AISafety.com',
  description:
    'Online initiatives supporting the AI safety field and seeking volunteer help.',
}

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
