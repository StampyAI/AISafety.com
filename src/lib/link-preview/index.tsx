import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { SITE_PAGES, type SitePage } from '@/lib/site-pages'

/**
 * Renders the 1200×630 link-preview card for a page. It is the homepage card
 * (public/images/link-preview.png) with two changes: the headline is the page
 * name, and the page's own pill sits second in the list with a teal glow.
 *
 * Geometry, type sizes and colors are measured from the homepage card so the
 * two match. background.png is that card's teal gradient with the text and
 * pills removed (a smooth surface fitted to its empty areas).
 *
 * Each route's `opengraph-image.tsx` calls this with its SITE_PAGES entry.
 * Next generates the PNG at build time, so the fonts and images are read from
 * the repo rather than fetched.
 */

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ASSET_DIR = join(process.cwd(), 'src/lib/link-preview')
const ICON_DIR = join(process.cwd(), 'public/images/icons')

// The five pills on the homepage card, in its order. The current page takes
// the second slot (the first is clipped by the top edge) and the rest follow.
const PILL_ORDER = ['jobs', 'events', 'communities', 'map', 'advisors'] as const
const PILL = { left: 637, width: 486, height: 124, pitch: 144, firstTop: -40 }
const DISC = 104
const ICON = 40

// Nav icons are drawn in --teal-300; on the white discs they are --teal-bright-800.
const ICON_SOURCE_COLOR = /#AAB2B3/gi
const ICON_COLOR = '#094141'

const svgDataUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

export async function linkPreviewImage(page: SitePage) {
  const others = PILL_ORDER.map(key => SITE_PAGES[key]).filter(
    p => p.path !== page.path
  )
  const pills: SitePage[] = [others[0], page, ...others.slice(1)].slice(0, 5)

  const [regular, semibold, background, ...icons] = await Promise.all([
    readFile(join(ASSET_DIR, 'Inter-Regular.ttf')),
    readFile(join(ASSET_DIR, 'Inter-SemiBold.ttf')),
    readFile(join(ASSET_DIR, 'background.png')),
    ...pills.map(p => readFile(join(ICON_DIR, p.icon), 'utf8')),
  ])

  return new ImageResponse(
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#00191b',
        fontFamily: 'Inter',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${background.toString('base64')}`}
        width={size.width}
        height={size.height}
        alt=""
        style={{ position: 'absolute', top: 0, left: 0 }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: PILL.left - 40,
          padding: '0 0 0 80px',
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: -0.6,
            color: '#88ccc9',
            marginBottom: 56,
          }}
        >
          AISafety.com
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 400,
            lineHeight: 1.17,
            letterSpacing: -4.32,
            color: '#ffffff',
          }}
        >
          {page.title}
        </div>
      </div>

      {pills.map((pill, i) => {
        const current = pill.path === page.path
        return (
          <div
            key={pill.path}
            style={{
              position: 'absolute',
              left: PILL.left,
              top: PILL.firstTop + i * PILL.pitch,
              width: PILL.width,
              height: PILL.height,
              display: 'flex',
              alignItems: 'center',
              borderRadius: PILL.height / 2,
              border: `2px solid ${current ? '#88ccc9' : '#46797b'}`,
              backgroundColor: current
                ? 'rgba(108, 189, 187, 0.14)'
                : 'transparent',
              // Satori rejects `boxShadow: undefined`, so only set it here.
              ...(current && {
                boxShadow: '0 0 44px rgba(108, 189, 187, 0.6)',
              }),
            }}
          >
            <div
              style={{
                width: DISC,
                height: DISC,
                marginLeft: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: DISC / 2,
                backgroundColor: '#ffffff',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={svgDataUri(
                  icons[i].replace(ICON_SOURCE_COLOR, ICON_COLOR)
                )}
                width={ICON}
                height={ICON}
                alt=""
              />
            </div>
            <div
              style={{
                marginLeft: 27,
                fontSize: 36,
                fontWeight: 600,
                color: '#ffffff',
              }}
            >
              {pill.title}
            </div>
          </div>
        )
      })}
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: semibold, weight: 600, style: 'normal' },
      ],
    }
  )
}
