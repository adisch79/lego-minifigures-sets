/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Series } from './catalog'

type Call = { op: string; args: unknown[] }
let calls: Call[] = []
let results: Record<string, { data?: unknown; error?: { code?: string } | null }> = {}

function builder(op: string, args: unknown[]) {
  calls.push({ op, args })
  const b: Record<string, unknown> = {}
  b.eq = (...a: unknown[]) => {
    calls.push({ op: 'eq', args: a })
    return b
  }
  b.then = (res: (v: unknown) => unknown) => Promise.resolve(results[op] ?? { data: [], error: null }).then(res)
  return b
}
vi.mock('./auth', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({
      select: (...a: unknown[]) => builder('select', a),
      upsert: (...a: unknown[]) => builder('upsert', a),
      update: (...a: unknown[]) => builder('update', a),
      delete: (...a: unknown[]) => builder('delete', a),
    }),
  },
}))

import { filterSeries, loadMarks, markKey, seriesProgress, setMark, useMarks, type MarkMap } from './marks'

beforeEach(() => {
  calls = []
  results = {}
})

const fig = (id: string) => ({ id, no: 1, name: 'x', img: null, imgFallback: false })
const ser = (id: string, n: number): Series => ({
  id,
  name: id,
  line: 'Series',
  seriesNo: 1,
  year: 2020,
  age: null,
  bricklinkCode: null,
  figureCount: n,
  bag: null,
  card: null,
  figures: Array.from({ length: n }, (_, i) => fig(`${id}-${i + 1}`)),
})

describe('setMark', () => {
  it('inserts ignoring duplicates, then updates state, with session user id', async () => {
    expect(await setMark('figure', '71000-1', 'owned')).toEqual({ ok: true })
    const ops = calls.filter((c) => c.op !== 'eq')
    expect(ops.map((c) => c.op)).toEqual(['upsert', 'update'])
    expect(ops[0].args).toEqual([
      { user_id: 'u1', kind: 'figure', target_id: '71000-1', state: 'owned' },
      { onConflict: 'user_id,kind,target_id', ignoreDuplicates: true },
    ])
    expect(ops[1].args).toEqual([{ state: 'owned' }])
    expect(JSON.stringify(calls)).not.toContain('updated_at')
  })
  it('deletes for null', async () => {
    expect(await setMark('series', '71000', null)).toEqual({ ok: true })
    expect(calls.map((c) => c.op)).toEqual(['delete', 'eq', 'eq'])
  })
  it('maps cap error 54000 to cap, others to network', async () => {
    results.upsert = { error: { code: '54000' } }
    expect(await setMark('figure', '71000-1', 'owned')).toEqual({ ok: false, reason: 'cap' })
    results.upsert = { error: { code: '500' } }
    expect(await setMark('figure', '71000-1', 'owned')).toEqual({ ok: false, reason: 'network' })
  })
})

describe('loadMarks', () => {
  it('builds a map', async () => {
    results.select = { data: [{ kind: 'figure', target_id: '71000-1', state: 'wanted' }], error: null }
    expect((await loadMarks())?.get('figure:71000-1')).toBe('wanted')
  })
})

describe('useMarks', () => {
  it('loads when signed in, clears on sign-out', async () => {
    results.select = { data: [{ kind: 'series', target_id: '71000', state: 'owned' }], error: null }
    const { result, rerender } = renderHook(({ s }) => useMarks(s), {
      initialProps: { s: 'signed-in' as 'signed-in' | 'signed-out' },
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.marks.size).toBe(1)
    rerender({ s: 'signed-out' })
    await waitFor(() => expect(result.current.status).toBe('off'))
    expect(result.current.marks.size).toBe(0)
  })
  it('updates optimistically, rolls back and flags failed, retry succeeds', async () => {
    const { result } = renderHook(() => useMarks('signed-in'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    results.upsert = { error: { code: '500' } }
    act(() => result.current.set('figure', '71000-1', 'owned'))
    expect(result.current.marks.get('figure:71000-1')).toBe('owned')
    expect(result.current.pending.has('figure:71000-1')).toBe(true)
    await waitFor(() => expect(result.current.failed.has('figure:71000-1')).toBe(true))
    expect(result.current.marks.has('figure:71000-1')).toBe(false)
    expect(result.current.pending.size).toBe(0)
    results.upsert = { error: null }
    act(() => result.current.retry('figure:71000-1'))
    await waitFor(() => expect(result.current.pending.size).toBe(0))
    expect(result.current.failed.size).toBe(0)
    expect(result.current.marks.get('figure:71000-1')).toBe('owned')
  })
})

describe('helpers', () => {
  const a = ser('70000', 3)
  const b = ser('71000', 2)
  const marks: MarkMap = new Map([
    ['figure:70000-1', 'owned'],
    ['figure:70000-2', 'wanted'],
    ['series:70000', 'owned'],
    ['figure:71000-1', 'owned'],
    ['figure:71000-2', 'owned'],
    ['series:71000', 'wanted'],
  ])
  it('progress counts figure marks only', () => {
    expect(seriesProgress(a, marks)).toEqual({ owned: 1, wanted: 1, total: 3 })
    expect(seriesProgress(b, marks)).toEqual({ owned: 2, wanted: 0, total: 2 })
  })
  it('filters', () => {
    expect(filterSeries([a, b], marks, 'all')).toHaveLength(2)
    expect(filterSeries([a, b], marks, 'wanted').map((s) => s.id)).toEqual(['70000', '71000'])
    expect(filterSeries([a, b], marks, 'missing').map((s) => s.id)).toEqual(['70000'])
    const onlyFig: MarkMap = new Map([[markKey('figure', '70000-3'), 'wanted']])
    expect(filterSeries([a, b], onlyFig, 'wanted').map((s) => s.id)).toEqual(['70000'])
  })
})

describe('catalog ids vs DB constraint', () => {
  it('every id matches the migration regex', () => {
    const sql = readFileSync('../supabase/migrations/20261102000000_v2_01_schema.sql', 'utf8')
    const figRe = new RegExp(/kind = 'figure' and target_id ~ '([^']+)'/.exec(sql)![1])
    const serRe = new RegExp(/kind = 'series' and target_id ~ '([^']+)'/.exec(sql)![1])
    expect(figRe.source).toBe('^[0-9]{4,6}-[0-9]{1,4}$')
    expect(serRe.source).toBe('^[0-9]{4,6}$')
    const cat = JSON.parse(readFileSync('public/catalog.json', 'utf8')) as { series: Series[] }
    let n = cat.series.length
    for (const s of cat.series) {
      expect(serRe.test(s.id)).toBe(true)
      for (const f of s.figures) {
        expect(figRe.test(f.id)).toBe(true)
        n++
      }
    }
    expect(n).toBeGreaterThan(800)
  })
})
