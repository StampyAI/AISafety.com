/**
 * Append the site's UTM tags to an outbound link at render time, so the
 * destination org's analytics shows aisafety.com as the traffic source.
 * Stored URLs stay clean in Airtable — the tags exist only in the rendered
 * href. Matomo click events also keep recording the clean URL: call sites
 * tag the href but pass the original URL to the tracking call.
 *
 * Only absolute http(s) URLs to other sites are tagged. Internal links,
 * relative paths, and other schemes (mailto: etc.) pass through unchanged.
 * Any utm_* tags already on a stored URL are replaced with ours, so the
 * destination sees a single, consistent source (mirrors how 80,000 Hours
 * handles their job board links).
 *
 * @param page The page's tracking name (e.g. 'Media channels'), lowercased
 *   and hyphenated into the utm_campaign value (media-channels).
 */
export function withUtm(url: string, page: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    // Relative path (an internal link) or a placeholder like '#'.
    return url
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url
  const host = parsed.hostname.replace(/^www\./, '')
  if (host === 'aisafety.com' || host === 'localhost') return url

  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_')) parsed.searchParams.delete(key)
  }
  parsed.searchParams.set('utm_source', 'aisafety.com')
  parsed.searchParams.set('utm_medium', 'referral')
  parsed.searchParams.set('utm_campaign', page.toLowerCase().replace(/ /g, '-'))
  return parsed.toString()
}
