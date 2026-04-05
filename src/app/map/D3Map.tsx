'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import styles from './page.module.css'

interface MapOrg {
  id: string
  title: string
  tooltipTitle: string
  shortName: string | null
  description: string
  category: string
  link: string
  mapLogo: string | null
  x: number | null
  y: number | null
  scale: string | null
}

interface D3MapProps {
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

// Logo size scales (handle both cases)
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

export default function D3Map({ orgs }: D3MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Position tooltip with edge detection (matches communities map)
  function positionTooltip(
    event: MouseEvent,
    tt: HTMLDivElement,
    container: HTMLDivElement
  ) {
    const mapRect = container.getBoundingClientRect()
    const cursorX = event.clientX
    const cursorY = event.clientY
    const tooltipWidth = tt.offsetWidth
    const tooltipHeight = tt.offsetHeight
    const offset = 15

    let finalY: number
    const spaceBelow = mapRect.bottom - (cursorY + offset)
    const spaceAbove = cursorY - offset - mapRect.top
    if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
      finalY = cursorY + offset
      if (finalY + tooltipHeight > mapRect.bottom)
        finalY = mapRect.bottom - tooltipHeight - 2
    } else {
      finalY = cursorY - offset - tooltipHeight
      if (finalY < mapRect.top) finalY = mapRect.top + 2
    }

    let finalX: number
    const spaceRight = mapRect.right - (cursorX + offset)
    const spaceLeft = cursorX - offset - mapRect.left
    if (spaceRight >= tooltipWidth || spaceRight >= spaceLeft) {
      finalX = cursorX + offset
      if (finalX + tooltipWidth > mapRect.right)
        finalX = mapRect.right - tooltipWidth - 2
    } else {
      finalX = cursorX - offset - tooltipWidth
      if (finalX < mapRect.left) finalX = mapRect.left + 2
    }

    tt.style.left = finalX + 'px'
    tt.style.top = finalY + 'px'
  }

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
      .attr('preserveAspectRatio', 'xMidYMin meet')

    svgRef.current = svg.node()

    // Create main group with offset
    const offsetX = (PADDED_WIDTH - MAP_WIDTH) / 2
    const offsetY = (PADDED_HEIGHT - MAP_HEIGHT) / 20
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
        // Hide tooltip on zoom/pan
        if (tooltipRef.current) {
          tooltipRef.current.style.visibility = 'hidden'
          tooltipRef.current.style.opacity = '0'
        }
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
      .attr('font-size', 72)
      .style('letter-spacing', '-2.16px')
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
        .attr('font-weight', 600)
        .attr('font-size', finalFontSize)
        .style('letter-spacing', '-0.01em')
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

