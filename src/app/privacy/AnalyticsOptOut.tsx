'use client'

import { useTrackingOptOut, formatExcludedSince } from '@/lib/useTrackingOptOut'

/** Visitor-facing analytics switch on the privacy page. Shares the one
 *  "exclude this browser" localStorage flag with the admin controls, so a
 *  browser switched off here drops out of first-party analytics, Matomo, and
 *  the chatbot conversation log alike. Forward-only: anything already
 *  recorded stays. */
export default function AnalyticsOptOut() {
  const { marker, optedOut, setOptOut } = useTrackingOptOut()
  const since = optedOut ? formatExcludedSince(marker) : undefined

  return (
    <div className="padding-bottom-40px">
      {optedOut && (
        <p className="paragraph-small color-light-teal padding-bottom-16px">
          ✓ Analytics is off in this browser{since ? ` (since ${since})` : ''}.
        </p>
      )}
      <button
        type="button"
        className="button-secondary"
        onClick={() => setOptOut(!optedOut)}
      >
        {optedOut
          ? 'Turn analytics back on'
          : 'Turn off analytics in this browser'}
      </button>
    </div>
  )
}
