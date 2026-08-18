import MapEditor from './MapEditor'

// Nothing here is prerendered: the editor reads Airtable live in the browser
// via /api/admin/map, so a build never touches the Map table for this page.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function MapEditorPage() {
  return <MapEditor />
}
