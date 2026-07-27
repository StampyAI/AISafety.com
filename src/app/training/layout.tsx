import type { Metadata } from 'next'

const title = 'Training programs – AISafety.com'
const description =
  'Find fellowships, bootcamps, and courses in AI safety to upskill and build career capital. Both online and in person.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/training' },
  openGraph: {
    title,
    description,
    images: [{ url: '/images/link-preview.png' }],
  },
}

export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
