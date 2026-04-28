import { fetchAirtableRecords } from './airtable'

// Each resource's table ID, view to count from, and a minimal field to fetch.
// adjust: manual correction for counts that don't match the live site exactly.
const resources = [
  {
    path: '/events',
    tableId: 'tblx0L8qJEaLBxJFS',
    viewId: 'viwHl72bJxCb2SfrL',
    field: 'Name',
  },
  {
    path: '/map',
    tableId: 'tblvzbGL9q9dOO9Nc',
    viewId: 'viwJgtDFDmaP8PyoI',
    field: 'Long name',
    adjust: -4, // Grid view includes 4 category header rows that aren't displayed on the site
  },
  {
    path: '/communities',
    tableId: 'tbluI5Dll697WiSm8',
    viewId: 'viwFIU3lKQHZlpc0b',
    field: 'Name',
  },
  {
    path: '/self-study',
    tableId: 'tblRNYJ0m1cmJXKKk',
    viewId: 'viwblgaia3x1gsqBo',
    field: 'Name',
    adjust: 1, // View excludes one published record that's shown on the site
  },
  {
    path: '/jobs',
    tableId: 'tblyLelYCQjP6w3nV',
    viewId: 'viwBfn9CIUVqQHUy6',
    field: '!Title',
  },
  {
    path: '/funding',
    tableId: 'tblzMTLDZWZKqTxrq',
    viewId: 'viwxv2w8utSEhUeiJ',
    field: 'Name',
  },
  {
    path: '/media-channels',
    tableId: 'tblCTOMzyH3vILL5I',
    viewId: 'viwT8KTwupcVyGKLZ',
    field: 'Name',
  },
  {
    path: '/advisors',
    tableId: 'tblf3KKYnmgcjVGhD',
    viewId: 'viwIdRmaCar2Y6gPi',
    field: 'Name',
  },
  {
    path: '/projects',
    tableId: 'tblHT29QNgMYKB8iW',
    viewId: 'viwVgPN3hgpGa8dRE',
    field: 'Project Name',
  },
  {
    path: '/founders',
    tableId: 'tbl59Ye8oxvPjoVJv',
    viewId: 'viwzMBhPBk1GpQXnn',
    field: 'Name',
  },
]

// Serialized to avoid hitting Airtable's 5 req/sec rate limit.
// Called at build time (static generation) so latency doesn't matter.
export async function fetchAllCounts(): Promise<
  Partial<Record<string, number>>
> {
  const counts: Partial<Record<string, number>> = {}
  for (const r of resources) {
    const raw = await fetchAirtableRecords({
      tableId: r.tableId,
      viewId: r.viewId,
      fields: [r.field],
    })
    counts[r.path] = raw.length + (r.adjust ?? 0)
  }
  return counts
}
