import { describe, expect, it } from 'vitest'
import type { Figure, Series } from './catalog'
import { figuresInOrder, findSeries, parseRoute, spillFigures } from './series'

function figure(no: number, img: string | null = `img/x/${no}.webp`): Figure {
  return { id: `71019-${no}`, no, name: `Figure ${no}`, img, imgFallback: false }
}

function series(figures: Figure[]): Series {
  return {
    id: '71019',
    name: 'Ninjago',
    line: 'Ninjago',
    seriesNo: null,
    year: 2017,
    age: null,
    bricklinkCode: null,
    figureCount: figures.length,
    bag: null,
    card: null,
    figures,
  }
}

const range = (n: number) => Array.from({ length: n }, (_, i) => figure(i + 1))

describe('parseRoute', () => {
  it('treats an empty hash as home', () => {
    expect(parseRoute('')).toEqual({ page: 'home' })
    expect(parseRoute('#')).toEqual({ page: 'home' })
  })

  it('reads a series id', () => {
    expect(parseRoute('#series/71019')).toEqual({ page: 'series', id: '71019' })
    expect(parseRoute('#series/71019/')).toEqual({ page: 'series', id: '71019' })
  })

  it('decodes the id and survives a malformed escape', () => {
    expect(parseRoute('#series/a%20b')).toEqual({ page: 'series', id: 'a b' })
    expect(parseRoute('#series/%E0%A4%A')).toEqual({ page: 'series', id: '%E0%A4%A' })
  })

  it('keeps an unknown or empty id as a series route, so it reaches the not-found state', () => {
    expect(parseRoute('#series/nope')).toEqual({ page: 'series', id: 'nope' })
    expect(parseRoute('#series/')).toEqual({ page: 'series', id: '' })
  })

  it('sends any other hash home', () => {
    expect(parseRoute('#about')).toEqual({ page: 'home' })
    expect(parseRoute('#seriesfoo/71019')).toEqual({ page: 'home' })
  })
})

describe('findSeries', () => {
  const all = [series(range(1))]
  it('finds by exact id only', () => {
    expect(findSeries(all, '71019')?.id).toBe('71019')
    expect(findSeries(all, '7101')).toBeNull()
    expect(findSeries(all, '')).toBeNull()
  })
})

describe('figuresInOrder', () => {
  it('orders by figure number without touching the input', () => {
    const input = series([figure(3), figure(1), figure(2)])
    expect(figuresInOrder(input).map((f) => f.no)).toEqual([1, 2, 3])
    expect(input.figures.map((f) => f.no)).toEqual([3, 1, 2])
  })
})

describe('spillFigures', () => {
  it('picks the mockup figures for a 20 figure series', () => {
    expect(spillFigures(series(range(20))).map((s) => s.figure.no)).toEqual([1, 10, 14, 4, 19])
  })

  it('never repeats a figure and handles small series', () => {
    const nos = spillFigures(series(range(3))).map((s) => s.figure.no)
    expect(new Set(nos).size).toBe(nos.length)
    expect(nos.length).toBe(3)
  })

  it('skips figures without an image', () => {
    const picks = spillFigures(series([figure(1, null), figure(2), figure(3, null)]))
    expect(picks.map((s) => s.figure.no)).toEqual([2])
    expect(spillFigures(series([]))).toEqual([])
  })
})