    // Render organization logos
    orgs.forEach(org => {
      if (org.x === null || org.y === null) return

      const xPos = org.x * GRID_SIZE
      const yPos = org.y * GRID_SIZE

      // Calculate logo size based on scale (matching WebFlow)
      const rawScale = SIZE_TO_SCALE[org.scale || 'Medium'] || 0.6
      const iconSize = BASE_LOGO_SIZE * rawScale * LOGO_GLOBAL_SCALE
      const padding = 2
      const contentSize = iconSize - 2 * padding

      // Create item group with translate, then link inside (matching Webflow structure)
      const itemGroup = svgGroup
        .append('g')
        .attr('transform', `translate(${xPos}, ${yPos})`)
      // QA: Items with no real link (e.g. "Last updated") should render
      // on the map but not be clickable
      const hasLink = org.link && org.link !== '#'
      const linkEl = itemGroup
        .append(hasLink ? 'a' : 'g')
        .attr('class', 'mapItem')
      if (hasLink) {
        linkEl
          .attr('xlink:href', org.link)
          .attr('target', '_blank')
          .style('cursor', 'pointer')
      }

      // White circle background
      linkEl
        .append('circle')
        .attr('r', iconSize / 2)
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('fill', '#fff')

      // Logo image - copied directly from WebFlow implementation
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
          const offsetX = (contentSize - finalWidth) / 2
          const offsetY = (contentSize - finalHeight) / 2

          // Create defs inside linkEl (as per WebFlow)
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
            .attr('x', offsetX)
            .attr('y', offsetY)

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

      // Add label below logo
      const labelName = org.shortName || org.title
      const labelOffset = 11 * rawScale * 1.5
      const labelY = iconSize / 2 + labelOffset
      const fontSize = 6 * rawScale * 1.5

      const labelG = linkEl
        .append('g')
        .attr('transform', `translate(0, ${labelY})`)

      const textEl = labelG
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-weight', 600)
        .attr('font-size', fontSize)
        .style('letter-spacing', '-0.02em')
        .attr('fill', '#000')
        .text(labelName)

      // Get text bounding box and add background pill
      const bbox = textEl.node()?.getBBox()
      if (bbox) {
        const padX = 6 * rawScale * 1.5
        const padY = 3 * rawScale * 1.5
        const rectW = bbox.width + padX * 2
        const rectH = bbox.height + padY * 2

        labelG
          .insert('rect', 'text')
          .attr('x', -rectW / 2)
          .attr('y', -rectH / 2)
          .attr('width', rectW)
          .attr('height', rectH)
          .attr('rx', rectH / 2)
          .attr('ry', rectH / 2)
          .attr('fill', '#fff')

        textEl.attr('y', bbox.height * 0.35)

        // QA: Add invisible rect filling the gap between circle and label pill.
        // Without this, moving the mouse through the empty gap fires mouseleave,
        // causing the tooltip to flicker. This matches the live site's gapRect.
        linkEl
          .append('rect')
          .attr('x', -iconSize / 2)
          .attr('y', iconSize / 2)
          .attr('width', iconSize)
          .attr('height', labelOffset)
          .attr('fill', 'rgba(0,0,0,0)')
          .style('pointer-events', 'all')

        // QA: Add a wider invisible bridge rect that slightly overlaps both the
        // circle and the pill. This provides a more forgiving hover zone so the
        // tooltip doesn't disappear when the cursor drifts slightly outside the
        // narrow gap. Pushed to the back so it doesn't block clicks on other items.
        // Matches the live site's addUnifiedHoverArea.
        const bridgeWidth = iconSize * 0.8
        linkEl
          .append('rect')
          .attr('x', -bridgeWidth / 2)
          .attr('y', iconSize / 2 - 2)
          .attr('width', bridgeWidth)
          .attr('height', labelOffset + 4)
          .attr('fill', 'rgba(0,0,0,0)')
          .style('pointer-events', 'all')
          .lower()
      }

      // Tooltip events with smart edge-detection positioning
      linkEl
        .on('mouseenter', event => {
          const tt = tooltipRef.current
          const container = containerRef.current
          if (!tt || !container) return
          // QA: Use tooltipTitle ('Long name') not title ('Long name for cards')
          // so bracketed acronyms like "(CARMA)" don't appear in the tooltip
          tt.querySelector('strong')!.textContent = org.tooltipTitle
          tt.querySelector('span')!.textContent = org.description
          tt.style.visibility = 'visible'
          tt.style.opacity = '1'
          positionTooltip(event, tt, container)
        })
        .on('mousemove', event => {
          const tt = tooltipRef.current
          const container = containerRef.current
          if (!tt || !container) return
          positionTooltip(event, tt, container)
        })
        .on('mouseleave', () => {
          if (tooltipRef.current) {
            tooltipRef.current.style.visibility = 'hidden'
            tooltipRef.current.style.opacity = '0'
          }
        })
    })

    // Setup zoom controls
    const zoomIn = document.getElementById('zoom-in')
    const zoomOut = document.getElementById('zoom-out')
    const recenter = document.getElementById('recenter')

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

      {/* Zoom controls - styled to match communities map */}
      <div className={styles['map-controls']}>
        <div className={styles['map-control-group']}>
          <button
            id="zoom-in"
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
            id="zoom-out"
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
            id="recenter"
            className={styles['map-control-button']}
            title="Reset view"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM2.5 8a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"
                fill="white"
              />
              <circle cx="8" cy="8" r="1.5" fill="white" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tooltip — always in DOM for measuring, visibility toggled via ref */}
      <div
        ref={tooltipRef}
        className={styles['map-tooltip']}
        style={{ visibility: 'hidden', opacity: 0 }}
      >
        <strong></strong>
        <span></span>
      </div>
    </>
  )
}
