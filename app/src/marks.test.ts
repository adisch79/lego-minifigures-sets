/// <reference types="node" />
import { readFileSync } from 'node:fs'
// Paths resolve from this file (vitest injects __dirname), so the test runs from any cwd.
import { resolve } from 'node:path'
import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Series } from './catalog'

type Call = { op: string; args: unknown[] }
type Res = { data?: unknown; error?: { code?: string } | null }
let calls: Call[] = []
let results: Record<string, Res> = {}
// Optional gate per call: when set, the call waits for it (deferred mock for race tests).
let gate: ((op: string, args: unknown[]) => Promise<Res | undefined>) | null = null

function builder(op: string, args: unknown[]) {
  calls.push({ op, args })
  const b: Record<string, unknown> = {}
  b.eq = (...a: unknown[]) => {
    calls.push({ op: 'eq', args: a })
    return b
  }
  b.select = () => {
    calls.push({ op: 'chain-select', args: [] })
    return b
  }
  const dflt: Res = op === 'update' ? { data: [{}], error: null } : { data: [], error: null }
  b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    (gate ? gate(op, args) : Promise.resolve(undefined)).then((g) => g ?? results[op] ?? dflt).then(res, rej)
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
  gate = null
})

const noise = (c: Call) => c.op === 'eq' || c.op === 'chain-select'

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
    const ops = calls.filter((c) => !noise(c))
    expect(ops.map((c) => c.op)).toEqual(['upsert', 'update'])
    expect(ops[0].args).toEqual([
      { user_id: 'u1', kind: 'figure', target_id: '71000-1', state: 'owned' },
      { onConflict: 'user_id,kind,target_id', ignoreDuplicates: true },
    ])
    expect(ops[1].args).toEqual([{ state: 'owned' }])
    expect(JSON.stringify(calls)).not.toContain('updated_at')
  })
  it('deletes for null, scoped by user_id', async () => {
    expect(await setMark('series', '71000', null)).toEqual({ ok: true })
    expect(calls.map((c) => c.op)).toEqual(['delete', 'eq', 'eq', 'eq'])
    expect(calls.filter((c) => c.op === 'eq').map((c) => c.args)).toContainEqual(['user_id', 'u1'])
  })
  it('maps cap error 54000 to cap, others to network', async () => {
    results.upsert = { error: { code: '54000' } }
    expect(await setMark('figure', '71000-1', 'owned')).toEqual({ ok: false, reason: 'cap' })
    results.upsert = { error: { code: '500' } }
    expect(await setMark('figure', '71000-1', 'owned')).toEqual({ ok: false, reason: 'network' })
  })
  it('scopes update by user_id and fails on 0 rows', async () => {
    results.update = { data: [], error: null }
    expect(await setMark('figure', '71000-1', 'owned', 'wanted')).toEqual({ ok: false, reason: 'network' })
    expect(calls.filter((c) => c.op === 'eq').map((c) => c.args)).toContainEqual(['user_id', 'u1'])
    expect(calls.some((c) => c.op === 'chain-select')).toBe(true)
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
  })
  it('deletes the fresh row when update fails after an insert', async () => {
    results.update = { error: { code: '500' } }
    expect(await setMark('figure', '71000-1', 'owned', null)).toEqual({ ok: false, reason: 'network' })
    expect(calls.filter((c) => !noise(c)).map((c) => c.op)).toEqual(['upsert', 'update', 'delete'])
  })
  it('rejects invalid input without a network call', async () => {
    expect(await setMark('figure', '71000', 'owned')).toEqual({ ok: false, reason: 'invalid' })
    expect(await setMark('series', '71000-1', 'owned')).toEqual({ ok: false, reason: 'invalid' })
    expect(await setMark('series', '71000', 'bogus' as never)).toEqual({ ok: false, reason: 'invalid' })
    expect(await setMark('thing' as never, '71000', 'owned')).toEqual({ ok: false, reason: 'invalid' })
    expect(calls).toEqual([])
  })
})

