// The Funding table's "Accepting applications?" field holds free text:
// "Applications on a rolling basis", "Applications close 31 October 2026",
// "Accepting applications" (open, timing unknown), or "Not accepting
// applications". Rather than enumerate every open phrasing, key off the
// closed ones: they all start with "No" ("Not accepting applications",
// legacy "No"), so the open wordings can be reworded freely. Callers only
// pass non-empty statuses.
//
// Lives outside lib/data/ because client components import it — the data
// modules pull in server-only code (next/headers, @vercel/blob).
export function isAcceptingApplications(status: string): boolean {
  return !status.startsWith('No')
}
