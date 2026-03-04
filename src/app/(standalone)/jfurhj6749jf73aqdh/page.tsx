'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './page.module.css'

// Dynamic import to avoid SSR issues with D3
const D3PosterMap = dynamic(() => import('./D3PosterMap'), {
  ssr: false,
  loading: () => (
    <div
      className={styles['map-container']}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p className="paragraph-small color-teal-300">Loading map...</p>
    </div>
  ),
})

interface MapOrg {
  id: string
  title: string
  shortName: string | null
  description: string
  category: string
  status: string
  logo: string | null
  mapLogo: string | null
  link: string
  shortUrl: string | null
  x: number | null
  y: number | null
  scale: string | null
  isMagic: boolean
}

export default function PosterMapPage() {
  const [orgs, setOrgs] = useState<MapOrg[]>([])
  const [loading, setLoading] = useState(true)
  const mapWrapperRef = useRef<HTMLDivElement>(null)

  const scrollToWarning = () => {
    if (!mapWrapperRef.current) return
    const mapRect = mapWrapperRef.current.getBoundingClientRect()
    const scrollAmount = window.scrollY + mapRect.bottom
    window.scrollTo({ top: scrollAmount, behavior: 'smooth' })
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/map')
        if (!res.ok) {
          throw new Error('Failed to fetch data')
        }
        const data = await res.json()
        setOrgs(data.records)
      } catch (err) {
        console.error('Failed to load map data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter orgs that have map coordinates for the D3 map
  const mapOrgs = orgs.filter(org => org.x !== null && org.y !== null)

  return (
    <>
      {/* D3 Poster Map - full viewport */}
      <div ref={mapWrapperRef} className={styles['map-wrapper']}>
        {!loading && <D3PosterMap orgs={mapOrgs} />}
        <button onClick={scrollToWarning} className={styles['scroll-button']}>
          View cards{' '}
          <span style={{ color: '#81878f' }}>
            <Image src="/images/arrow-down.svg" alt="" width={16} height={16} />
          </span>
        </button>
      </div>

      {/* Warning banner */}
      <div className="container-default">
        <h2
          className="width-7-col padding-bottom-56px"
          style={{ paddingTop: '40px' }}
        >
          <span style={{ color: '#FF8C00' }}>
            THIS IS NOT THE REAL MAP, IT&apos;S JUST USED FOR PRINTING POSTERS
          </span>
        </h2>
      </div>
    </>
  )
}
