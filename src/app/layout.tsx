import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { Suspense } from 'react'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'
import MatomoRouteTracker from '@/components/MatomoRouteTracker'
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
        <Script id="matomo" strategy="afterInteractive">
          {`
            var _paq = window._paq = window._paq || [];
            _paq.push(["disableCookies"]);
            _paq.push(['trackPageView']);
            _paq.push(['enableLinkTracking']);
            (function() {
              var u="https://aisafety.matomo.cloud/";
              _paq.push(['setTrackerUrl', u+'matomo.php']);
              _paq.push(['setSiteId', '1']);
              var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
              g.async=true; g.src='https://cdn.matomo.cloud/aisafety.matomo.cloud/matomo.js'; s.parentNode.insertBefore(g,s);
            })();
          `}
        </Script>
        <Suspense fallback={null}>
          <MatomoRouteTracker />
        </Suspense>
        <LayoutShell counts={counts}>{children}</LayoutShell>
      </body>
    </html>
  )
}
