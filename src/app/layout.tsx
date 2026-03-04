import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
})

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  )
}
