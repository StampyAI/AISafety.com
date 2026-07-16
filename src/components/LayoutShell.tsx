'use client'

import { usePathname } from 'next/navigation'
import Navigation from './Navigation'
import Footer from './Footer'
import Assistant from './assistant/Assistant'

// Routes that render without Navigation/Footer/Assistant
const standaloneRoutes = ['/poster-map', '/admin']

export default function LayoutShell({
  children,
  counts,
}: {
  children: React.ReactNode
  counts: Partial<Record<string, number>>
}) {
  const pathname = usePathname()
  const isStandalone = standaloneRoutes.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  )

  if (isStandalone) {
    return <>{children}</>
  }

  return (
    <>
      <Navigation counts={counts} />
      {children}
      <Footer />
      <Assistant />
    </>
  )
}
