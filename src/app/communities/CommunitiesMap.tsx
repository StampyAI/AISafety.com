'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import Image from 'next/image'
import styles from './page.module.css'
import { Community } from '@/lib/data/communities'
import { positionTooltip } from '@/lib/mapTooltip'
import { trackListingClick } from '@/lib/analytics'

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
  // Keeps preloaded logo images alive after their bytes + decoded bitmaps are
  // ready. Without these refs the browser may garbage-collect the decoded
  // bitmap and the first tooltip hover still pays the decode cost.
  const preloadedLogosRef = useRef<HTMLImageElement[]>([])
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [pinsLoaded, setPinsLoaded] = useState(false)

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
          link: c.joinLink,
          logo: c.logo || '',
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

    // Read live so behavior adapts when the viewport is resized (e.g.
    // dev tools mobile mode toggled after load).
    const isMobile = () => window.innerWidth < 768

    // Touchend-blur fires only on touch devices anyway, so it's safe to
    // always register — no need to gate on viewport width.
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

    map.addControl(new mapboxgl.NavigationControl())

    // Mapbox doesn't auto-resize when its container changes size (e.g. via
    // CSS media queries). Watch the container and tell Mapbox to recalculate.
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(mapContainer)

    // Repurpose Mapbox's compass button as a "reset map view" button.
    // addControl synchronously inserts the compass into the DOM, so this
    // runs reliably without depending on the map 'load' event or pin image
    // load — both of which previously caused the icon and click handler to
    // intermittently fail to apply, making the button look missing.
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

    // Start loading the pin image immediately, in parallel with the map
    // style. Wrapping it in a promise lets us await it alongside the map's
    // `style.load` event without nesting callbacks (the nested version
    // caused a race where the image resolved after the map event fired and
    // the listener attached too late — leaving the map pin-less on an
    // uncached first visit).
    const pinImagePromise = new Promise<HTMLImageElement | HTMLCanvasElement>(
      resolve => {
        // No `crossOrigin` set — /images/pin.svg is same-origin, and
        // setting it would cause the browser to issue a second fetch that
        // doesn't match the `<link rel="preload">` hint.
        const customPin = new window.Image()
        customPin.onload = () => resolve(customPin)
        customPin.onerror = () => {
          // Fallback: generate a simple canvas pin if the SVG fails to load.
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
          resolve(canvas)
        }
        customPin.src = '/images/pin.svg'
      }
    )

    // Use `style.load` instead of `load`. Mapbox's `load` event waits for
    // the first complete tile render before firing, which introduces a
    // visible gap where the basemap is painted but the pins aren't added
    // yet. `style.load` fires as soon as the style JSON is parsed — well
    // before any tiles come back — so we can register the source and
    // layer early enough that pins render in the *same frame* as the
    // first tiles, not a second or two after.
    const styleLoadPromise = new Promise<void>(resolve => {
      if (map.isStyleLoaded()) {
        resolve()
      } else {
        map.once('style.load', () => resolve())
      }
    })

    Promise.all([pinImagePromise, styleLoadPromise]).then(([pinImage]) => {
      if (!map.hasImage('custom-pin')) {
        map.addImage('custom-pin', pinImage)
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
            link: community.link,
            location: community.location,
            logo: community.logo,
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

      // `idle` fires after tiles + pins have actually painted — much more
      // accurate than hiding the loader when the layer is merely registered.
      map.once('idle', () => {
        setPinsLoaded(true)
        // Warm the browser cache for every tooltip logo so the first hover
        // doesn't show an empty image slot. Runs during idle time so it
        // doesn't compete with the initial page render. We also call
        // `.decode()` on each image and hold the reference — that forces
        // the browser to decode the bitmap during preload (instead of on
        // first hover) and prevents GC from evicting it.
        const preloadLogos = () => {
          mapCommunities.forEach(c => {
            if (!c.logo) return
            const img = new window.Image()
            img.decoding = 'async'
            img.src = c.logo
            img.decode().catch(() => {})
            preloadedLogosRef.current.push(img)
          })
        }
        if ('requestIdleCallback' in window) {
          ;(window as any).requestIdleCallback(preloadLogos, { timeout: 2000 })
        } else {
          setTimeout(preloadLogos, 200)
        }
      })

      function escapeAttr(value: string) {
        return value
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      }

      function buildTooltipHTML(props: any) {
        const name = props?.name ?? ''
        const description = props?.description ?? ''
        const location = props?.location
        const logo = props?.logo
        const headerImage = logo
          ? `<div class="tooltip-img"><img src="${escapeAttr(logo)}" alt="${escapeAttr(name)} logo" class="tooltip-image" fetchpriority="high" decoding="sync" onerror="this.style.display='none'" /></div>`
          : ''
        const locationLine = location
          ? `<span class="location-text"><svg class="location-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 1a3.5 3.5 0 0 0-3.5 3.5c0 2.5 3.5 6.5 3.5 6.5s3.5-4 3.5-6.5A3.5 3.5 0 0 0 6 1Zm0 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" fill="currentColor"/></svg>${location}</span>`
          : ''
        return `<div class="tooltip-header">${headerImage}<div class="tooltip-title-block"><strong class="paragraph-small-bold">${name}</strong>${locationLine}</div></div>${description}`
      }

      function updateTooltipPosition(
        e: any,
        tt: HTMLDivElement,
        container: HTMLDivElement
      ) {
        positionTooltip(
          e.originalEvent.clientX,
          e.originalEvent.clientY,
          tt,
          container,
          isMobile() ? { minLeftMargin: 20 } : {}
        )
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
        if (isMobile() || !e.features || e.features.length === 0) {
          if (!isMobile() && hoveredPinId !== null) {
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
          tooltip.innerHTML = buildTooltipHTML(feature.properties)
          tooltip.style.display = 'block'
        }
        updateTooltipPosition(e, tooltip, mapContainer)
      })

      map.on('mouseleave', 'community-pins', () => {
        if (isMobile()) return
        if (hoveredPinId !== null) {
          map.getCanvas().style.cursor = ''
          resetHover()
          hoveredPinId = null
          tooltip.style.display = 'none'
        }
      })

      // Open the URL in a new tab via a synthetic anchor click. Some
      // browser/extension popup blockers stop `window.open(url, '_blank')`
      // from a Mapbox click handler because they treat it as a popup
      // rather than a link click. Programmatically clicking a real <a>
      // bypasses that — it's what `target="_blank"` links already do.
      function openInNewTab(url: string) {
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }

      // Click handler — desktop opens the listing directly. Mobile shows
      // the tooltip first so users can preview the info; tapping the
      // tooltip then opens the listing (handled below).
      map.on('click', 'community-pins', (e: any) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]

        if (!isMobile()) {
          const link = feature.properties?.link
          if (link && link !== '#') {
            trackListingClick(
              'Communities',
              feature.properties?.name,
              link,
              undefined,
              undefined,
              'map'
            )
            openInNewTab(link)
          }
          return
        }

        const currentFeatureId = feature.id as number
        if (tappedPinId !== currentFeatureId) {
          geojsonData.features.forEach((f: any) => {
            f.properties.hover = f.id === currentFeatureId
          })
          setData(geojsonData)
          tappedPinId = currentFeatureId

          tooltip.innerHTML = buildTooltipHTML(feature.properties)

          const link = feature.properties?.link
          tooltip.setAttribute('data-link-url', link || '')
          tooltip.setAttribute(
            'data-link-title',
            feature.properties?.name || ''
          )
          tooltip.style.display = 'block'
        }
        updateTooltipPosition(e, tooltip, mapContainer)
      })

      // Tooltip tap → open listing. Registered unconditionally so it
      // still works if the viewport is resized to mobile after load.
      const handleTooltipClick = function (e: MouseEvent) {
        if ((e.target as HTMLElement).closest('#mapbox-tooltip')) {
          const lnk = tooltip.getAttribute('data-link-url')
          if (lnk && lnk !== '#') {
            tooltip.style.display = 'none'
            if (tappedPinId !== null) {
              resetHover()
              tappedPinId = null
            }
            const title = tooltip.getAttribute('data-link-title')
            if (title)
              trackListingClick(
                'Communities',
                title,
                lnk,
                undefined,
                undefined,
                'map'
              )
            openInNewTab(lnk)
          }
          e.stopPropagation()
        }
      }

      // Tap outside any pin/tooltip → dismiss tooltip.
      const handleDocumentClick = function (e: MouseEvent) {
        const clickedOnMapCanvas = (e.target as HTMLElement).closest(
          '.mapboxgl-canvas'
        ) as HTMLCanvasElement | null
        const clickedOnTooltip = (e.target as HTMLElement).closest(
          '#mapbox-tooltip'
        )
        let clickedOnPin = false
        if (clickedOnMapCanvas && map.queryRenderedFeatures) {
          try {
            // queryRenderedFeatures expects canvas-relative coordinates,
            // not viewport coordinates. Without this offset the lookup
            // misses the pin when the map sits below any header.
            const canvasRect = clickedOnMapCanvas.getBoundingClientRect()
            const features = map.queryRenderedFeatures(
              [e.clientX - canvasRect.left, e.clientY - canvasRect.top],
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
    })
  }

  useEffect(() => {
    // If the script was already loaded (e.g. cached from a previous visit),
    // mark it as ready so the init effect below fires.
    if (window.mapboxgl) {
      setScriptLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!scriptLoaded) return
    initMap()
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
  }, [scriptLoaded])

  function handleScriptLoad() {
    setScriptLoaded(true)
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
      {/*
       * Preconnect + preload hints so the browser starts fetching the Mapbox
       * script, stylesheet, and pin image as soon as the HTML arrives —
       * instead of waiting for React hydration + `Script strategy=afterInteractive`.
       * Together these shave ~500–1000ms off the time-to-pins on first load.
       */}
      <link rel="preconnect" href="https://api.mapbox.com" />
      <link rel="dns-prefetch" href="https://events.mapbox.com" />
      <link
        rel="preload"
        as="script"
        href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="style"
        href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css"
      />
      <link
        rel="preload"
        as="image"
        href="/images/pin.svg"
        type="image/svg+xml"
      />
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
        {!pinsLoaded && (
          <div className={styles.mapLoading} aria-live="polite">
            <div className={styles.mapSpinner} aria-hidden="true" />
            <p className="paragraph-small">Loading map…</p>
          </div>
        )}
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
