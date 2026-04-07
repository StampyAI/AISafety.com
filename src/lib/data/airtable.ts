import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

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

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif']

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

function downloadFile(url: string, dest: string): Promise<void> {
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
            downloadFile(redirectUrl, dest).then(resolve).catch(reject)
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

export async function fetchAirtableRecords(
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

    let response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 }, // Hourly revalidation fetches fresh API responses with valid attachment URLs
    })

    if (!response.ok) {
      console.warn(`Airtable API error (${response.status}), retrying...`)
      await new Promise(r => setTimeout(r, 1000))
      response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 3600 }, // Retry also uses hourly revalidation
      })
    }

    if (!response.ok) {
      throw new Error(`Airtable API error after retry: ${response.status}`)
    }

    const data = await response.json()
    allRecords.push(...(data.records as AirtableRawRecord[]))
    offset = data.offset || null
  } while (offset)

  // Download all attachments and replace URLs with local paths
  await downloadAttachments(allRecords)

  return allRecords
}
