'use client'

import { useEffect, useRef, useState } from 'react'

interface MockGPSPickerProps {
  lat: number
  lng: number
  onChange: (coords: { lat: number; lng: number; accuracy: number }) => void
  centerLat?: number
  centerLng?: number
  radiusMeters?: number
}

export default function MockGPSPicker({ 
  lat, 
  lng, 
  onChange,
  centerLat,
  centerLng,
  radiusMeters,
}: MockGPSPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const [accuracy, setAccuracy] = useState(10) // default 10m accuracy for check-in

  // Manual lat/lng input state (string so partial edits work)
  const [inputLat, setInputLat] = useState(lat.toFixed(6))
  const [inputLng, setInputLng] = useState(lng.toFixed(6))

  useEffect(() => {
    // Dynamic import leaflet and its CSS to prevent SSR crash
    let isMounted = true

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return

      // Load Leaflet dynamically
      const L = await import('leaflet')
      
      // Import CSS dynamically
      await import('leaflet/dist/leaflet.css')

      if (!isMounted) return

      // Check if map is already initialized
      if (mapRef.current) {
        mapRef.current.remove()
      }

      // Fix default Leaflet icon paths in Next.js
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })

      // Create map
      const map = L.map(mapContainerRef.current).setView([lat, lng], 17)
      mapRef.current = map

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      // Add draggable marker
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
      markerRef.current = marker

      // Add a visual guide circle (defaulting to college coordinates or custom center)
      const defaultLat = centerLat !== undefined ? centerLat : lat
      const defaultLng = centerLng !== undefined ? centerLng : lng
      const radius = radiusMeters !== undefined ? radiusMeters : 100

      const circle = L.circle([defaultLat, defaultLng], {
        radius,
        color: '#8b5cf6',
        fillColor: '#8b5cf6',
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(map)
      circleRef.current = circle

      // Update function
      const updateLocation = (newLat: number, newLng: number) => {
        setInputLat(newLat.toFixed(6))
        setInputLng(newLng.toFixed(6))
        onChange({ lat: newLat, lng: newLng, accuracy })
      }

      // Marker drag event
      marker.on('dragend', () => {
        const position = marker.getLatLng()
        updateLocation(position.lat, position.lng)
      })

      // Map click event
      map.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng
        marker.setLatLng([clickLat, clickLng])
        updateLocation(clickLat, clickLng)
      })
    }

    initMap()

    return () => {
      isMounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Dynamically update circle position and radius when props change
  useEffect(() => {
    if (circleRef.current) {
      const targetLat = centerLat !== undefined ? centerLat : lat
      const targetLng = centerLng !== undefined ? centerLng : lng
      const radius = radiusMeters !== undefined ? radiusMeters : 100
      circleRef.current.setLatLng([targetLat, targetLng])
      circleRef.current.setRadius(radius)
    }
  }, [lat, lng, centerLat, centerLng, radiusMeters])

  // Sync marker position if props are updated from parent
  useEffect(() => {
    if (markerRef.current) {
      const currentPos = markerRef.current.getLatLng()
      if (currentPos.lat !== lat || currentPos.lng !== lng) {
        markerRef.current.setLatLng([lat, lng])
      }
    }
    // Keep input boxes in sync if parent updates coords
    setInputLat(lat.toFixed(6))
    setInputLng(lng.toFixed(6))
  }, [lat, lng])

  // Handle accuracy slider changes
  const handleAccuracyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value)
    setAccuracy(val)
    onChange({ lat, lng, accuracy: val })
  }

  // ── Manual input handlers ─────────────────────────────────────────────────

  const applyManualCoords = (newLat: number, newLng: number) => {
    if (isNaN(newLat) || isNaN(newLng)) return
    if (newLat < -90 || newLat > 90 || newLng < -180 || newLng > 180) return
    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng])
    }
    if (mapRef.current) {
      mapRef.current.setView([newLat, newLng], mapRef.current.getZoom())
    }
    onChange({ lat: newLat, lng: newLng, accuracy })
  }

  const handleLatInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputLat(e.target.value)
  }

  const handleLatBlur = () => {
    const parsed = parseFloat(inputLat)
    applyManualCoords(parsed, lat)
    if (!isNaN(parsed)) setInputLat(parsed.toFixed(6))
  }

  const handleLngInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputLng(e.target.value)
  }

  const handleLngBlur = () => {
    const parsed = parseFloat(inputLng)
    applyManualCoords(lat, parsed)
    if (!isNaN(parsed)) setInputLng(parsed.toFixed(6))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: 'lat' | 'lng') => {
    if (e.key === 'Enter') {
      field === 'lat' ? handleLatBlur() : handleLngBlur()
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-white/90">📍 Simulate GPS Coordinates</h3>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Accuracy:</span>
          <input
            type="range"
            min="5"
            max="100"
            value={accuracy}
            onChange={handleAccuracyChange}
            className="h-1 w-24 cursor-pointer rounded-lg bg-gray-700 accent-purple-500"
          />
          <span className={`text-xs font-bold ${accuracy <= 50 ? 'text-green-400' : 'text-red-400'}`}>
            {accuracy}m {accuracy <= 50 ? '(Valid)' : '(Too Poor)'}
          </span>
        </div>
      </div>

      {/* Manual coordinate inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Latitude</label>
          <input
            type="text"
            value={inputLat}
            onChange={handleLatInput}
            onBlur={handleLatBlur}
            onKeyDown={(e) => handleKeyDown(e, 'lat')}
            placeholder="e.g. 22.572600"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:border-purple-500/60 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Longitude</label>
          <input
            type="text"
            value={inputLng}
            onChange={handleLngInput}
            onBlur={handleLngBlur}
            onKeyDown={(e) => handleKeyDown(e, 'lng')}
            placeholder="e.g. 88.363900"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:border-purple-500/60 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all"
          />
        </div>
        <p className="col-span-2 text-[10px] text-gray-600">
          Type coordinates manually or click/drag on the map below. Press Enter or click away to apply.
        </p>
      </div>
      
      <div 
        ref={mapContainerRef} 
        className="h-64 w-full rounded-lg overflow-hidden border border-white/5 shadow-inner" 
        style={{ minHeight: '260px' }}
      />
    </div>
  )
}
