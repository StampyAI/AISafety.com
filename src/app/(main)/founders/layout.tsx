import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Founder Toolkit – AISafety.com',
  description:
    'Resources for starting and growing an AI safety organization – including incubators, fiscal sponsors, venture capital, and practical guides.',
}

export default function FoundersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
