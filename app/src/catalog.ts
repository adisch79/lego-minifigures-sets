// Catalog contract v2. Design: docs/design/V1-02-catalog-v2.md
// Built by scripts/build_catalog.py into public/catalog.json. Paths are relative to that file.

export interface Figure {
  /** Rebrickable set number "<seriesId>-<n>". Permanent key. */
  id: string
  /** n from the set number. Display order only, never a key. */
  no: number
  name: string
  img: string | null
  /** true when v1 had no real minifig photo (set render used instead). */
  imgFallback: boolean
}

export interface Series {
  /** Base set number. Permanent key. */
  id: string
  name: string
  line: string
  seriesNo: number | null
  year: number
  age: string | null
  bricklinkCode: string | null
  figureCount: number
  bag: string | null
  card: string | null
  figures: Figure[]
}

export interface Catalog {
  version: 2
  source: string
  series: Series[]
}

const SERIES_ID_RE = /^\d{4,6}$/

function fail(path: string, msg: string): never {
  throw new Error(`catalog: ${path}: ${msg}`)
}

function obj(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected object')
  return v as Record<string, unknown>
}

function str(o: Record<string, unknown>, k: string, path: string): string {
  const v = o[k]
  if (typeof v !== 'string') fail(`${path}.${k}`, 'expected string')
  return v
}

function nullableStr(o: Record<string, unknown>, k: string, path: string): string | null {
  const v = o[k]
  if (v !== null && typeof v !== 'string') fail(`${path}.${k}`, 'expected string or null')
  return v
}

function int(o: Record<string, unknown>, k: string, path: string): number {
  const v = o[k]
  if (typeof v !== 'number' || !Number.isInteger(v)) fail(`${path}.${k}`, 'expected integer')
  return v
}

function parseFigure(v: unknown, seriesId: string, path: string): Figure {
  const o = obj(v, path)
  const id = str(o, 'id', path)
  if (!id.startsWith(`${seriesId}-`) || !/^\d{4,6}-\d+$/.test(id)) {
    fail(`${path}.id`, `bad figure id ${id}`)
  }
  const imgFallback = o.imgFallback
  if (typeof imgFallback !== 'boolean') fail(`${path}.imgFallback`, 'expected boolean')
  const no = int(o, 'no', path)
  if (no < 1 || String(no) !== id.split('-').pop()) {
    fail(`${path}.no`, `no ${no} does not match id ${id}`)
  }
  return {
    id,
    no,
    name: str(o, 'name', path),
    img: nullableStr(o, 'img', path),
    imgFallback,
  }
}

function parseSeries(v: unknown, path: string): Series {
  const o = obj(v, path)
  const id = str(o, 'id', path)
  if (!SERIES_ID_RE.test(id)) fail(`${path}.id`, `bad series id ${id}`)
  const seriesNo = o.seriesNo
  if (seriesNo !== null && (typeof seriesNo !== 'number' || !Number.isInteger(seriesNo))) {
    fail(`${path}.seriesNo`, 'expected integer or null')
  }
  const rawFigures = o.figures
  if (!Array.isArray(rawFigures)) fail(`${path}.figures`, 'expected array')
  const figures = rawFigures.map((f, i) => parseFigure(f, id, `${path}.figures[${i}]`))
  const nos = new Set<number>()
  for (const f of figures) {
    if (nos.has(f.no)) fail(`${path}.figures`, `duplicate no ${f.no}`)
    nos.add(f.no)
  }
  const figureCount = int(o, 'figureCount', path)
  if (figureCount !== figures.length) {
    fail(`${path}.figureCount`, `${figureCount} != figures.length ${figures.length}`)
  }
  return {
    id,
    name: str(o, 'name', path),
    line: str(o, 'line', path),
    seriesNo: seriesNo as number | null,
    year: int(o, 'year', path),
    age: nullableStr(o, 'age', path),
    bricklinkCode: nullableStr(o, 'bricklinkCode', path),
    figureCount,
    bag: nullableStr(o, 'bag', path),
    card: nullableStr(o, 'card', path),
    figures,
  }
}

/** Runtime guard: validates parsed JSON against contract v2 and throws on the first violation. */
export function parseCatalog(json: unknown): Catalog {
  const o = obj(json, 'catalog')
  if (o.version !== 2) fail('catalog.version', `expected 2, got ${String(o.version)}`)
  const rawSeries = o.series
  if (!Array.isArray(rawSeries)) fail('catalog.series', 'expected array')
  const series = rawSeries.map((s, i) => parseSeries(s, `series[${i}]`))

  const seriesIds = new Set<string>()
  for (const s of series) {
    if (seriesIds.has(s.id)) fail('series', `duplicate series id ${s.id}`)
    seriesIds.add(s.id)
  }
  const figIds = new Set<string>()
  for (const s of series) {
    for (const f of s.figures) {
      if (figIds.has(f.id)) fail('series', `duplicate figure id ${f.id}`)
      if (seriesIds.has(f.id)) fail('series', `figure id ${f.id} equals a series id`)
      figIds.add(f.id)
    }
  }
  return { version: 2, source: str(o, 'source', 'catalog'), series }
}

export type SeriesNoKey = [number, string, number, number]

/**
 * "Series number" sort key: main line (line == "Series") first by seriesNo; then other lines
 * A-Z by line, then seriesNo (null first, as the one-off), then year.
 * Tuple: [group, line, seriesNo, year], compare element by element.
 */
export function seriesNoSortKey(s: Series): SeriesNoKey {
  if (s.line === 'Series') return [0, '', s.seriesNo ?? 0, s.year]
  return [1, s.line, s.seriesNo ?? -1, s.year]
}

/** Comparator built on seriesNoSortKey. */
export function compareSeriesNo(a: Series, b: Series): number {
  const ka = seriesNoSortKey(a)
  const kb = seriesNoSortKey(b)
  if (ka[0] !== kb[0]) return ka[0] - kb[0]
  if (ka[1] !== kb[1]) return ka[1].localeCompare(kb[1], 'en')
  if (ka[2] !== kb[2]) return ka[2] - kb[2]
  return ka[3] - kb[3]
}
