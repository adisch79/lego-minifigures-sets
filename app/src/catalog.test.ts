import { describe, expect, it } from 'vitest'
import raw from '../public/catalog.json?raw'
import { parseCatalog, seriesNoSortKey, compareSeriesNo } from './catalog'
import type { Series } from './catalog'

const real: unknown = JSON.parse(raw)

// Deep clone of a minimal valid catalog, so each test can break one thing.
function minimal() {
  return {
    version: 2,
    source: 'test',
    series: [
      {
        id: '71045',
        name: 'Series 25 Minifigures',
        line: 'Series',
        seriesNo: 25,
        year: 2024,
        age: '5+',
        bricklinkCode: 'col25',
        figureCount: 2,
        bag: 'img/71045/71045-0.webp',
        card: null,
        figures: [
          { id: '71045-1', no: 1, name: 'A', img: 'img/71045/71045-1.webp', imgFallback: false },
          { id: '71045-2', no: 2, name: 'B', img: null, imgFallback: true },
        ],
      },
    ],
  }
}

describe('parseCatalog', () => {
  it('accepts the real catalog.json', () => {
    const c = parseCatalog(real)
    expect(c.version).toBe(2)
    expect(c.series).toHaveLength(52)
    expect(c.series.reduce((n, s) => n + s.figures.length, 0)).toBe(787)
  })

  it('accepts a minimal valid catalog', () => {
    expect(parseCatalog(minimal()).series[0].id).toBe('71045')
  })

  it('rejects a non-object', () => {
    expect(() => parseCatalog(null)).toThrow()
    expect(() => parseCatalog('x')).toThrow()
  })

  it('rejects a wrong version', () => {
    const c = minimal()
    c.version = 1
    expect(() => parseCatalog(c)).toThrow(/version/)
  })

  it('rejects a missing field', () => {
    const c = minimal() as unknown as { series: Record<string, unknown>[] }
    delete c.series[0].line
    expect(() => parseCatalog(c)).toThrow(/line/)
  })

  it('rejects a bad series id', () => {
    const c = minimal()
    c.series[0].id = 'abc'
    expect(() => parseCatalog(c)).toThrow(/id/)
  })

  it('rejects a figureCount mismatch', () => {
    const c = minimal()
    c.series[0].figureCount = 3
    expect(() => parseCatalog(c)).toThrow(/figureCount/)
  })

  it('rejects a duplicate figure id', () => {
    const c = minimal()
    c.series[0].figures[1].id = '71045-1'
    expect(() => parseCatalog(c)).toThrow(/duplicate/)
  })

  it('rejects a duplicate series id', () => {
    const c = minimal()
    c.series.push(structuredClone(c.series[0]))
    expect(() => parseCatalog(c)).toThrow(/duplicate/)
  })

  it('rejects a figure id equal to a series id', () => {
    const c = minimal()
    c.series[0].figures[1].id = '71045'
    expect(() => parseCatalog(c)).toThrow()
  })

  it('rejects a wrong field type', () => {
    const c = minimal() as unknown as { series: Record<string, unknown>[] }
    c.series[0].year = '2024'
    expect(() => parseCatalog(c)).toThrow(/year/)
  })

  it('rejects a non-boolean imgFallback', () => {
    const c = minimal() as unknown as { series: { figures: Record<string, unknown>[] }[] }
    c.series[0].figures[0].imgFallback = 'no'
    expect(() => parseCatalog(c)).toThrow(/imgFallback/)
  })
})

function s(id: string, line: string, seriesNo: number | null, year: number): Series {
  return {
    id, name: `${line} ${seriesNo ?? ''}`, line, seriesNo, year, age: null,
    bricklinkCode: null, figureCount: 0, bag: null, card: null, figures: [],
  }
}

describe('seriesNoSortKey', () => {
  it('orders main line by number, then other lines A-Z, one-off first, then year', () => {
    const sample = [
      s('c', 'The Simpsons', 2, 2015),
      s('d', 'Team GB', null, 2012),
      s('e', 'Series', 10, 2013),
      s('f', 'The Simpsons', null, 2014),
      s('g', 'Series', 2, 2010),
      s('h', 'Marvel', 1, 2021),
      s('i', 'The Simpsons', 1, 2014),
      s('j', 'Marvel', 2, 2022),
    ]
    const sorted = [...sample].sort(compareSeriesNo).map((x) => x.id)
    expect(sorted).toEqual(['g', 'e', 'h', 'j', 'd', 'f', 'i', 'c'])
  })

  it('returns comparable tuples with main line first', () => {
    const [main] = seriesNoSortKey(s('a', 'Series', 1, 2010))
    const [other] = seriesNoSortKey(s('b', 'Aardvark', 1, 2010))
    expect(main).toBeLessThan(other as number)
  })

  it('sorts the real catalog with Series 1 first and Series 29 last of the main line', () => {
    const c = parseCatalog(real)
    const main = c.series.filter((x) => x.line === 'Series').sort(compareSeriesNo)
    expect(main[0].seriesNo).toBe(1)
    expect(main[main.length - 1].seriesNo).toBe(29)
    const all = [...c.series].sort(compareSeriesNo)
    expect(all.slice(0, main.length).every((x) => x.line === 'Series')).toBe(true)
  })
})
