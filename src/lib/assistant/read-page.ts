// Fetches a listing's external webpage and reduces it to plain text the model
// can read. Used by the read_listing_page tool so the assistant can answer
// questions about a resource's specifics (curriculum, fees, format) from the
// live page instead of guessing from training memory.

const FETCH_TIMEOUT_MS = 6000
const MAX_REDIRECTS = 5
// Keep the text the model sees bounded: big enough for a typical program or
// curriculum page, small enough not to blow up latency/cost on huge pages.
const MAX_TEXT_CHARS = 12_000
// Hard cap on DECOMPRESSED bytes read off the wire. Applied while streaming,
// so a gzip bomb or runaway body can't be buffered into memory whole.
const MAX_BODY_BYTES = 2_000_000

// Same in-process idea as geocode.ts: pages get re-asked about within a
// conversation, so a short-lived per-instance cache saves repeat fetches.
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_ENTRIES = 50
const cache = new Map<string, { expires: number; result: ReadPageResult }>()

export type ReadPageResult =
  | {
      ok: true
      finalUrl: string
      title: string | null
      text: string
      truncated: boolean
    }
  | { ok: false; reason: string }

/** True only for http(s) urls pointing at public-looking hosts. Rejects the
 *  catalog's '#' no-link convention, mailto:, and internal/loopback hosts —
 *  re-run on every redirect hop, so a 3xx can't route the fetch somewhere the
 *  stored url couldn't have pointed. */
export function isReadableUrl(url: string | undefined): url is string {
  if (!url || url === '#') return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  // Curated links should never point at internal hosts; cheap belt-and-braces
  // so the tool can't be used to probe the server's own network.
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.includes(':') // bare IPv6
  ) {
    return false
  }
  return true
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
}

/** Single pass, so a decoded entity can never be re-interpreted as the start
 *  of another one ("&amp;lt;" → "&lt;", not "<"). */
function decodeEntities(s: string): string {
  return s.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
    (whole, dec, hex, named) => {
      if (dec || hex) {
        const code = dec ? Number(dec) : parseInt(hex, 16)
        return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
      }
      return NAMED_ENTITIES[named.toLowerCase()] ?? whole
    }
  )
}

const NON_CONTENT_TAGS = 'script|style|noscript|svg|iframe|template'

/** Strips an HTML document down to readable plain text plus its <title>. Not a
 *  full parser — good enough for "what does this page say", which is all the
 *  tool promises. */
export function htmlToText(html: string): {
  title: string | null
  text: string
} {
  // Prefer the document <title> in <head>; a page whose first <title> is an
  // SVG accessibility label shouldn't get that as its page title.
  const head = html.match(/<head[^>]*>[\s\S]*?<\/head\s*>/i)?.[0]
  const titleMatch =
    (head ?? html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch
    ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() || null
    : null
  const text = decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      // </head> is optional in HTML5, so strip the head up to its close tag OR
      // up to <body> — cutting "unclosed head to end" would nuke whole pages.
      .replace(/<head[^>]*>[\s\S]*?(?:<\/head\s*>|(?=<body\b))/i, ' ')
      .replace(
        new RegExp(`<(${NON_CONTENT_TAGS})\\b[\\s\\S]*?</\\1\\s*>`, 'gi'),
        ' '
      )
      // A script/style still present is unclosed (or the document was cut off
      // mid-tag by the byte cap) — drop everything from it onward so raw
      // JavaScript/CSS never leaks into the "readable text".
      .replace(/<(?:script|style)\b[\s\S]*$/i, ' ')
      // Block-level boundaries become line breaks so lists/headings keep shape.
      .replace(
        /<\/(p|div|li|ul|ol|h[1-6]|tr|section|article|header|footer|blockquote|table|dd|dt)\s*>/gi,
        '\n'
      )
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\r\u00a0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { title, text }
}

/** Fetches `url` and returns its readable text, or a plain-English reason it
 *  couldn't be read. Never throws. */
export async function readPage(url: string): Promise<ReadPageResult> {
  const hit = cache.get(url)
  if (hit && hit.expires > Date.now()) return hit.result

  const result = await fetchAndStrip(url)
  // Cache failures too: a blocked site stays blocked, and retrying it on every
  // follow-up question would just re-pay the timeout. Delete-before-set keeps
  // a refreshed key recent; evict the oldest entry only when actually growing.
  cache.delete(url)
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(url, { expires: Date.now() + CACHE_TTL_MS, result })
  return result
}

/** Reads the response body up to MAX_BODY_BYTES of decompressed data, then
 *  cancels the stream. Pages are decoded as UTF-8 (legacy-charset pages may
 *  mojibake; acceptable for this tool). */
async function readBodyCapped(
  res: Response
): Promise<{ body: string; capped: boolean }> {
  const reader = res.body?.getReader()
  if (!reader) return { body: await res.text(), capped: false }
  const decoder = new TextDecoder('utf-8')
  let body = ''
  let bytes = 0
  let capped = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_BODY_BYTES) {
      const keep = value.byteLength - (bytes - MAX_BODY_BYTES)
      body += decoder.decode(value.subarray(0, keep), { stream: true })
      capped = true
      await reader.cancel().catch(() => {})
      break
    }
    body += decoder.decode(value, { stream: true })
  }
  body += decoder.decode()
  return { body, capped }
}

