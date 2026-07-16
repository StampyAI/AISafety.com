export const metadata = {
  title: 'Privacy – AISafety.com',
  description:
    'What AISafety.com collects, why, and the choices you have. No cookies, no ads, no selling data.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="container-narrow">
      <h1 className="padding-top-56px padding-bottom-40px">Privacy</h1>

      <div className="width-7-col-narrow">
        <p className="color-teal-300 padding-bottom-40px">
          We collect as little as we can, and we don&apos;t use any of it for
          advertising or sell it to anyone. This page explains what we do
          collect, why, and the choices you have.
        </p>

        <h3 className="padding-bottom-16px">No cookies</h3>
        <p className="color-teal-300 padding-bottom-40px">
          This site doesn&apos;t set cookies for visitors, which is why
          there&apos;s no cookie banner. The only cookie we use anywhere is the
          one our own team gets when signing in to the site&apos;s admin area.
        </p>

        <h3 className="padding-bottom-16px">Analytics</h3>
        <p className="color-teal-300 padding-bottom-40px">
          We use two privacy-respecting tools to understand how the site is
          used. Matomo, running in cookieless mode, gives us anonymous,
          aggregated statistics like page views and referrers. Our own
          first-party analytics records page visits and which listings and links
          get clicked; it stores a random ID in your browser&apos;s local
          storage so we can count unique visitors, but that ID is not tied to
          your name, email, or IP address, and it never follows you to other
          sites.
        </p>

        <h3 className="padding-bottom-16px">The chatbot</h3>
        <p className="color-teal-300 padding-bottom-40px">
          Conversations with our chatbot are saved so we can improve it — the
          messages, the page you were on, how you arrived at the site, and your
          approximate location (city and country, estimated from your IP
          address, which we don&apos;t keep). Conversations may be reviewed by
          the AISafety.com team and trusted partners — the chat tells you this
          before you start typing. Please don&apos;t share sensitive personal
          information in the chat, and if you&apos;d like a conversation
          deleted, contact us using the form below.
        </p>

        <h3 className="padding-bottom-16px">Services we rely on</h3>
        <p className="color-teal-300 padding-bottom-40px">
          The site runs on Vercel (hosting), Matomo Cloud (analytics), Airtable
          (our listings database, forms, and chatbot logs), and ipapi.co (the
          approximate-location lookup for chatbot conversations). Our
          newsletters are hosted on Substack — when you subscribe there,
          Substack&apos;s own privacy policy applies.
        </p>

        <h3 className="padding-bottom-16px">Your choices</h3>
        <p className="color-teal-300 padding-bottom-40px">
          You can ask us what data we hold about you, or ask us to correct or
          delete it, by{' '}
          <a
            href="https://airtable.com/appF8XfZUGXtfi40E/pagUmmzVb8OnVvTZS/form"
            target="_blank"
            rel="noopener noreferrer"
            className="color-light-teal"
          >
            sending us a message
          </a>
          . Because our analytics is anonymous, chatbot conversations are
          usually the only thing we can link to you — mention roughly when the
          conversation happened and what it was about, and we&apos;ll find and
          delete it.
        </p>

        <p className="paragraph-small color-teal-300 padding-bottom-80px">
          Last updated: 15 July 2026
        </p>
      </div>
    </div>
  )
}
