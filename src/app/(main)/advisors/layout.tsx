import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Advisors – AISafety.com',
  description:
    'These advisors offer free guidance calls to help you most effectively contribute to AI safety.',
}

export default function AdvisorsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
