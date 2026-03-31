'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import QRCode from 'qrcode'
import styles from './page.module.css'
import { MapOrg } from '@/lib/data/map'

interface D3PosterMapProps {
  orgs: MapOrg[]
}

// Map constants from WebFlow
const MAP_WIDTH = 2485
const MAP_HEIGHT = 1355
const PADDING_FACTOR = 1.1
const PADDED_WIDTH = MAP_WIDTH * PADDING_FACTOR
const PADDED_HEIGHT = MAP_HEIGHT * PADDING_FACTOR
const GRID_SIZE = MAP_WIDTH / 60
const BACKGROUND_IMAGE_URL =
  'https://cdn.prod.website-files.com/65380b51b01b69a63d681e04/67e5dce03ad758280cd8367c_Map%201.5.1.svg'

// Logo size scales
const SIZE_TO_SCALE: Record<string, number> = {
  small: 0.4,
  Small: 0.4,
  medium: 0.6,
  Medium: 0.6,
  large: 0.8,
  Large: 0.8,
}
const BASE_LOGO_SIZE = 64
const LOGO_GLOBAL_SCALE = 1.0
const PILL_GLOBAL_SCALE = 1.5

// QR code sizing: 5mm on a 160cm poster
const QR_SIZE_MM = 5
const POSTER_WIDTH_MM = 1600
const PIXELS_PER_MM = MAP_WIDTH / POSTER_WIDTH_MM
const QR_SIZE = QR_SIZE_MM * PIXELS_PER_MM // ~7.8 pixels

// Area labels from WebFlow
const AREA_LABELS = [
  { label: 'Conceptual Cliffs', x: 46, y: 5.5 },
  { label: 'Resource Rock', x: 3.5, y: 8 },
  { label: 'Support Shoreline', x: 13, y: 6.7 },
  { label: 'Newsletter Nook', x: 15.8, y: 14.5 },
  { label: 'Video Vista', x: 23, y: 5.6 },
  { label: 'Funding Forest', x: 29.2, y: 7 },
  { label: 'Governance Grove', x: 37.7, y: 5.5 },
  { label: 'Strategy Summit', x: 34.8, y: 19 },
  { label: 'Research Range', x: 45.3, y: 15.9 },
  { label: 'Training Town', x: 22.2, y: 17.2 },
  { label: 'Empirical Escarpment', x: 53.5, y: 16 },
  { label: 'Podcast Port', x: 9.5, y: 20.5 },
  { label: 'Blog Beach', x: 15, y: 25.8 },
  { label: 'Forecasting Falls', x: 39.2, y: 23.8 },
  { label: 'Career Castle', x: 30.5, y: 29.4 },
  { label: 'Advocacy Anchorage', x: 8, y: 31 },
  { label: 'Capabilities Cove', x: 45, y: 27.1 },
  { label: 'Gone Graveyard', x: 56, y: 30 },
]

