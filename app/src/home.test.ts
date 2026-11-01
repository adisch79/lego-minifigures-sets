import { describe, expect, it } from 'vitest'
import type { Series } from './catalog'
import {
  matchedFigures,
  readState,
  searchSeries,
  sortSeries,
  tileArt,
  writeState,
} from './home'

function make(over: Partial<Series> & { id: string }, figureNames: string[] = ['Kai Kendo']): Series {
  return {
    name: `Name ${over.id}`,
    line: 'Series',
    seriesNo: null,
    year: 2020,
    age: null,
    bricklinkCode: null,
    bag: `img/${over.id}/bag.webp`,
    card: null,
    ...over,
    figureCount: figureNames.length,
    figures: figureNames.map((name, i) => ({
      id: `${over.id}-${i + 1}`,
      no: i + 1,
      name,
      img: `img/${over.id}/${i + 1}.webp`,
      imgFallback: false,
    })),
  }
}

const a = make({ id: '1001', name: 'Zebra', year: 2010, seriesNo: 2 }, ['One', 'Two', 'Three'])
const b = make({ id: '1002', name: 'Apple', year: 2024, line: 'Disney' }, ['Mickey Mouse'])
const c = make({ id: '1003', name: 'Mango', year: 2015, seriesNo: 1 }, ['Pirate', 'Pokémon'])
const all = [a, b, c]
const ids = (list: Series[]) => list.map((s) => s.id)

describe('sortSeries', () => {
  it('breaks year ties by set number', () => {
    const same = [{ id: '71051', year: 2026 }, { id: '71053', year: 2026 }] as Series[]
    expect(sortSeries(same, 'new').map((s) => s.id)).toEqual(['71053', '71051'])
    expect(sortSeries(same, 'old').map((s) => s.id)).toEqual(['71051', '71053'])
  })

  it('sorts newest first', () => {
    expect(ids(sortSeries(all, 'new'))).toEqual(['1002', '1003', '1001'])
  })
  it('sorts oldest first', () => {
    expect(ids(sortSeries(all, 'old'))).toEqual(['1001', '1003', '1002'])
  })
  it('sorts a-z', () => {
    expect(ids(sortSeries(all, 'az'))).toEqual(['1002', '1003', '1001'])
  })
  it('sorts by series number with the main line first', () => {
    expect(ids(sortSeries(all, 'number'))).toEqual(['1003', '1001', '1002'])
  })
  it('sorts by figure count, largest first', () => {
    expect(ids(sortSeries(all, 'count'))).toEqual(['1001', '1003', '1002'])
  })
  it('breaks a year tie by name', () => {
    const x = make({ id: '2001', name: 'B', year: 2000 })
    const y = make({ id: '2002', name: 'A', year: 2000 })
    expect(ids(sortSeries([x, y], 'new'))).toEqual(['2002', '2001'])
  })
  it('does not mutate its input', () => {
    const input = [a, b, c]
    sortSeries(input, 'az')
    expect(input).toEqual([a, b, c])
  })
})

describe('searchSeries', () => {
  it('returns everything for a blank query', () => {
    expect(searchSeries(all, '   ')).toHaveLength(3)
  })
  it('matches series name, ignoring case', () => {
    expect(ids(searchSeries(all, 'ZEBRA'))).toEqual(['1001'])
  })
  it('matches id', () => {
    expect(ids(searchSeries(all, '1002'))).toEqual(['1002'])
  })
  it('matches year', () => {
    expect(ids(searchSeries(all, '2015'))).toEqual(['1003'])
  })
  it('matches figure name', () => {
    expect(ids(searchSeries(all, 'mickey'))).toEqual(['1002'])
  })
  it('ignores accents', () => {
    expect(ids(searchSeries(all, 'pokemon'))).toEqual(['1003'])
  })
  it('requires every word, across fields', () => {
    expect(ids(searchSeries(all, 'mango pirate'))).toEqual(['1003'])
    expect(searchSeries(all, 'mango mickey')).toEqual([])
  })
  it('returns nothing when no series matches', () => {
    expect(searchSeries(all, 'nothing-here')).toEqual([])
  })
})

describe('matchedFigures', () => {
  it('names the figures behind a figure match', () => {
    expect(matchedFigures(b, 'mickey')).toEqual(['Mickey Mouse'])
  })
  it('stays empty when the series itself matches', () => {
    expect(matchedFigures(b, 'apple')).toEqual([])
    expect(matchedFigures(b, '')).toEqual([])
  })
})

describe('tileArt', () => {
  it('uses the card for chosen series', () => {
    expect(tileArt(make({ id: '71019' }))).toEqual({ src: 'cards/71019.png', kind: 'card' })
    expect(tileArt(make({ id: '8683' }))).toEqual({ src: 'cards/8683.png', kind: 'card' })
  })
  it('uses the bag for a series without a card', () => {
    expect(tileArt(make({ id: '99999' }))?.src).toBe('img/99999/bag.webp')
  })
  it('falls back to the first figure, then null, when art is missing', () => {
    const noBag = make({ id: '99999', bag: null })
    expect(tileArt(noBag)?.src).toBe('img/99999/1.webp')
    expect(tileArt({ ...noBag, figures: [] })).toBeNull()
  })
  it('has a card file for every series in the catalog', () => {
    const cards = Object.keys(import.meta.glob('../public/cards/*.png'))
    const [catalog] = Object.values(
      import.meta.glob<{ series: { id: string }[] }>('../public/catalog.json', { eager: true, import: 'default' }),
    )
    expect(catalog.series).toHaveLength(52)
    for (const { id } of catalog.series) {
      expect(tileArt(make({ id }))?.kind, id).toBe('card')
      expect(cards, id).toContain(`../public/cards/${id}.png`)
    }
  })
})

describe('readState and writeState', () => {
  it('reads defaults from an empty query', () => {
    expect(readState('')).toEqual({ sort: 'new', q: '' })
  })
  it('reads sort and q', () => {
    expect(readState('?sort=count&q=kai%20kendo')).toEqual({ sort: 'count', q: 'kai kendo' })
  })
  it('falls back on an unknown sort', () => {
    expect(readState('?sort=bogus').sort).toBe('new')
  })
  it('omits defaults', () => {
    expect(writeState({ sort: 'new', q: '' })).toBe('')
    expect(writeState({ sort: 'new', q: '   ' })).toBe('')
  })
  it('round trips', () => {
    const state = { sort: 'az', q: 'kai & co' } as const
    expect(readState(writeState(state))).toEqual(state)
  })
  it('keeps unrelated params and replaces old values', () => {
    expect(writeState({ sort: 'old', q: '' }, '?x=1&sort=az&q=gone')).toBe('?x=1&sort=old')
  })
})
