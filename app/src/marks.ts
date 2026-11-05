import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, type AuthState } from './auth'
import type { Series } from './catalog'

export type MarkKind = 'figure' | 'series'
export type MarkState = 'owned' | 'wanted'
export type MarkKey = `${MarkKind}:${string}`
export type MarkMap = Map<MarkKey, MarkState>
export type SetResult = { ok: true } | { ok: false; reason: 'cap' | 'network' }
export type MarksStatus = 'off' | 'loading' | 'ready' | 'error'
export type SeriesFilter = 'all' | 'wanted' | 'missing'

// SOURCE: supabase/migrations/20261102000000_v2_01_schema.sql, private.enforce_marks_cap raises errcode 54000.
const CAP_CODE = '54000'

export function markKey(kind: MarkKind, id: string): MarkKey {
  return `${kind}:${id}`
}

/** Loads the signed-in user's rows (RLS limits the select to them). Returns null on failure. */
export async function loadMarks(): Promise<MarkMap | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('marks').select('kind,target_id,state')
    if (error || !data) return null
    const map: MarkMap = new Map()
    for (const r of data as { kind: MarkKind; target_id: string; state: MarkState }[]) {
      map.set(markKey(r.kind, r.target_id), r.state)
    }
    return map
  } catch {
    return null
  }
}

function toResult(error: { code?: string } | null | undefined): SetResult {
  if (!error) return { ok: true }
  return { ok: false, reason: error.code === CAP_CODE ? 'cap' : 'network' }
}

/**
 * Sets or clears one mark. Only `update (state)` is granted, so a plain upsert is refused:
 * insert (ignoring duplicates), then update state. RLS pins rows to the session user.
 */
export async function setMark(kind: MarkKind, id: string, state: MarkState | null): Promise<SetResult> {
  if (!supabase) return { ok: false, reason: 'network' }
  try {
    if (state === null) {
      const del = await supabase.from('marks').delete().eq('kind', kind).eq('target_id', id)
      return toResult(del.error)
    }
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) return { ok: false, reason: 'network' }
    const ins = await supabase
      .from('marks')
      .upsert(
        { user_id: userId, kind, target_id: id, state },
        { onConflict: 'user_id,kind,target_id', ignoreDuplicates: true },
      )
    if (ins.error) return toResult(ins.error)
    const upd = await supabase.from('marks').update({ state }).eq('kind', kind).eq('target_id', id)
    return toResult(upd.error)
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** Counts figure marks of one series. Series marks are ignored. */
export function seriesProgress(series: Series, marks: MarkMap): { owned: number; wanted: number; total: number } {
  let owned = 0
  let wanted = 0
  for (const f of series.figures) {
    const m = marks.get(markKey('figure', f.id))
    if (m === 'owned') owned++
    else if (m === 'wanted') wanted++
  }
  return { owned, wanted, total: series.figures.length }
}

export function filterSeries(series: Series[], marks: MarkMap, filter: SeriesFilter): Series[] {
  if (filter === 'all') return series
  if (filter === 'wanted') {
    return series.filter(
      (s) =>
        marks.get(markKey('series', s.id)) === 'wanted' ||
        s.figures.some((f) => marks.get(markKey('figure', f.id)) === 'wanted'),
    )
  }
  return series.filter((s) => seriesProgress(s, marks).owned < s.figures.length)
}

export type UseMarks = {
  marks: MarkMap
  status: MarksStatus
  set: (kind: MarkKind, id: string, state: MarkState | null) => void
  pending: Set<MarkKey>
  failed: Set<MarkKey>
  retry: (key: MarkKey) => void
}

function without<T>(s: Set<T>, v: T): Set<T> {
  const n = new Set(s)
  n.delete(v)
  return n
}

export function useMarks(authStatus: AuthState['status']): UseMarks {
  const [marks, setMarks] = useState<MarkMap>(new Map())
  const [status, setStatus] = useState<MarksStatus>('off')
  const [pending, setPending] = useState<Set<MarkKey>>(new Set())
  const [failed, setFailed] = useState<Set<MarkKey>>(new Set())
  // Desired state of marks whose save failed, so retry can resend it.
  const desired = useRef(new Map<MarkKey, MarkState | null>())
  const epoch = useRef(0)
  // Authoritative copy, written only from callbacks and the load effect, so quick taps roll back correctly.
  const current = useRef<MarkMap>(new Map())

  /* The effect resets state when the auth state changes; it is the sync point with the external session. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const my = ++epoch.current
    desired.current.clear()
    setPending(new Set())
    setFailed(new Set())
    if (authStatus !== 'signed-in') {
      current.current = new Map()
      setMarks(current.current)
      setStatus(authStatus === 'loading' ? 'loading' : 'off')
      return
    }
    setStatus('loading')
    void loadMarks().then((m) => {
      if (my !== epoch.current) return
      if (m) {
        current.current = m
        setMarks(m)
        setStatus('ready')
      } else {
        setStatus('error')
      }
    })
  }, [authStatus])
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = useCallback((kind: MarkKind, id: string, state: MarkState | null) => {
    const key = markKey(kind, id)
    const my = epoch.current
    const previous = current.current.get(key)
    const next = new Map(current.current)
    if (state === null) next.delete(key)
    else next.set(key, state)
    current.current = next
    setMarks(next)
    setFailed((cur) => without(cur, key))
    setPending((cur) => new Set(cur).add(key))
    void setMark(kind, id, state).then((res) => {
      if (my !== epoch.current) return
      setPending((cur) => without(cur, key))
      if (res.ok) {
        desired.current.delete(key)
        return
      }
      desired.current.set(key, state)
      const back = new Map(current.current)
      if (previous === undefined) back.delete(key)
      else back.set(key, previous)
      current.current = back
      setMarks(back)
      setFailed((cur) => new Set(cur).add(key))
    })
  }, [])

  const retry = useCallback(
    (key: MarkKey) => {
      if (!desired.current.has(key)) return
      const state = desired.current.get(key) ?? null
      const i = key.indexOf(':')
      set(key.slice(0, i) as MarkKind, key.slice(i + 1), state)
    },
    [set],
  )

  return { marks, status, set, pending, failed, retry }
}
