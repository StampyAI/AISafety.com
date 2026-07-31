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
            A four-day, in-person hackathon to{' '}
            <span className="color-light-teal">
              improve the AI safety resource hub
            </span>
            .
          </h2>

          <p className="padding-bottom-8px">
            <strong>When</strong> – Thursday 17 to Sunday 20 September 2026
          </p>
          <p className="padding-bottom-8px">
            <strong>Where</strong> –{' '}
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
            <strong>Cost</strong> – Free, including accommodation and all meals
          </p>
          <p className="padding-bottom-40px">
            <strong>Applications close</strong> – 10 August 2026
          </p>

          <p className="color-teal-300 padding-bottom-40px">
            Once a year, the core AISafety.com team gets together with a group
            of amazing volunteers and spends an extended weekend getting a bunch
            of stuff done to improve the hub for AI safety resources. Outside
            work sessions, we do some relaxed fun activities like going for
            walks, board games, and movie nights.
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
          <p className="color-teal-300 padding-bottom-16px">
            Connectors – people who know lots of people in AI safety, or have an
            audience
          </p>
          <p className="color-teal-300 padding-bottom-40px">
            If you have other ideas for increasing AISafety.com&apos;s impact,
            you&apos;re welcome to make your own track.
          </p>

          <h3 className="padding-bottom-16px">The venue</h3>
          <p className="color-teal-300 padding-bottom-16px">
            We&apos;ll be hosted at{' '}
            <a
              href="https://www.ceealar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="color-light-teal"
            >
              CEEALAR
            </a>{' '}
            (AKA the EA Hotel), a place worth experiencing in its own right –
            Bryce spent 4 months there transitioning to working full-time on AI
            safety a few years back and enjoyed it a lot. Most likely each
            person will have their own room, but if the hotel happens to be very
            full some people may need to share. If you have a strong preference
            for having your own room you can note that in the form.
          </p>
          <p className="color-teal-300 padding-bottom-16px">
            The town of Blackpool is pretty average but there&apos;s a huge
            beach and promenade 2 minutes away from the hotel which is lovely to
            walk along. The hotel itself is also a great vibe, since everyone
            there is working on some kind of impactful work – mostly AI safety.
          </p>
          <p className="color-teal-300 padding-bottom-40px">
            If you have any questions please message Bryce on the{' '}
            <a
              href="https://discord.gg/WQG8FAGqun"
              target="_blank"
              rel="noopener noreferrer"
              className="color-light-teal"
            >
              AISafety.com Discord server
            </a>{' '}
            at @bryceerobertson or email{' '}
            <a
              href="mailto:bryceerobertson@gmail.com"
              className="color-light-teal"
            >
              bryceerobertson@gmail.com
            </a>
            .
          </p>

          <h3 className="padding-bottom-16px" id="apply">
            Apply
          </h3>
          <p className="color-teal-300 padding-bottom-16px">
            Fill in the form and we&apos;ll email you a confirmation right away.
            Spots are limited (around 15), so we&apos;ll be in touch to confirm
            your place.
          </p>
          <p className="color-teal-300 padding-bottom-24px">
            Please avoid copy-pasting large amounts of AI written text into your
            answers, it&apos;s no fun to read...
          </p>

          <ApplicationForm />
        </div>
      </div>
    </div>
  )
}
