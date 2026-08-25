import { draftMode } from 'next/headers'

/** True when this request carries the Draft Mode cookie, i.e. an admin turned
 *  on preview mode at /admin/preview. Preview requests bypass every data cache
 *  and read Airtable live, so the admin sees an edit immediately on the real
 *  pages; requests without the cookie are completely unaffected and keep
 *  getting the prebuilt static pages. */
export async function isPreviewRequest(): Promise<boolean> {
  try {
    return (await draftMode()).isEnabled
  } catch {
    // draftMode() is only usable in request scope. Outside one (`next build`
    // prerendering pages, generating the sitemap) there is no cookie and so
    // no preview — never a real error to surface.
    return false
  }
}
