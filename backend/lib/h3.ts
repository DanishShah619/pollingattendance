// lib/h3.ts
import { latLngToCell, gridDisk, cellToBoundary } from 'h3-js'

const DEFAULT_RESOLUTION = parseInt(process.env.NEXT_PUBLIC_H3_RESOLUTION ?? '10')

/**
 * Compute the set of H3 cells covering a location + radius.
 * rings=0 → 1 cell (~15m), rings=1 → 7 cells (~45m), rings=2 → 19 cells (~75m)
 */
export function computeZone(lat: number, lng: number, rings = 1, res = DEFAULT_RESOLUTION): string[] {
  const center = latLngToCell(lat, lng, res)
  return gridDisk(center, rings)
}

/**
 * Check if a GPS coordinate is inside the allowed zone.
 */
export function isInsideZone(lat: number, lng: number, allowedCells: string[], res = DEFAULT_RESOLUTION): boolean {
  const cell = latLngToCell(lat, lng, res)
  return allowedCells.includes(cell)
}

/**
 * Get polygon boundary of each cell (for map display).
 */
export function getZoneBoundaries(cells: string[]) {
  return cells.map(cell => cellToBoundary(cell))
}