import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblx0L8qJEaLBxJFS'
const VIEW_ID = 'viwHl72bJxCb2SfrL'

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    Type?: string | string[]
    Location?: string | string[]
    'Host name'?: string
    Cost?: string | string[]
    'Start date'?: string
    'End date'?: string
    'Applications open or today'?: string
    'Applications/registrations close'?: string
    URL?: string
    Image?: Array<{ url: string }>
    Logo?: Array<{ url: string }>
    Featured?: boolean
  }
}

export interface ResourceListing {
  id: string
  name: string
  description: string
  type: string[]
  location: string
  hostName: string
  cost: string[]
  applicationStatus: 'Open' | 'Closed'
  startDate: string | null
  endDate: string | null
  url: string
  image: string | null
  logo: string | null
  featured: boolean
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function applyAliases(
  values: string[],
  aliases: Record<string, string>
): string[] {
  return values.map(v => aliases[v] ?? v)
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return '#'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export async function getResources({
  allowedTypes,
  typeAliases,
}: {
  allowedTypes: ReadonlySet<string>
  typeAliases: Readonly<Record<string, string>>
}): Promise<ResourceListing[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
  })

  const today = new Date().toISOString().slice(0, 10)
  const results: ResourceListing[] = []

  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    const types = applyAliases(toArray(fields.Type), typeAliases)
    if (!types.some(t => allowedTypes.has(t))) continue

    let image: string | null = null
    if (fields.Image && fields.Image.length > 0) {
      image = fields.Image[0].url
    }

    let logo: string | null = null
    if (fields.Logo && fields.Logo.length > 0) {
      logo = fields.Logo[0].url
    }

    const opensOn = fields['Applications open or today']
    const closesOn = fields['Applications/registrations close']
    const applicationStatus: 'Open' | 'Closed' =
      !!opensOn && !!closesOn && opensOn <= today && closesOn >= today
        ? 'Open'
        : 'Closed'

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      type: types.filter(t => allowedTypes.has(t)),
      location: Array.isArray(fields.Location)
        ? fields.Location.join(', ')
        : fields.Location || '',
      hostName: fields['Host name'] || '',
      cost: toArray(fields.Cost),
      applicationStatus,
      startDate: fields['Start date'] || null,
      endDate: fields['End date'] || null,
      url: normalizeUrl(fields.URL || ''),
      image,
      logo,
      featured: fields.Featured === true,
    })
  }

  results.sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0
    if (!a.startDate) return 1
    if (!b.startDate) return -1
    return a.startDate.localeCompare(b.startDate)
  })

  return results
}
