import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '(map for posters)',
  robots: {
    index: false,
    follow: false,
  },
}

export default function PosterLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}
