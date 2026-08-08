import path from 'path'
import { list, put } from '@vercel/blob'
import { unstable_cache } from 'next/cache'

export interface AirtableRawRecord {
  id: string
  /** When the record was created, always returned by the Airtable API. */
  createdTime?: string
  fields: Record<string, unknown>
}

interface AirtableAttachment {
  id: string
  url: string
  filename: string
  type?: string
}

interface FetchOptions {
  tableId: string
  viewId?: string
  filterByFormula?: string
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>
  fields?: string[]
  /** Key record fields by permanent field ID instead of name (rename-proof). */
  returnFieldsByFieldId?: boolean
}

// ---- Field-value helpers ---------------------------------------------
// Records fetched with returnFieldsByFieldId are keyed by permanent field
// ID and arrive untyped (Record<string, unknown>). These helpers coerce
// the values safely and uniformly across the data layer.

/** String value, or null when empty or missing. */
export function fieldString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** Date-only YYYY-MM-DD from an Airtable date or timestamp value. */
export function fieldDateOnly(value: unknown): string | null {
  const s = fieldString(value)
  return s ? s.slice(0, 10) : null
}

/** Numeric value, or null when missing. */
export function fieldNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

/** Multi-select (or single string) as an array of strings. */
export function fieldStringArray(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : []
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }
  return []
}

/** Multi-select (or single string) joined with ', '; '' when missing. */
export function fieldText(value: unknown): string {
  return fieldStringArray(value).join(', ')
}

/** First attachment's URL, or null. */
export function fieldAttachmentUrl(value: unknown): string | null {
  if (!isAttachmentArray(value)) return null
  return value[0].url
}

/** The two featured-card slots used across resource pages. */
export function fieldFeatured(value: unknown): '1' | '2' | null {
  return value === '1' || value === '2' ? value : null
}

/** Standard published-and-not-hidden filter, by permanent field ID. */
export function publishedFormula(
  publishFieldId: string,
  hideFieldId: string
): string {
  return `AND({${publishFieldId}} = TRUE(), {${hideFieldId}} = FALSE())`
}

// Attachments are mirrored to Vercel Blob under this prefix. Airtable's own
// attachment URLs are signed and expire within hours, so they must never end
// up in cached pages or API responses; Blob URLs are permanent.
const BLOB_PREFIX = 'airtable/'
const CONCURRENCY = 20
const DOWNLOAD_MAX_RETRIES = 3
const DOWNLOAD_RETRY_DELAY_MS = 2000
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

function isAttachmentArray(value: unknown): value is AirtableAttachment[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'object' &&
    value[0] !== null &&
    'url' in value[0] &&
    'filename' in value[0]
  )
}

const ALLOWED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.gif',
  '.avif',
  // Comb falls back to a site's favicon when no logo is available.
  '.ico',
]

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
}

