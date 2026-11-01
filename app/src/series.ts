// Pure logic for story V1-05: hash routing and the series page's figure selection.
import type { Figure, Series } from './catalog'

export type Route = { page: 'home' } | { page: 'series'; id: string }

export type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; series: Series[] }

const SERIES_PREFIX = '#series/'

function decode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** Reads the route from location.hash. Any hash that is not a series link means home. */
export function parseRoute(hash: string): Route {
  if (!hash.startsWith(SERIES_PREFIX)) return { page: 'home' }
  return { page: 'series', id: decode(hash.slice(SERIES_PREFIX.length).replace(/\/+$/, '')) }
}

export function findSeries(series: readonly Series[], id: string): Series | null {
  return series.find((s) => s.id === id) ?? null
}

/** Returns the figures by figure number; the input is left untouched. */
export function figuresInOrder(s: Series): Figure[] {
  return [...s.figures].sort((a, b) => a.no - b.no)
}

export interface SpillFigure {
  figure: Figure
  x: number
  y: number
  rotate: number
  delay: number
}

// SOURCE: mockups/d/series.html spillPos. Hand-placed positions; `at` is the mockup's figure
// choice (1, 10, 14, 4, 19 of 20) as a share of the series, so any series size gets a spread.
const SPILL_SLOTS = [
  { at: 0, x: 20, y: 0, rotate: -16, delay: 200 },
  { at: 0.45, x: 120, y: 70, rotate: 12, delay: 320 },
  { at: 0.65, x: 30, y: 160, rotate: -8, delay: 440 },
  { at: 0.15, x: 140, y: 220, rotate: 18, delay: 560 },
  { at: 0.9, x: 50, y: 290, rotate: -20, delay: 680 },
]

/** Figures scattered beside the hero card. Only figures with an image, never one twice. */
export function spillFigures(s: Series): SpillFigure[] {
  const pool = figuresInOrder(s).filter((f) => f.img)
  const seen = new Set<number>()
  const picks: SpillFigure[] = []
  for (const { at, ...place } of SPILL_SLOTS) {
    const index = Math.floor(at * pool.length)
    if (index >= pool.length || seen.has(index)) continue
    seen.add(index)
    picks.push({ figure: pool[index], ...place })
  }
  return picks
}
