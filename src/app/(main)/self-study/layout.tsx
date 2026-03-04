import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Self-Study – AISafety.com',
  description:
    'Curricula and reading lists enabling you to dive deeper into AI safety through independent learning.',
}

export default function SelfStudyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
