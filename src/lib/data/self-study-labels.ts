// Display-only labels for the /self-study page (requested by Melissa, June
// 2026). The page shows the Airtable "Category" field as "Focus", the "Type"
// field as "Format", and the "Introductory" value as "General intro".
// Filtering, counts, the stored Airtable data, Comb (record creation), and the
// chatbot all keep using the raw values, so nothing downstream needs to change.
//
// This lives in its own module — with no data-layer / Node imports — so client
// components can import it without pulling Node built-ins into the browser
// bundle.
export const categoryDisplayLabels: Record<string, string> = {
  Introductory: 'General intro',
}

export function displayCategory(raw: string): string {
  return raw
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => categoryDisplayLabels[c] ?? c)
    .join(', ')
}
