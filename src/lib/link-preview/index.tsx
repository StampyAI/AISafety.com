import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import type { SitePage } from '@/lib/site-pages'

/**
 * Renders the 1200×630 link-preview card for a page: wordmark, page title and
 * blurb on the left, and the page's nav icon in a white disc on the right,
 * echoing the pills on the homepage card (public/images/link-preview.png).
 *
 * background.png is that homepage card's teal gradient with the text and
 * pills removed (a smooth surface fitted to its empty areas), so the two
 * cards share the same backdrop.
 *
 * Each route's `opengraph-image.tsx` calls this with its SITE_PAGES entry.
 * Next generates the PNG at build time, so the fonts and images are read from
 * the repo rather than fetched.
 */

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ASSET_DIR = join(process.cwd(), 'src/lib/link-preview')
const ICON_DIR = join(process.cwd(), 'public/images/icons')

// Nav icons are drawn in --teal-300; recolor to --teal-900 for the white disc.
const ICON_SOURCE_COLOR = /#AAB2B3/gi
const ICON_COLOR = '#00191b'

const svgDataUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

export async function linkPreviewImage({ title, description, icon }: SitePage) {
  const [regular, medium, background, iconSvg] = await Promise.all([
    readFile(join(ASSET_DIR, 'Inter-Regular.ttf')),
    readFile(join(ASSET_DIR, 'Inter-Medium.ttf')),
    readFile(join(ASSET_DIR, 'background.png')),
    readFile(join(ICON_DIR, icon), 'utf8'),
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
          width: 760,
          padding: '0 0 0 80px',
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: -0.6,
            color: '#88ccc9',
            marginBottom: 40,
          }}
        >
          AISafety.com
        </div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: -4,
            color: '#f1faf9',
            marginBottom: 28,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 31,
            fontWeight: 400,
            lineHeight: 1.35,
            color: '#c6cccc',
          }}
        >
          {description}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 96,
          top: 165,
          width: 300,
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 150,
          border: '2px solid rgba(136, 204, 201, 0.45)',
        }}
      >
        <div
          style={{
            width: 272,
            height: 272,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 136,
            backgroundColor: '#ffffff',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={svgDataUri(iconSvg.replace(ICON_SOURCE_COLOR, ICON_COLOR))}
            width={136}
            height={136}
            alt=""
          />
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: medium, weight: 500, style: 'normal' },
      ],
    }
  )
}