export default function D3PosterMap({ orgs }: D3PosterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || orgs.length === 0) return

    // Clear any existing SVG
    d3.select(containerRef.current).select('svg').remove()

    // Create SVG
    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${PADDED_WIDTH} ${PADDED_HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')

    // Create main group with offset (centered, matching poster backup)
    const offsetX = (PADDED_WIDTH - MAP_WIDTH) / 2
    const offsetY = (PADDED_HEIGHT - MAP_HEIGHT) / 2
    const svgGroup = svg
      .append('g')
      .attr('transform', `translate(${offsetX}, ${offsetY})`)

    // Check if on mobile
    const isMobile = window.innerWidth < 768
    const maxZoom = isMobile ? 25 : 8

    // Set up zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, maxZoom])
      .on('zoom', event => {
        const newX = event.transform.x + offsetX
        const newY = event.transform.y + offsetY
        svgGroup.attr(
          'transform',
          `translate(${newX}, ${newY}) scale(${event.transform.k})`
        )
      })

    svg.call(zoom)

    // Add background image
    svgGroup
      .append('image')
      .attr('xlink:href', BACKGROUND_IMAGE_URL)
      .attr('width', MAP_WIDTH)
      .attr('height', MAP_HEIGHT)
      .attr('x', 0)
      .attr('y', 0)

    // Add main title
    const titleX = 30 * GRID_SIZE
    const titleY = 2.5 * GRID_SIZE
    svgGroup
      .append('text')
      .attr('x', titleX)
      .attr('y', titleY)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Inter, sans-serif')
      .attr('font-weight', 400)
      .attr('font-size', 75)
      .style('letter-spacing', '-0.64px')
      .attr('fill', '#fff')
      .text('Map of AI Existential Safety')

    // Add area labels
    const labelScale = 1.75
    const baseFontSize = 14
    const basePadX = 14
    const basePadY = 7
    const finalFontSize = baseFontSize * labelScale
    const finalPadX = basePadX * labelScale
    const finalPadY = basePadY * labelScale

    AREA_LABELS.forEach(({ label, x, y }) => {
      const xPos = x * GRID_SIZE
      const yPos = y * GRID_SIZE

      const labelGroup = svgGroup
        .append('g')
        .attr('transform', `translate(${xPos}, ${yPos})`)
        .style('user-select', 'none')
        .style('pointer-events', 'none')

      const textEl = labelGroup
        .append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-weight', 500)
        .attr('font-size', finalFontSize)
        .style('letter-spacing', '-0.02em')
        .attr('fill', '#fff')
        .text(label)

      const bbox = textEl.node()?.getBBox()
      if (bbox) {
        labelGroup
          .insert('rect', 'text')
          .attr('x', bbox.x - finalPadX)
          .attr('y', bbox.y - finalPadY)
          .attr('width', bbox.width + finalPadX * 2)
          .attr('height', bbox.height + finalPadY * 2)
          .attr('rx', (bbox.height + finalPadY * 2) / 2)
          .attr('ry', (bbox.height + finalPadY * 2) / 2)
          .attr('fill', 'rgba(27, 43, 62, 0.6)')
      }
    })

    // Render organization logos with QR codes
    orgs.forEach((org, i) => {
      if (org.x === null || org.y === null) return

      const xPos = org.x * GRID_SIZE
      const yPos = org.y * GRID_SIZE

      // Calculate logo size based on scale
      const sizeValue = (org.scale || 'Medium').toLowerCase()
      const rawScale = SIZE_TO_SCALE[sizeValue] || 0.6
      const combinedPillScale = rawScale * PILL_GLOBAL_SCALE
      const combinedLogoScale = rawScale * LOGO_GLOBAL_SCALE
      const iconSize = BASE_LOGO_SIZE * combinedLogoScale
      const padding = 2
      const contentSize = iconSize - 2 * padding

      // Create link group (no hover effects for poster)
      const itemGroup = svgGroup
        .append('g')
        .attr('transform', `translate(${xPos}, ${yPos})`)

      const linkEl = itemGroup
        .append('a')
        .attr('xlink:href', org.link)
        .attr('target', '_blank')

      // White circle background
      linkEl
        .append('circle')
        .attr('r', iconSize / 2)
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('fill', '#fff')

      // Logo image
      if (org.mapLogo) {
        const uniqueId = `logo-pattern-${Math.random().toString(36).substring(2, 11)}`
        const patternId = `pattern-${uniqueId}`
        const img = new Image()
        img.src = org.mapLogo

        img.onload = function () {
          const { width, height } = img
          const scaleFactor = contentSize / Math.max(width, height)
          const finalWidth = width * scaleFactor
          const finalHeight = height * scaleFactor
          const oX = (contentSize - finalWidth) / 2
          const oY = (contentSize - finalHeight) / 2

          const localDefs = linkEl.append('defs')
          const pattern = localDefs
            .append('pattern')
            .attr('id', patternId)
            .attr('patternUnits', 'objectBoundingBox')
            .attr('width', 1)
            .attr('height', 1)

          pattern
            .append('image')
            .attr('xlink:href', org.mapLogo)
            .attr('width', finalWidth)
            .attr('height', finalHeight)
            .attr('x', oX)
            .attr('y', oY)

          linkEl
            .append('circle')
            .attr('r', contentSize / 2)
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('fill', `url(#${patternId})`)
        }

        img.onerror = function () {
          linkEl
            .append('circle')
            .attr('r', contentSize / 2)
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('fill', '#f70')
        }
      } else {
        linkEl
          .append('circle')
          .attr('r', contentSize / 2)
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('fill', 'red')
      }

      // Add label with QR code below logo
      const labelName = org.shortName || org.title
      const labelOffset = 5.5 + 5 * combinedPillScale
      const labelY = iconSize / 2 + labelOffset
      const fontSize = 6 * combinedPillScale

      const labelG = linkEl
        .append('g')
        .attr('transform', `translate(0, ${labelY})`)

      // Create text element
      const textEl = labelG
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-weight', 600)
        .attr('font-size', fontSize)
        .style('letter-spacing', '-0.02em')
        .attr('fill', '#000')
        .text(labelName)

      const bbox = textEl.node()?.getBBox()
      if (bbox) {
        const padX = 6 * combinedPillScale
        const padY = 3 * combinedPillScale
        const gapBetweenTextAndQR = 3 * combinedPillScale
        const hasLink = org.link && org.link !== '#'

        const totalContentWidth = hasLink
          ? bbox.width + gapBetweenTextAndQR + QR_SIZE
          : bbox.width

        const rectW = totalContentWidth + padX * 2
        const rectH = Math.max(bbox.height + padY * 2, QR_SIZE + padY * 2)

        // Position text to the left if QR code will be added
        if (hasLink) {
          const textX = -totalContentWidth / 2 + bbox.width / 2
          textEl.attr('x', textX)
        }

        textEl.attr('y', bbox.height * 0.35)

        // Draw pill background
        labelG
          .insert('rect', 'text')
          .attr('x', -rectW / 2)
          .attr('y', -rectH / 2)
          .attr('width', rectW)
          .attr('height', rectH)
          .attr('rx', rectH / 2)
          .attr('ry', rectH / 2)
          .attr('fill', '#fff')

        // Add QR code if URL exists
        if (hasLink) {
          const qrX =
            -totalContentWidth / 2 +
            bbox.width +
            gapBetweenTextAndQR +
            QR_SIZE / 2

          const qrGroup = labelG
            .append('g')
            .attr('transform', `translate(${qrX}, 0)`)

          // Use short URL if available, fall back to full URL
          const urlForQR = org.link

          // Generate QR code as data URL
          QRCode.toDataURL(urlForQR, {
            errorCorrectionLevel: 'L',
            margin: 0,
            width: 256,
            color: {
              dark: '#000000',
              light: '#00000000', // transparent background
            },
          })
            .then((dataUrl: string) => {
              qrGroup
                .append('image')
                .attr('xlink:href', dataUrl)
                .attr('x', -QR_SIZE / 2)
                .attr('y', -QR_SIZE / 2)
                .attr('width', QR_SIZE)
                .attr('height', QR_SIZE)
                .attr('preserveAspectRatio', 'xMidYMid meet')
            })
            .catch((err: Error) => {
              console.error(`QR code error for ${labelName}:`, err)
            })
        }
      }

      // Invisible gap rect between logo and label for click area
      linkEl
        .append('rect')
        .attr('x', -iconSize / 2)
        .attr('y', iconSize / 2)
        .attr('width', iconSize)
        .attr('height', labelOffset)
        .attr('fill', 'rgba(0,0,0,0)')
        .style('pointer-events', 'all')
    })

    // Setup zoom controls
    const zoomIn = document.getElementById('poster-zoom-in')
    const zoomOut = document.getElementById('poster-zoom-out')
    const recenter = document.getElementById('poster-recenter')

    if (zoomIn) {
      zoomIn.onclick = () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.5)
      }
    }
    if (zoomOut) {
      zoomOut.onclick = () => {
        svg.transition().duration(300).call(zoom.scaleBy, 0.75)
      }
    }
    if (recenter) {
      recenter.onclick = () => {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity)
      }
    }

    const container = containerRef.current
    return () => {
      if (container) {
        d3.select(container).select('svg').remove()
      }
    }
  }, [orgs])

  return (
    <>
      <div ref={containerRef} className={styles['map-container']} />

      {/* Zoom controls - pink themed */}
      <div className={styles['map-controls']}>
        <div className={styles['map-control-group']}>
          <button
            id="poster-zoom-in"
            className={styles['map-control-button']}
            title="Zoom in"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 2.5C8.27614 2.5 8.5 2.72386 8.5 3V7.5H13C13.2761 7.5 13.5 7.72386 13.5 8C13.5 8.27614 13.2761 8.5 13 8.5H8.5V13C8.5 13.2761 8.27614 13.5 8 13.5C7.72386 13.5 7.5 13.2761 7.5 13V8.5H3C2.72386 8.5 2.5 8.27614 2.5 8C2.5 7.72386 2.72386 7.5 3 7.5H7.5V3C7.5 2.72386 7.72386 2.5 8 2.5Z"
                fill="white"
              />
            </svg>
          </button>
          <button
            id="poster-zoom-out"
            className={styles['map-control-button']}
            title="Zoom out"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2.5 8C2.5 7.72386 2.72386 7.5 3 7.5H13C13.2761 7.5 13.5 7.72386 13.5 8C13.5 8.27614 13.2761 8.5 13 8.5H3C2.72386 8.5 2.5 8.27614 2.5 8Z"
                fill="white"
              />
            </svg>
          </button>
          <button
            id="poster-recenter"
            className={styles['map-control-button']}
            title="Reset view"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"
                fill="white"
              />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
