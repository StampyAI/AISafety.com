// In-memory query filtering for collection endpoints.
//
// - Whitelisted fields only (callers pass the allowed list).
// - Case-insensitive substring match; comma-separated values are OR'd.
// - A free-text `q` parameter searches across all of a record's values.
//
// Pure: returns a filtered subset, never mutates the input records.
export function applyQuery<T extends Record<string, unknown>>(
  records: T[],
  searchParams: URLSearchParams,
  filterFields: string[]
): T[] {
  let result = records

  for (const field of filterFields) {
    const raw = searchParams.get(field)
    if (!raw) continue
    const wanted = raw
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
    if (wanted.length === 0) continue
    result = result.filter(record => {
      const haystack = toSearchableStrings(record[field])
      return wanted.some(w => haystack.some(h => h.includes(w)))
    })
  }

  const q = searchParams.get('q')
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase()
    result = result.filter(record =>
      Object.values(record).some(v =>
        toSearchableStrings(v).some(h => h.includes(needle))
      )
    )
  }

  return result
}

function toSearchableStrings(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map(v => String(v).toLowerCase())
  return [String(value).toLowerCase()]
}
