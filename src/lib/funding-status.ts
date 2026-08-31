// The Funding table's "Accepting applications?" field holds free text:
// "Accepting applications – rolling basis", "Applications close 31 October
// 2026", or "Not accepting applications". The legacy "Yes – …"/"No" wording
// is still recognized so the page keeps working while old values linger
// (e.g. a record written by an automation between deploys). The trailing
// space in 'Applications close ' is load-bearing — it keeps a hypothetical
// "Applications closed …" out of the open bucket.
//
// Lives outside lib/data/ because client components import it — the data
// modules pull in server-only code (next/headers, @vercel/blob).
export function isAcceptingApplications(status: string): boolean {
  return (
    status.startsWith('Accepting') ||
    status.startsWith('Applications close ') ||
    status.startsWith('Yes')
  )
}
