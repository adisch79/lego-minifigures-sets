// Pure home page logic for story V1-04: sorting, search, tile art and URL state.
import { compareSeriesNo, type Series } from './catalog'

export const SORT_OPTIONS = [
  { value: 'new', label: 'Newest' },
  { value: 'old', label: 'Oldest' },
  { value: 'az', label: 'A-Z' },
  { value: 'number', label: 'Series number' },
  { value: 'count', label: 'Figure count' },
] as const

export type SortMode = (typeof SORT_OPTIONS)[number]['value']

export interface HomeState {
  sort: SortMode
  q: string
}

export const DEFAULT_SORT: SortMode = 'new'

// SOURCE: files in app/public/cards, rendered by scripts/build_cards.py: series whose tile uses a composed card.
const CARD_IDS = new Set([
  '71000',
  '71001',
  '71002',
  '71004',
  '71005',
  '71007',
  '71008',
  '71009',
  '71010',
  '71011',
  '71012',
  '71013',
  '71014',
  '71017',
  '71018',
  '71019',
  '71020',
  '71021',
  '71022',
  '71023',
  '71024',
  '71025',
  '71026',
  '71027',
  '71028',
  '71029',
  '71030',
  '71031',
  '71032',
  '71033',
  '71034',
  '71037',
  '71038',
  '71039',
  '71045',
  '71046',
  '71047',
  '71048',
  '71049',
  '71050',
  '71051',
  '71052',
  '71053',
  '8683',
  '8684',
  '8803',
  '8804',
  '8805',
  '8827',
  '8831',
  '8833',
  '8909',
])
const byName = (a: Series, b: Series) => a.name.localeCompare(b.name, 'en')
const byId = (a: Series, b: Series) => a.id.localeCompare(b.id, 'en', { numeric: true })

const COMPARATORS: Record<SortMode, (a: Series, b: Series) => number> = {
  new: (a, b) => b.year - a.year || byId(b, a),
  old: (a, b) => a.year - b.year || byId(a, b),
  az: byName,
  number: (a, b) => compareSeriesNo(a, b) || byName(a, b),
  count: (a, b) => b.figureCount - a.figureCount || b.year - a.year || byName(a, b),
}

/** Returns a sorted copy; the input array is left untouched. */
export function sortSeries(series: readonly Series[], mode: SortMode): Series[] {
  return [...series].sort(COMPARATORS[mode])
}

/** Case and accent insensitive form used for all search comparisons. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function tokens(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean)
}

function seriesText(s: Series): string {
  return fold(`${s.name} ${s.id} ${s.year}`)
}

/** Every word of the query must occur in the series name, id, year or a figure name. */
export function searchSeries(series: readonly Series[], query: string): Series[] {
  const words = tokens(query)
  if (words.length === 0) return [...series]
  return series.filter((s) => {
    const text = `${seriesText(s)} ${s.figures.map((f) => fold(f.name)).join(' ')}`
    return words.every((w) => text.includes(w))
  })
}

/** Names of figures that explain a match the series' own fields do not. */
export function matchedFigures(s: Series, query: string): string[] {
  const own = seriesText(s)
  const words = tokens(query).filter((w) => !own.includes(w))
  if (words.length === 0) return []
  return s.figures
    .filter((f) => {
      const name = fold(f.name)
      return words.some((w) => name.includes(w))
    })
    .map((f) => f.name)
}

export interface TileArt {
  src: string
  /** A card is composed to the tile's 3:4 shape; other images must be fitted, not cropped. */
  kind: 'card' | 'photo'
}

/** Card for the chosen series, first figure for bad bags, otherwise the bag. */
export function tileArt(s: Series): TileArt | null {
  if (CARD_IDS.has(s.id)) return { src: `cards/${s.id}.png`, kind: 'card' }
  const figure = s.figures[0]?.img ?? null
  const src = s.bag ?? figure
  return src ? { src, kind: 'photo' } : null
}

function isSortMode(v: string | null): v is SortMode {
  return SORT_OPTIONS.some((o) => o.value === v)
}

/** Reads state from a query string. Unknown sort values fall back to the default. */
export function readState(search: string): HomeState {
  const params = new URLSearchParams(search)
  const sort = params.get('sort')
  return {
    sort: isSortMode(sort) ? sort : DEFAULT_SORT,
    q: params.get('q') ?? '',
  }
}

/** Builds a query string ("" or "?..."), omitting defaults and keeping unrelated params. */
export function writeState(state: HomeState, search = ''): string {
  const params = new URLSearchParams(search)
  params.delete('sort')
  params.delete('q')
  if (state.sort !== DEFAULT_SORT) params.set('sort', state.sort)
  if (state.q.trim()) params.set('q', state.q)
  const out = params.toString()
  return out ? `?${out}` : ''
}
