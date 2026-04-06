'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'
import Image from 'next/image'
import styles from './page.module.css'
import { Community } from '@/lib/data/communities'

interface CommunitiesMapProps {
  communities: Community[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    mapboxgl: any
  }
}

export default function CommunitiesMap({ communities }: CommunitiesMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  function initMap() {
    if (!mapContainerRef.current || !tooltipRef.current || !window.mapboxgl)
      return
    if (mapRef.current) return

    const mapboxgl = window.mapboxgl
    const mapContainer = mapContainerRef.current
    const tooltip = tooltipRef.current

    const mapCommunities = communities
      .filter(
        c =>
          c.latitude !== null &&
          c.longitude !== null &&
          !c.type.every(t => t.toLowerCase() === 'online')
      )
      .map(c => {
        const typeStr = c.type.join(' ').toLowerCase()
        let locationType = 'city'
        if (typeStr.includes('country')) locationType = 'country'
        else if (typeStr.includes('continent') || typeStr.includes('global'))
          locationType = 'continent'
        return {
          name: c.name,
          description: c.description,
          type: locationType,
          coordinates: [c.longitude!, c.latitude!] as [number, number],
          location: c.location || '',
          url: c.website || '',
          link: c.joinLink,
        }
      })

    mapboxgl.accessToken =
      'pk.eyJ1IjoiYWxpZ25tZW50ZWNvc3lzdGVtZGV2ZWxvcG1lbnQiLCJhIjoiY201YnNnbnpzNTEyNTJtcHYzMWVhand6OSJ9._HknM4VVUlEU6mbv8NagGw'

    const initialCenter: [number, number] = [0, 30]
    const initialZoom = 1.5

    const map = new mapboxgl.Map({
      container: mapContainer,
      style:
        'mapbox://styles/alignmentecosystemdevelopment/cmh1t3h6u00e401st9gu75gvq',
      center: initialCenter,
      zoom: initialZoom,
      logoPosition: 'bottom-right',
    })
    mapRef.current = map

    const isMobile = window.innerWidth < 768

    if (isMobile) {
      setTimeout(() => {
        const mapButtons = document.querySelectorAll(
          '.mapboxgl-ctrl-group button'
        )
        mapButtons.forEach(button => {
          button.addEventListener('touchend', function (this: HTMLElement) {
            setTimeout(() => this.blur(), 100)
          })
        })
      }, 500)
    }

    map.addControl(new mapboxgl.NavigationControl())

    // Mapbox doesn't auto-resize when its container changes size (e.g. via
    // CSS media queries). Watch the container and tell Mapbox to recalculate.
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(mapContainer)

    const customPin = new window.Image()
    customPin.crossOrigin = 'anonymous'

    customPin.onload = function () {
      map.on('load', function () {
        if (!map.hasImage('custom-pin')) {
          map.addImage('custom-pin', customPin)
        }

        let hoveredPinId: number | null = null
        let tappedPinId: number | null = null

        const geojsonData = {
          type: 'FeatureCollection' as const,
          features: mapCommunities.map((community, index) => ({
            type: 'Feature' as const,
            id: index,
            properties: {
              id: index,
              name: community.name,
              description: community.description,
              type: community.type,
              url: community.url,
              link: community.link,
              location: community.location,
              baseSize:
                community.type === 'city'
                  ? 0.25
                  : community.type === 'country'
                    ? 0.35
                    : 0.45,
              hover: false,
            },
            geometry: {
              type: 'Point' as const,
              coordinates: community.coordinates,
            },
          })),
        }

        map.addSource('communities', { type: 'geojson', data: geojsonData })

        map.addLayer({
          id: 'community-pins',
          type: 'symbol',
          source: 'communities',
          layout: {
            'icon-image': 'custom-pin',
            'icon-size': [
              'case',
              ['boolean', ['get', 'hover'], false],
              ['*', ['get', 'baseSize'], 1.2],
              ['get', 'baseSize'],
            ],
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
          },
        })

        function updateTooltipPosition(
          e: any,
          tt: HTMLDivElement,
          container: HTMLDivElement
        ) {
          const mapRect = container.getBoundingClientRect()
          const cursorX = e.originalEvent.clientX
          const cursorY = e.originalEvent.clientY
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

          if (isMobile) {
            const minLeftMargin = 20
            if (finalX < minLeftMargin) tt.style.left = minLeftMargin + 'px'
          }
        }

        function setData(data: any) {
          map.getSource('communities').setData(data)
        }

        function resetHover() {
          geojsonData.features.forEach((f: any) => (f.properties.hover = false))
          setData(geojsonData)
        }

        // Desktop hover
        map.on('mousemove', 'community-pins', (e: any) => {
          if (isMobile || !e.features || e.features.length === 0) {
            if (!isMobile && hoveredPinId !== null) {
              map.getCanvas().style.cursor = ''
              resetHover()
              hoveredPinId = null
              tooltip.style.display = 'none'
            }
            return
          }
          map.getCanvas().style.cursor = 'pointer'
          const feature = e.features[0]
          const currentFeatureId = feature.id as number
          if (hoveredPinId !== currentFeatureId) {
            geojsonData.features.forEach((f: any) => {
              f.properties.hover = f.id === currentFeatureId
            })
            setData(geojsonData)
            hoveredPinId = currentFeatureId
            const name = feature.properties?.name
            const description = feature.properties?.description
            const location = feature.properties?.location
            let tooltipHTML = `<strong class="paragraph-small-bold">${name}</strong>`
            if (location)
              tooltipHTML += `<span class="location-text">${location}</span>`
            tooltipHTML += `${description}`
            tooltip.innerHTML = tooltipHTML
            tooltip.style.display = 'block'
          }
          updateTooltipPosition(e, tooltip, mapContainer)
        })

        map.on('mouseleave', 'community-pins', () => {
          if (isMobile) return
          if (hoveredPinId !== null) {
            map.getCanvas().style.cursor = ''
            resetHover()
            hoveredPinId = null
            tooltip.style.display = 'none'
          }
        })

        // Click handler — single tap opens the link on both mobile and desktop
        map.on('click', 'community-pins', (e: any) => {
          if (!e.features || e.features.length === 0) return
          const feature = e.features[0]
          const link = feature.properties?.link || feature.properties?.url
          if (link && link !== '#') window.open(link, '_blank')
        })

        // Mobile global handlers
        if (isMobile) {
          const handleTooltipClick = function (e: MouseEvent) {
            if ((e.target as HTMLElement).closest('#mapbox-tooltip')) {
              const lnk = tooltip.getAttribute('data-link-url')
              if (lnk && lnk !== '#') {
                tooltip.style.display = 'none'
                if (tappedPinId !== null) {
                  resetHover()
                  tappedPinId = null
                }
                window.open(lnk, '_blank')
              }
              e.stopPropagation()
            }
          }

          const handleDocumentClick = function (e: MouseEvent) {
            const clickedOnMapCanvas = (e.target as HTMLElement).closest(
              '.mapboxgl-canvas'
            )
            const clickedOnTooltip = (e.target as HTMLElement).closest(
              '#mapbox-tooltip'
            )
            let clickedOnPin = false
            if (clickedOnMapCanvas && map.queryRenderedFeatures) {
              try {
                const features = map.queryRenderedFeatures(
                  [e.clientX, e.clientY],
                  { layers: ['community-pins'] }
                )
                clickedOnPin = features.length > 0
              } catch {
                /* Ignore - map may be in invalid state */
              }
            }
            if (!clickedOnTooltip && !clickedOnPin) {
              if (tooltip.style.display !== 'none') {
                tooltip.style.display = 'none'
                if (tappedPinId !== null) {
                  resetHover()
                  tappedPinId = null
                }
              }
            }
          }

          tooltip.addEventListener('click', handleTooltipClick)
          document.addEventListener('click', handleDocumentClick)

          // Store cleanup function for useEffect teardown
          cleanupRef.current = () => {
            tooltip.removeEventListener('click', handleTooltipClick)
            document.removeEventListener('click', handleDocumentClick)
            resizeObserver.disconnect()
          }
        }

        // Custom reset button
        const compassButton = mapContainer.querySelector(
          '.mapboxgl-ctrl-compass'
        ) as HTMLElement | null
        if (compassButton) {
          const iconElement = compassButton.querySelector(
            '.mapboxgl-ctrl-icon'
          ) as HTMLElement | null
          if (iconElement) iconElement.style.backgroundImage = 'none'
          const resetIconDataUri =
            "data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M8 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM2.5 8a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z' fill='white'/%3E%3Ccircle cx='8' cy='8' r='1.5' fill='white'/%3E%3C/svg%3E"
          compassButton.style.backgroundImage = `url("${resetIconDataUri}")`
          compassButton.style.backgroundSize = '18px 18px'
          compassButton.style.backgroundRepeat = 'no-repeat'
          compassButton.style.backgroundPosition = 'center'
          compassButton.addEventListener(
            'click',
            ev => {
              ev.preventDefault()
              ev.stopPropagation()
              map.flyTo({
                center: initialCenter,
                zoom: initialZoom,
                bearing: 0,
                pitch: 0,
                duration: 500,
                essential: true,
              })
            },
            true
          )
          compassButton.setAttribute('title', 'Reset map view')
        }
      })
    }

    customPin.onerror = function () {
      map.on('load', function () {
        if (!map.hasImage('custom-pin')) {
          const canvas = document.createElement('canvas')
          const size = 20
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')!
          ctx.beginPath()
          ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
          ctx.fillStyle = '#14b8a6'
          ctx.fill()
          ctx.lineWidth = 1
          ctx.strokeStyle = '#ffffff'
          ctx.stroke()
          map.addImage('custom-pin', canvas)
        }
      })
    }

    customPin.src = '/images/pin.svg'
  }

  useEffect(() => {
    // Check if mapboxgl is already available (script loaded on previous mount)
    if (window.mapboxgl) {
      initMap()
    }
    return () => {
      // Clean up event listeners
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
      // Clean up map instance
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleScriptLoad() {
    initMap()
  }

  function handleViewOnline() {
    if (mapContainerRef.current) {
      const mapRect = mapContainerRef.current.getBoundingClientRect()
      window.scrollTo({
        top: window.scrollY + mapRect.bottom,
        behavior: 'smooth',
      })
    }
  }

  return (
    <>
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css"
        rel="stylesheet"
      />
      <Script
        src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <div ref={mapContainerRef} className={styles.mapContainer}>
        <button
          onClick={handleViewOnline}
          className={`button-primary ${styles.mapButton}`}
        >
          <p>View online communities</p>
          <Image src="/images/arrow-down.svg" alt="" width={12} height={12} />
        </button>
      </div>
      <div
        ref={tooltipRef}
        id="mapbox-tooltip"
        className="paragraph-xs"
        style={{ display: 'none', position: 'fixed' }}
      />
    </>
  )
}
