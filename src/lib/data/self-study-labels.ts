// Display-only labels for the /self-study page (requested by Melissa, June
// 2026). The page shows the Focus and Format tags in sentence case — e.g.
// "General intro" (stored as "Introductory"), "Technical alignment", and
// "Reading list" — for consistent capitalization. Filtering, counts, the
// stored Airtable data, Comb (record creation), and the chatbot all keep using
// the raw values, so nothing downstream needs to change.
//
// This lives in its own module — with no data-layer / Node imports — so client
// components can import it without pulling Node built-ins into the browser
// bundle.
export const categoryDisplayLabels: Record<string, string> = {
  Introductory: 'General intro',
  'Technical Alignment': 'Technical alignment',
}

export const typeDisplayLabels: Record<string, string> = {
  'Reading List': 'Reading list',
}

function applyLabels(raw: string, labels: Record<string, string>): string {
  return raw
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => labels[v] ?? v)
    .join(', ')
}

export function displayCategory(raw: string): string {
  return applyLabels(raw, categoryDisplayLabels)
}

export function displayType(raw: string): string {
  return applyLabels(raw, typeDisplayLabels)
}
