// The Funding table's "Accepting applications?" field holds free text:
// "Accepting applications – rolling basis", "Accepting applications –
// closes …", or "Not currently accepting applications". The legacy
// "Yes – …"/"No" wording is still recognized so the page keeps working
// while old values linger (e.g. a record written by an automation between
// deploys).
//
// Lives outside lib/data/ because client components import it — the data
// modules pull in server-only code (next/headers, @vercel/blob).
export function isAcceptingApplications(status: string): boolean {
  return status.startsWith('Accepting') || status.startsWith('Yes')
}