async function fetchAndStrip(url: string): Promise<ReadPageResult> {
  // Follow redirects by hand so every hop is re-validated by isReadableUrl —
  // a curated site being compromised (or its domain lapsing) must not be able
  // to bounce this fetch onto localhost or an internal address.
  let currentUrl = url
  let res: Response | null = null
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isReadableUrl(currentUrl)) {
      return {
        ok: false,
        reason: 'The page redirected to an address that cannot be read.',
      }
    }
    try {
      res = await fetch(currentUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'manual',
        cache: 'no-store',
        headers: {
          // Browser-like UA: many curated sites serve bot UAs a challenge page
          // or nothing at all, and this fetch acts on behalf of a real visitor.
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
    } catch (err) {
      const timedOut =
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')
      console.warn(
        `[assistant] read_listing_page fetch failed for ${currentUrl}:`,
        err
      )
      return {
        ok: false,
        reason: timedOut
          ? 'The page took too long to respond.'
          : 'The page could not be reached (network error). This often just means the site blocks automated readers — it does NOT mean the link is broken for a normal visitor.',
      }
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) break
      try {
        currentUrl = new URL(location, currentUrl).toString()
      } catch {
        return {
          ok: false,
          reason: 'The page redirected to an invalid address.',
        }
      }
      res.body?.cancel().catch(() => {})
      res = null
      continue
    }
    break
  }
  if (!res) {
    return { ok: false, reason: 'The page redirected too many times.' }
  }

  if (!res.ok) {
    // 404/410 usually mean the page moved; most other error statuses (403,
    // 429, 503…) are typically bot-detection walls that a real visitor never
    // sees. Either way the model must not declare the link broken.
    const moved = res.status === 404 || res.status === 410
    return {
      ok: false,
      reason: moved
        ? `The page was not found at its stored address (HTTP ${res.status}) — the site may have reorganized. A normal visitor may still be redirected correctly, so do not declare the link broken.`
        : `The site responded with HTTP ${res.status}. This often just means the site blocks automated readers — it does NOT mean the link is broken for a normal visitor.`,
    }
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (
    !contentType.includes('text/html') &&
    !contentType.includes('application/xhtml') &&
    !contentType.includes('text/plain')
  ) {
    res.body?.cancel().catch(() => {})
    return {
      ok: false,
      reason: `The link is not a readable web page (content-type: ${contentType || 'unknown'}).`,
    }
  }

  let raw: string
  let bodyCapped = false
  try {
    const read = await readBodyCapped(res)
    raw = read.body
    bodyCapped = read.capped
  } catch (err) {
    console.warn(
      `[assistant] read_listing_page body read failed for ${currentUrl}:`,
      err
    )
    return { ok: false, reason: 'The page could not be read (transfer error).' }
  }

  const { title, text } = contentType.includes('text/plain')
    ? { title: null, text: raw.trim() }
    : htmlToText(raw)

  if (!text || text.length < 80) {
    return {
      ok: false,
      reason:
        'The page loaded but contained almost no readable text — it likely needs a real browser (JavaScript) to render its content.',
    }
  }

  const truncated = bodyCapped || text.length > MAX_TEXT_CHARS
  return {
    ok: true,
    finalUrl: res.url || currentUrl,
    title,
    text: text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text,
    truncated,
  }
}
