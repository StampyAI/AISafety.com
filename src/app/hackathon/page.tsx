import ApplicationForm from './ApplicationForm'

export const metadata = {
  title: 'Hackathon 2026 – AISafety.com',
  description:
    'Join the AISafety.com team at CEEALAR in Blackpool, England, 17–20 September 2026, for a four-day hackathon to improve the site. Free to attend – applications close 10 August.',
  alternates: { canonical: '/hackathon' },
}

export default function HackathonPage() {
  return (
    <div className="container-narrow">
      <div className="flex justify-center">
        <div className="width-9-col-narrow">
          <h1 className="padding-top-56px padding-bottom-24px">
            AISafety.com Hackathon 2026
          </h1>

          <h2 className="padding-bottom-40px">
            A four-day hackathon to{' '}
            <span className="color-light-teal">make AISafety.com better</span>,
            together in person.
          </h2>

          <p className="padding-bottom-8px">
            <span className="color-light-teal">When</span> – Thursday 17 to
            Sunday 20 September 2026
          </p>
          <p className="padding-bottom-8px">
            <span className="color-light-teal">Where</span> –{' '}
            <a
              href="https://www.ceealar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="color-light-teal"
            >
              CEEALAR
            </a>{' '}
            (the EA Hotel) in Blackpool, England
          </p>
          <p className="padding-bottom-8px">
            <span className="color-light-teal">Cost</span> – Free, including
            accommodation and all meals
          </p>
          <p className="padding-bottom-40px">
            <span className="color-light-teal">Applications close</span> – 10
            August 2026
          </p>

          <p className="color-teal-300 padding-bottom-40px">
            Once a year, the core AISafety.com team gets together with a bunch
            of amazing volunteers and spends an extended weekend getting a bunch
            of stuff done to improve the hub for AI safety resources. Outside
            work sessions, we do some relaxed fun activities like going for
            walks, board games, and movie nights.
          </p>

          <h3 className="padding-bottom-16px">The tracks</h3>
          <p className="color-teal-300 padding-bottom-8px">
            <span className="color-light-teal">Product and design</span> – UI/UX
            design, giving feedback (&quot;dogfooding&quot;), user research
          </p>
          <p className="color-teal-300 padding-bottom-8px">
            <span className="color-light-teal">Development</span> – building the
            things
          </p>
          <p className="color-teal-300 padding-bottom-8px">
            <span className="color-light-teal">Project management</span> – the
            meta track: helping everything run well
          </p>
          <p className="color-teal-300 padding-bottom-40px">
            <span className="color-light-teal">Promotion</span> – community
            outreach (Discords, the EA Forum, etc.), social media, content, and
            maybe some SEO
          </p>

          <h3 className="padding-bottom-16px">Who we&apos;re looking for</h3>
          <p className="color-teal-300 padding-bottom-8px">
            Product managers and designers
          </p>
          <p className="color-teal-300 padding-bottom-8px">Developers</p>
          <p className="color-teal-300 padding-bottom-8px">Project managers</p>
          <p className="color-teal-300 padding-bottom-8px">
            People with experience promoting smaller projects, especially in EA
          </p>
          <p className="color-teal-300 padding-bottom-8px">
            Subject-matter experts who know the AI safety ecosystem really well
          </p>
          <p className="color-teal-300 padding-bottom-40px">
            Connectors – people who know lots of people in AI safety, or have an
            audience
          </p>

          <h3 className="padding-bottom-16px" id="apply">
            Apply
          </h3>
          <p className="color-teal-300 padding-bottom-24px">
            Fill in the form and we&apos;ll email you a confirmation right away.
            Spots are limited (around 15), so we&apos;ll be in touch to confirm
            your place.
          </p>

          <ApplicationForm />
        </div>
      </div>
    </div>
  )
}
