import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblRNYJ0m1cmJXKKk'
const VIEW_ID = 'viwblgaia3x1gsqBo'

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    // "Focus"/"Format" are the current field names; "Category"/"Type" are read
    // as a fallback so this works both before and after the Airtable rename.
    Focus?: string | string[]
    Format?: string | string[]
    Category?: string | string[]
    Type?: string | string[]
    'Created by'?: string
    Link?: string
    Logo?: Array<{ url: string }>
    Featured?: string
    'Featured tagline'?: string
  }
}

// Normalise legacy option values to the current names, so filtering/display
// keep working during the transition window before/after the Airtable rename.
// Safe to remove once the rename is fully propagated.
const FOCUS_VALUE_RENAMES: Record<string, string> = {
  Introductory: 'General intro',
  'Technical Alignment': 'Technical alignment',
}
const FORMAT_VALUE_RENAMES: Record<string, string> = {
  'Reading List': 'Reading list',
}

function normalizeMultiSelect(
  raw: string | string[] | undefined,
  renames: Record<string, string>
): string {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  return values.map(v => renames[v] ?? v).join(', ')
}

export interface Course {
  id: string
  name: string
  description: string
  category: string
  courseType: string
  organizer: string
  url: string
  image: string | null
  featured: '1' | '2' | null
  featuredTagline: string | null
}

export async function getCourses(): Promise<Course[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [{ field: 'Sort', direction: 'asc' }],
  })

  const results: Course[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    let image: string | null = null
    if (fields.Logo && fields.Logo.length > 0) {
      image = fields.Logo[0].url
    }

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      category: normalizeMultiSelect(
        fields.Focus ?? fields.Category,
        FOCUS_VALUE_RENAMES
      ),
      courseType: normalizeMultiSelect(
        fields.Format ?? fields.Type,
        FORMAT_VALUE_RENAMES
      ),
      organizer: fields['Created by'] || '',
      url: fields.Link || '#',
      image,
      featured:
        fields.Featured === '1' || fields.Featured === '2'
          ? (fields.Featured as '1' | '2')
          : null,
      featuredTagline: fields['Featured tagline'] || null,
    })
  }

  return results
}
