import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Jobs – AISafety.com',
  description: 'A list of current open positions in AI safety.',
}

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
