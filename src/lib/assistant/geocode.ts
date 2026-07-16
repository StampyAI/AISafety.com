// Lightweight geocoder for "near {city}" queries.
//
// Uses Nominatim (OpenStreetMap) — free, no API key, ~1 req/sec rate limit.
// Results are cached in-process so repeat queries cost nothing.
//
// Includes a small static seed for very common cities so dev / first-load
// doesn't depend on network availability.

interface Coord {
  lat: number
  lng: number
}

const STATIC_CITIES: Record<string, Coord> = {
  london: { lat: 51.5074, lng: -0.1278 },
  'new york': { lat: 40.7128, lng: -74.006 },
  nyc: { lat: 40.7128, lng: -74.006 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  sf: { lat: 37.7749, lng: -122.4194 },
  berkeley: { lat: 37.8716, lng: -122.273 },
  oakland: { lat: 37.8044, lng: -122.2712 },
  oxford: { lat: 51.7548, lng: -1.2544 },
  cambridge: { lat: 52.2053, lng: 0.1218 },
  'cambridge, ma': { lat: 42.3736, lng: -71.1097 },
  boston: { lat: 42.3601, lng: -71.0589 },
  'washington dc': { lat: 38.9072, lng: -77.0369 },
  'washington, dc': { lat: 38.9072, lng: -77.0369 },
  dc: { lat: 38.9072, lng: -77.0369 },
  berlin: { lat: 52.52, lng: 13.405 },
  paris: { lat: 48.8566, lng: 2.3522 },
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  copenhagen: { lat: 55.6761, lng: 12.5683 },
  stockholm: { lat: 59.3293, lng: 18.0686 },
  zurich: { lat: 47.3769, lng: 8.5417 },
  geneva: { lat: 46.2044, lng: 6.1432 },
  munich: { lat: 48.1351, lng: 11.582 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  prague: { lat: 50.0755, lng: 14.4378 },
  toronto: { lat: 43.6532, lng: -79.3832 },
  vancouver: { lat: 49.2827, lng: -123.1207 },
  montreal: { lat: 45.5017, lng: -73.5673 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  melbourne: { lat: -37.8136, lng: 144.9631 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  beijing: { lat: 39.9042, lng: 116.4074 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.7041, lng: 77.1025 },
  'tel aviv': { lat: 32.0853, lng: 34.7818 },
  dublin: { lat: 53.3498, lng: -6.2603 },
  edinburgh: { lat: 55.9533, lng: -3.1883 },
  manchester: { lat: 53.4808, lng: -2.2426 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  la: { lat: 34.0522, lng: -118.2437 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  seattle: { lat: 47.6062, lng: -122.3321 },
  austin: { lat: 30.2672, lng: -97.7431 },
}

const cache = new Map<string, Coord | null>()

export async function geocodeCity(input: string): Promise<Coord | null> {
  const key = input.trim().toLowerCase()
  if (!key) return null
  if (cache.has(key)) return cache.get(key)!
  if (STATIC_CITIES[key]) {
    cache.set(key, STATIC_CITIES[key])
    return STATIC_CITIES[key]
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`,
      {
        headers: {
          'User-Agent': 'AISafety.com Assistant (admin@aisafety.com)',
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    )
    if (!res.ok) {
      console.warn(
        `[assistant] Nominatim returned ${res.status} for "${input}"`
      )
      cache.set(key, null)
      return null
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!data[0]) {
      cache.set(key, null)
      return null
    }
    const coord: Coord = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    }
    cache.set(key, coord)
    return coord
  } catch (err) {
    console.warn(`[assistant] Nominatim lookup failed for "${input}"`, err)
    cache.set(key, null)
    return null
  }
}

const EARTH_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_KM * Math.asin(Math.sqrt(x))
}
