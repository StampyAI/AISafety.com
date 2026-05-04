import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { unstable_cache } from 'next/cache'

export interface AirtableRawRecord {
  id: string
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
}

const CACHE_DIR = path.join(process.cwd(), 'public', 'images', 'airtable-cache')
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
]

function getExtension(url: string, filename: string): string {
  const filenameExt = path.extname(filename).toLowerCase()
  if (filenameExt && ALLOWED_EXTENSIONS.includes(filenameExt)) {
    return filenameExt
  }

  const urlPath = new URL(url).pathname
  const urlExt = path.extname(urlPath).toLowerCase()
  if (urlExt && ALLOWED_EXTENSIONS.includes(urlExt)) {
    return urlExt
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
  const networkErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EPIPE',
    'EAI_AGAIN',
    'socket hang up',
  ]
  return networkErrors.some(e => message.includes(e))
}

function downloadFileOnce(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    file.on('error', err => {
      reject(err)
    })
    const protocol = url.startsWith('https') ? https : http

    protocol
      .get(url, response => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            file.close()
            fs.unlinkSync(dest)
            downloadFileOnce(redirectUrl, dest).then(resolve).catch(reject)
            return
          }
        }

        if (response.statusCode !== 200) {
          file.close()
          fs.unlinkSync(dest)
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }

        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', err => {
        file.close()
        fs.unlink(dest, () => {})
        reject(err)
      })
  })
}

async function downloadFile(url: string, dest: string): Promise<void> {
  for (let attempt = 0; attempt <= DOWNLOAD_MAX_RETRIES; attempt++) {
    try {
      await downloadFileOnce(url, dest)
      return
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
}

interface DownloadTask {
  recordId: string
  fieldName: string
  attachment: AirtableAttachment
  localPath: string
  localUrl: string
}

async function downloadAttachments(
  records: AirtableRawRecord[]
): Promise<void> {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }

  const tasks: DownloadTask[] = []

  for (const record of records) {
    for (const [fieldName, value] of Object.entries(record.fields)) {
      if (!isAttachmentArray(value)) continue

      const attachment = value[0]
      const ext = getExtension(attachment.url, attachment.filename)
      // Use attachment.id in filename so cache auto-invalidates when image is replaced in Airtable
      const localFilename = `${attachment.id}${ext}`
      const localPath = path.join(CACHE_DIR, localFilename)
      const localUrl = `/images/airtable-cache/${localFilename}`

      if (fs.existsSync(localPath)) {
        // Already cached, just update the URL
        value[0] = { ...attachment, url: localUrl }
        continue
      }

      tasks.push({
        recordId: record.id,
        fieldName,
        attachment,
        localPath,
        localUrl,
      })
    }
  }

  if (tasks.length === 0) return

  console.log(`Downloading ${tasks.length} attachments...`)

  const failures: string[] = []

  // Download in parallel with concurrency limit
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(task => downloadFile(task.attachment.url, task.localPath))
    )

    for (let j = 0; j < results.length; j++) {
      const task = batch[j]
      const result = results[j]
      const record = records.find(r => r.id === task.recordId)

      if (result.status === 'fulfilled' && record) {
        const field = record.fields[task.fieldName]
        if (isAttachmentArray(field)) {
          field[0] = { ...field[0], url: task.localUrl }
        }
      } else if (result.status === 'rejected') {
        failures.push(
          `${task.fieldName} for ${task.recordId}: ${result.reason}`
        )
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Failed to download ${failures.length} attachments:\n${failures.join('\n')}`
    )
  }
}

// Airtable's documented rate limit is 5 req/sec per base. Build-time
// fan-out across many tables can burst past that, so retry 429s with
// real backoff (exponential, plus the Retry-After header when present).
const FETCH_MAX_RETRIES = 5
const FETCH_RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])
const RATE_LIMIT_BASE_DELAY_MS = 30_000
const TRANSIENT_BASE_DELAY_MS = 1_000

async function fetchAirtablePage(
  url: string,
  token: string
): Promise<Response> {
  for (let attempt = 0; attempt <= FETCH_MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
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
  throw new Error('fetchAirtablePage exhausted retries without returning')
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
    console.error('Airtable credentials not configured')
    return []
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
    if (offset) {
      url.searchParams.set('offset', offset)
    }

    // Pagination iterators expire in minutes, so per-page caching would
    // serve stale offsets and trigger 422 LIST_RECORDS_ITERATOR_NOT_AVAILABLE.
    // The aggregated result is cached below via unstable_cache instead.
    const response = await fetchAirtablePage(url.toString(), token)

    if (!response.ok) {
      throw new Error(
        `Airtable API error: ${response.status} for table ${options.tableId}`
      )
    }

    const data = await response.json()
    allRecords.push(...(data.records as AirtableRawRecord[]))
    offset = data.offset || null
  } while (offset)

  await downloadAttachments(allRecords)

  return allRecords
}

// unstable_cache keys on the stringified arguments automatically; the
// static keyParts below are just a namespace tag for invalidation.
export const fetchAirtableRecords = unstable_cache(
  fetchAirtableRecordsImpl,
  ['airtable-records'],
  { revalidate: 3600 }
)
