import DetailsForm from './DetailsForm'

// Unlisted: sent by email to accepted applicants only. Deliberately absent
// from the sitemap, search index, footer, llms.txt, and the assistant's page
// list, and marked noindex.
export const metadata = {
  title: 'Hackathon 2026 – your details – AISafety.com',
  description:
    'Details we need from accepted AISafety.com Hackathon 2026 attendees.',
  robots: { index: false, follow: false },
}

export default function HackathonDetailsPage() {
  return (
    <div className="container-narrow">
      <div className="flex justify-center">
        <div className="width-10-col-narrow">
          <h1 className="padding-top-56px padding-bottom-24px">
            AISafety.com Hackathon 2026
          </h1>

          <h2 className="padding-bottom-40px">
            You&apos;re in! We just need{' '}
            <span className="color-light-teal">a few more details</span>.
          </h2>

          <p className="color-teal-300 padding-bottom-40px">
            Congratulations on your place at the hackathon – Thursday 17 to
            Sunday 20 September 2026 at{' '}
            <a
              href="https://www.ceealar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="color-light-teal"
            >
              CEEALAR
            </a>{' '}
            (the EA Hotel) in Blackpool, England. Please fill this in by{' '}
            <strong>21 August</strong>.
          </p>

          <DetailsForm />

          <p className="color-teal-300 padding-bottom-56px">
            Questions? Message Bryce on the{' '}
            <a
              href="https://discord.gg/WQG8FAGqun"
              target="_blank"
              rel="noopener noreferrer"
              className="color-light-teal"
            >
              AISafety.com Discord server
            </a>{' '}
            at @bryceerobertson, or email{' '}
            <a
              href="mailto:bryceerobertson@gmail.com"
              className="color-light-teal"
            >
              bryceerobertson@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
