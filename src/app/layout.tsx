import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'
import { fetchAllCounts } from '@/lib/data/counts'

const inter = Inter({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
})

export const viewport: Viewport = {
  colorScheme: 'dark',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://aisafety.com'),
  title: 'AISafety.com',
  description:
    'The hub for AI existential safety, providing resources to help you learn about and help mitigate the risks from advanced AI.',
  icons: {
    icon: '/images/favicon.png',
    apple: '/images/webclip.png',
  },
  openGraph: {
    title: 'AISafety.com',
    description:
      'The hub for AI existential safety, providing resources to help you learn about and help mitigate the risks from advanced AI.',
    images: [{ url: '/images/link-preview.png' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AISafety.com',
    description:
      'The hub for AI existential safety, providing resources to help you learn about and help mitigate the risks from advanced AI.',
    images: ['/images/link-preview.png'],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const counts = await fetchAllCounts()

  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <LayoutShell counts={counts}>{children}</LayoutShell>
      </body>
    </html>
  )
}
