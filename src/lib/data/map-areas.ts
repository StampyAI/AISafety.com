// Named regions on the Field map (/map), keyed by org category.
//
// An org's logo is drawn in the region for its FIRST category only:
// "Governance, Advocacy, Conceptual research" → Governance Grove, not Advocacy
// Anchorage. Later categories are secondary tags and don't place the org
// anywhere. This file has no dependencies so both the chatbot catalog (server)
// and the system prompt can import it without pulling in the Airtable client.
export const MAP_AREA_BY_CATEGORY: Record<string, string> = {
  Advocacy: 'Advocacy Anchorage',
  Blog: 'Blog Beach',
  'Capabilities research': 'Capabilities Cove',
  'Career support': 'Career Castle',
  'Conceptual research': 'Conceptual Cliffs',
  'Empirical research': 'Empirical Escarpment',
  Forecasting: 'Forecasting Falls',
  Funding: 'Funding Forest',
  Governance: 'Governance Grove',
  Newsletter: 'Newsletter Nook',
  Podcast: 'Podcast Port',
  'Research support': 'Support Shoreline',
  Resource: 'Resource Rock',
  Strategy: 'Strategy Summit',
  'Training and education': 'Training Town',
  Video: 'Video Vista',
  'No longer active': 'Gone Graveyard',
}

/** First entry of an org's comma-joined category list, or null. */
export function primaryCategory(category: string): string | null {
  const first = category.split(',')[0]?.trim()
  return first || null
}

/** Field map region an org is drawn in — decided by its first category. */
export function mapAreaFor(category: string): string | null {
  const primary = primaryCategory(category)
  if (!primary) return null
  const area = MAP_AREA_BY_CATEGORY[primary]
  if (!area) {
    console.warn(
      `[map-areas] No Field map area for category "${primary}" — add it to MAP_AREA_BY_CATEGORY`
    )
    return null
  }
  return area
}
