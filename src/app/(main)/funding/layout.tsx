import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Funding – AISafety.com',
  description:
    'Organizations providing financial support to organizations and individuals working on AI safety.',
}

export default function FundingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