function getExtension({ url, filename, type }: AirtableAttachment): string {
  const filenameExt = path.extname(filename).toLowerCase()
  if (filenameExt && ALLOWED_EXTENSIONS.includes(filenameExt)) {
    return filenameExt
  }

  const urlPath = new URL(url).pathname
  const urlExt = path.extname(urlPath).toLowerCase()
  if (urlExt && ALLOWED_EXTENSIONS.includes(urlExt)) {
    return urlExt
  }

  if (type && MIME_EXTENSIONS[type]) {
    return MIME_EXTENSIONS[type]
  }

  throw new Error(
    `Unknown image extension for attachment: filename="${filename}", url="${url}". ` +
      `Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
  )
}

function parseHttpStatus(message: string): number {
  const match = message.match(/^HTTP (\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  if (RETRYABLE_STATUS_CODES.has(parseHttpStatus(message))) return true
  // fetch wraps network errors: the useful code lives in error.cause.
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : ''
  const networkErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EPIPE',
    'EAI_AGAIN',
    'socket hang up',
    'fetch failed',
  ]
  return networkErrors.some(e => message.includes(e) || cause.includes(e))
}

async function fetchAttachmentBody(url: string): Promise<ArrayBuffer> {
  for (let attempt = 0; attempt <= DOWNLOAD_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (error) {
      if (!isRetryableError(error) || attempt === DOWNLOAD_MAX_RETRIES) {
        throw error
      }
      const delay = DOWNLOAD_RETRY_DELAY_MS * Math.pow(2, attempt)
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `Download failed (${message}), retrying in ${delay}ms... (attempt ${attempt + 1}/${DOWNLOAD_MAX_RETRIES})`
      )
      await new Promise(r => setTimeout(r, delay))
    }
  }
  // Unreachable — the loop returns or throws on the final attempt.
  throw new Error('fetchAttachmentBody exhausted retries without returning')
}

interface MirrorTask {
  recordId: string
  fieldName: string
  /** The record's attachment array; index 0 is rewritten in place. */
  holder: AirtableAttachment[]
  pathname: string
}

// Rewrites every record's first attachment URL to a permanent copy in Vercel
// Blob, uploading any attachment not yet mirrored. Unlike the filesystem, Blob
// is writable at request time too, so the same path runs at build time and at
// runtime (ISR revalidation, the assistant catalog) and expiring signed URLs
// never end up in cached data or rendered pages.
async function mirrorAttachments(records: AirtableRawRecord[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // No Blob store configured (e.g. running from a fork without Vercel
    // access). Signed URLs work for a couple of hours — enough for local dev.
    console.warn(
      'BLOB_READ_WRITE_TOKEN not set — images will use expiring Airtable URLs'
    )
    return
  }

  // Collect every mirrorable attachment first: several tables (e.g. the
  // per-table counts) carry no attachments at all, and those fetches should
  // not pay for a Blob listing.
  const candidates: MirrorTask[] = []
  for (const record of records) {
    for (const [fieldName, value] of Object.entries(record.fields)) {
      if (!isAttachmentArray(value)) continue

      const attachment = value[0]
      let ext: string
      try {
        ext = getExtension(attachment)
      } catch (error) {
        // One odd attachment must not block deploys or crash consumers of the
        // shared data cache; its record keeps the signed URL (works ~2h) and
        // the warning names it so it can be fixed in Airtable.
        console.warn(`Cannot mirror ${fieldName} for ${record.id}: ${error}`)
        continue
      }
      candidates.push({
        recordId: record.id,
        fieldName,
        holder: value,
        pathname: `${BLOB_PREFIX}${attachment.id}${ext}`,
      })
    }
  }
  if (candidates.length === 0) return

  // One listing covers every already-mirrored attachment. Pathnames embed the
  // attachment id, so replacing an image in Airtable changes the pathname and
  // the new file is uploaded on the next fetch.
  const existing = new Map<string, string>()
  try {
    let cursor: string | undefined
    do {
      const page = await list({ prefix: BLOB_PREFIX, cursor })
      for (const blob of page.blobs) {
        existing.set(blob.pathname, blob.url)
      }
      cursor = page.cursor
    } while (cursor)
  } catch (error) {
    // A Blob outage (or revoked token) must not take down every consumer of
    // the shared data cache — degrade to signed URLs at runtime, but fail the
    // build loudly: deploying pages with expiring URLs defeats the mirror.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      throw error
    }
    console.warn(
      `Blob listing failed — images will use expiring Airtable URLs: ${error}`
    )
    return
  }

  const tasks: MirrorTask[] = []
  const failures: string[] = []

  for (const candidate of candidates) {
    const mirroredUrl = existing.get(candidate.pathname)
    if (mirroredUrl) {
      candidate.holder[0] = { ...candidate.holder[0], url: mirroredUrl }
    } else {
      tasks.push(candidate)
    }
  }

  if (tasks.length > 0) {
    console.log(`Mirroring ${tasks.length} attachments to Blob...`)
  }

  // Upload in parallel with concurrency limit
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async task => {
        const body = await fetchAttachmentBody(task.holder[0].url)
        return put(task.pathname, body, {
          access: 'public',
          addRandomSuffix: false,
          // Concurrent revalidations can race to upload the same attachment;
          // both write identical bytes, so overwriting is harmless.
          allowOverwrite: true,
          contentType: task.holder[0].type,
          cacheControlMaxAge: 31536000,
        })
      })
    )

    for (let j = 0; j < results.length; j++) {
      const task = batch[j]
      const result = results[j]

      if (result.status === 'fulfilled') {
        task.holder[0] = { ...task.holder[0], url: result.value.url }
      } else {
        failures.push(
          `${task.fieldName} for ${task.recordId}: ${result.reason}`
        )
      }
    }
  }

  if (failures.length > 0) {
    const message = `Failed to mirror ${failures.length} attachments to Blob (their records keep expiring Airtable URLs):\n${failures.join('\n')}`
    // A broken image must fail the build, but at request time it would take
    // down every consumer of the shared data cache (assistant, search, ISR
    // revalidation) over a single logo — warn and degrade there instead.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      throw new Error(message)
    }
    console.warn(message)
  }
}

// Airtable's documented rate limit is 5 req/sec per base. Build-time
// fan-out across many tables can burst past that, so retry 429s with
// real backoff (exponential, plus the Retry-After header when present).
const FETCH_MAX_RETRIES = 5
const FETCH_RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])
const RATE_LIMIT_BASE_DELAY_MS = 30_000
const TRANSIENT_BASE_DELAY_MS = 1_000

export async function fetchAirtableWithRetry(
  url: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  for (let attempt = 0; attempt <= FETCH_MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) return response
    if (!FETCH_RETRYABLE_STATUS.has(response.status)) return response
    if (attempt === FETCH_MAX_RETRIES) return response

    const base =
      response.status === 429
        ? RATE_LIMIT_BASE_DELAY_MS
        : TRANSIENT_BASE_DELAY_MS
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'))
    const backoff = base * Math.pow(2, attempt)
    // Jitter so parallel workers don't all wake up and slam the API together.
    const jitter = Math.random() * base
    const delay = Math.max(retryAfter ?? 0, backoff + jitter)

    console.warn(
      `Airtable API ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${FETCH_MAX_RETRIES})`
    )
    await new Promise(r => setTimeout(r, delay))
  }

  // Unreachable — the loop returns on the final attempt.
  throw new Error('fetchAirtableWithRetry exhausted retries without returning')
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return seconds * 1000
  const date = Date.parse(header)
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
  return null
}

async function fetchAirtableRecordsImpl(
  options: FetchOptions
): Promise<AirtableRawRecord[]> {
  const token = process.env.AIRTABLE_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID

  if (!token || !baseId) {
    // Every data module checks hasAirtableCredentials() and falls back to the
    // public Data API before reaching this point, so landing here means a code
    // path is missing its contributor-mode fallback. Fail loudly rather than
    // silently rendering an empty page.
    throw new Error(
      'Airtable credentials not configured and this code path has no ' +
        'contributor-mode fallback (see src/lib/data/public-api.ts). Add ' +
        'AIRTABLE_TOKEN and AIRTABLE_BASE_ID to .env.local, or add a ' +
        'fetchPublicData() fallback to the calling data module.'
    )
  }

  const allRecords: AirtableRawRecord[] = []
  let offset: string | null = null

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${baseId}/${options.tableId}`
    )
    if (options.viewId) {
      url.searchParams.set('view', options.viewId)
    }
    if (options.filterByFormula) {
      url.searchParams.set('filterByFormula', options.filterByFormula)
    }
    if (options.sort) {
      options.sort.forEach((s, i) => {
        url.searchParams.set(`sort[${i}][field]`, s.field)
        url.searchParams.set(`sort[${i}][direction]`, s.direction)
      })
    }
    if (options.fields) {
      options.fields.forEach(f => url.searchParams.append('fields[]', f))
    }
    if (options.returnFieldsByFieldId) {
      url.searchParams.set('returnFieldsByFieldId', 'true')
    }
    if (offset) {
      url.searchParams.set('offset', offset)
    }

    // Pagination iterators expire in minutes, so per-page caching would
    // serve stale offsets and trigger 422 LIST_RECORDS_ITERATOR_NOT_AVAILABLE.
    // The aggregated result is cached below via unstable_cache instead.
    const response = await fetchAirtableWithRetry(url.toString(), token, {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(
        `Airtable API error: ${response.status} for table ${options.tableId}`
      )
    }

    const data = await response.json()
    allRecords.push(...(data.records as AirtableRawRecord[]))
    offset = data.offset || null
  } while (offset)

  await mirrorAttachments(allRecords)

  return allRecords
}

// unstable_cache keys on the stringified arguments automatically; the
// static keyParts below are just a namespace tag for invalidation. Bump the
// version segment to force a fresh fetch on deploy after an Airtable schema
// change (e.g. the self-study Category/Type -> Focus/Format rename), so cached
// records under the old field shape can't be served to new code.
export const fetchAirtableRecords = unstable_cache(
  fetchAirtableRecordsImpl,
  // v3: attachment URLs moved from local paths to Vercel Blob.
  ['airtable-records', 'v3'],
  // The tag lets /api/check-rebuild invalidate these entries the minute an
  // Airtable change is detected, so runtime consumers (assistant catalog,
  // search index) don't wait out the hourly revalidate that static pages
  // bypass via rebuilds.
  { revalidate: 3600, tags: ['airtable-records'] }
)