describe('loadMarks', () => {
  it('builds a map', async () => {
    results.select = { data: [{ kind: 'figure', target_id: '71000-1', state: 'wanted' }], error: null }
    expect((await loadMarks())?.get('figure:71000-1')).toBe('wanted')
  })
  it('skips rows with unexpected kind or state', async () => {
    results.select = {
      data: [
        { kind: 'figure', target_id: '71000-1', state: 'wanted' },
        { kind: 'bogus', target_id: '71000-2', state: 'owned' },
        { kind: 'figure', target_id: '71000-3', state: 'bogus' },
      ],
      error: null,
    }
    expect([...(await loadMarks())!.keys()]).toEqual(['figure:71000-1'])
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

describe('useMarks races', () => {
  type Def = { op: string; resolve: (r?: Res) => void }
  let defs: Def[] = []
  beforeEach(() => {
    defs = []
  })
  const flush = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
  const writeOps = () => calls.filter((c) => ['upsert', 'update', 'delete'].includes(c.op)).map((c) => c.op)
  function deferWrites() {
    gate = (op) =>
      op === 'select' ? Promise.resolve(undefined) : new Promise((resolve) => defs.push({ op, resolve }))
  }
  async function ready(select?: Res) {
    if (select) results.select = select
    const h = renderHook(() => useMarks('signed-in'))
    await waitFor(() => expect(h.result.current.status).toBe('ready'))
    return h
  }
  // Resolves the oldest deferred call of this op.
  async function settle(op: string, res?: Res) {
    await waitFor(() => expect(defs.some((d) => d.op === op)).toBe(true))
    const [d] = defs.splice(
      defs.findIndex((x) => x.op === op),
      1,
    )
    d.resolve(res)
    await flush()
  }

  it('owned then wanted fast: saves are serialised, last call is wanted', async () => {
    const { result } = await ready()
    deferWrites()
    act(() => result.current.set('figure', '71000-1', 'owned'))
    act(() => result.current.set('figure', '71000-1', 'wanted'))
    await flush()
    expect(writeOps()).toEqual(['upsert'])
    expect(result.current.marks.get('figure:71000-1')).toBe('wanted')
    await settle('upsert')
    await settle('update')
    expect(result.current.pending.has('figure:71000-1')).toBe(true)
    await settle('upsert')
    await settle('update')
    expect(calls.filter((c) => c.op === 'update').map((c) => c.args[0])).toEqual([
      { state: 'owned' },
      { state: 'wanted' },
    ])
    expect(result.current.marks.get('figure:71000-1')).toBe('wanted')
    expect(result.current.pending.size).toBe(0)
  })

  it('three fast taps coalesce: middle state is never sent', async () => {
    const { result } = await ready()
    deferWrites()
    act(() => result.current.set('figure', '71000-1', 'owned'))
    act(() => result.current.set('figure', '71000-1', null))
    act(() => result.current.set('figure', '71000-1', 'wanted'))
    await flush()
    await settle('upsert')
    await settle('update')
    await settle('upsert')
    await settle('update')
    expect(writeOps()).toEqual(['upsert', 'update', 'upsert', 'update'])
    expect(calls.filter((c) => c.op === 'update').map((c) => c.args[0])).toEqual([
      { state: 'owned' },
      { state: 'wanted' },
    ])
    expect(result.current.pending.size).toBe(0)
  })

  it('queued tap equal to the confirmed state sends nothing', async () => {
    const { result } = await ready()
    deferWrites()
    act(() => result.current.set('figure', '71000-1', 'owned'))
    act(() => result.current.set('figure', '71000-1', 'wanted'))
    act(() => result.current.set('figure', '71000-1', 'owned'))
    await flush()
    await settle('upsert')
    await settle('update')
    expect(writeOps()).toEqual(['upsert', 'update'])
    expect(result.current.pending.size).toBe(0)
    expect(result.current.marks.get('figure:71000-1')).toBe('owned')
  })

  it('set then clear fast: delete runs after the insert finished', async () => {
    const { result } = await ready()
    deferWrites()
    act(() => result.current.set('figure', '71000-1', 'owned'))
    act(() => result.current.set('figure', '71000-1', null))
    await flush()
    expect(writeOps()).toEqual(['upsert'])
    await settle('upsert')
    await settle('update')
    expect(writeOps()).toEqual(['upsert', 'update', 'delete'])
    expect(result.current.pending.has('figure:71000-1')).toBe(true)
    await settle('delete')
    expect(result.current.pending.size).toBe(0)
    expect(result.current.marks.has('figure:71000-1')).toBe(false)
  })

  it('failure rolls back to the confirmed state', async () => {
    const { result } = await ready({ data: [{ kind: 'figure', target_id: '71000-1', state: 'wanted' }], error: null })
    deferWrites()
    act(() => result.current.set('figure', '71000-1', 'owned'))
    await flush()
    await settle('upsert')
    await settle('update', { error: { code: '500' } })
    expect(result.current.marks.get('figure:71000-1')).toBe('wanted')
    expect(result.current.failed.has('figure:71000-1')).toBe(true)
    expect(result.current.pending.size).toBe(0)
  })

  it('a failed save does not undo a newer queued tap', async () => {
    const { result } = await ready()
    deferWrites()
    act(() => result.current.set('figure', '71000-1', 'owned'))
    act(() => result.current.set('figure', '71000-1', 'wanted'))
    await flush()
    await settle('upsert', { error: { code: '500' } })
    expect(result.current.marks.get('figure:71000-1')).toBe('wanted')
    expect(result.current.failed.size).toBe(0)
    expect(result.current.pending.has('figure:71000-1')).toBe(true)
  })

  it('taps made while loading survive the load result', async () => {
    let release: (r?: Res) => void = () => {}
    gate = (op) => (op === 'select' ? new Promise((r) => (release = r)) : Promise.resolve(undefined))
    const { result } = renderHook(() => useMarks('signed-in'))
    await flush()
    act(() => result.current.set('figure', '71000-1', 'owned'))
    release({
      data: [
        { kind: 'figure', target_id: '71000-1', state: 'wanted' },
        { kind: 'figure', target_id: '71000-2', state: 'owned' },
      ],
      error: null,
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.marks.get('figure:71000-1')).toBe('owned')
    expect(result.current.marks.get('figure:71000-2')).toBe('owned')
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
    const sql = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20261102000000_v2_01_schema.sql'),
      'utf8',
    )
    const figRe = new RegExp(/kind = 'figure' and target_id ~ '([^']+)'/.exec(sql)![1])
    const serRe = new RegExp(/kind = 'series' and target_id ~ '([^']+)'/.exec(sql)![1])
    expect(figRe.source).toBe('^[0-9]{4,6}-[0-9]{1,4}$')
    expect(serRe.source).toBe('^[0-9]{4,6}$')
    const cat = JSON.parse(
      readFileSync(resolve(__dirname, '../public/catalog.json'), 'utf8'),
    ) as { series: Series[] }
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
