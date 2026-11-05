import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, type AuthState } from './auth'
import type { Series } from './catalog'

export type MarkKind = 'figure' | 'series'
export type MarkState = 'owned' | 'wanted'
export type MarkKey = `${MarkKind}:${string}`
export type MarkMap = Map<MarkKey, MarkState>
export type SetResult = { ok: true } | { ok: false; reason: 'cap' | 'network' | 'invalid' }
export type MarksStatus = 'off' | 'loading' | 'ready' | 'error'
export type SeriesFilter = 'all' | 'wanted' | 'missing'

// SOURCE: supabase/migrations/20261102000000_v2_01_schema.sql, private.enforce_marks_cap raises errcode 54000.
const CAP_CODE = '54000'

// SOURCE: supabase/migrations/20261102000000_v2_01_schema.sql marks check constraints (also asserted in marks.test.ts).
const SERIES_ID = /^[0-9]{4,6}$/
const FIGURE_ID = /^[0-9]{4,6}-[0-9]{1,4}$/

function isKind(v: unknown): v is MarkKind {
  return v === 'figure' || v === 'series'
}
function isState(v: unknown): v is MarkState {
  return v === 'owned' || v === 'wanted'
}
function validTarget(kind: unknown, id: unknown): boolean {
  if (typeof id !== 'string') return false
  return kind === 'figure' ? FIGURE_ID.test(id) : kind === 'series' ? SERIES_ID.test(id) : false
}

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
      if (!isKind(r.kind) || !isState(r.state)) continue
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
export async function setMark(
  kind: MarkKind,
  id: string,
  state: MarkState | null,
  /** Last server-confirmed state; null/absent means the insert below may create the row. */
  previous: MarkState | null = null,
): Promise<SetResult> {
  if (!validTarget(kind, id) || (state !== null && !isState(state))) return { ok: false, reason: 'invalid' }
  if (!supabase) return { ok: false, reason: 'network' }
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) return { ok: false, reason: 'network' }
    if (state === null) {
      const del = await supabase
        .from('marks')
        .delete()
        .eq('user_id', userId)
        .eq('kind', kind)
        .eq('target_id', id)
      return toResult(del.error)
    }
    const ins = await supabase
      .from('marks')
      .upsert(
        { user_id: userId, kind, target_id: id, state },
        { onConflict: 'user_id,kind,target_id', ignoreDuplicates: true },
      )
    if (ins.error) return toResult(ins.error)
    const upd = await supabase
      .from('marks')
      .update({ state })
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('target_id', id)
      .select()
    const failure: SetResult | null = upd.error
      ? toResult(upd.error)
      : !upd.data || upd.data.length === 0
        ? { ok: false, reason: 'network' }
        : null
    if (failure) {
      if (previous === null) {
        // The insert may have created this row; remove it so a failed save leaves no stray mark.
        try {
          await supabase.from('marks').delete().eq('user_id', userId).eq('kind', kind).eq('target_id', id)
        } catch {
          /* best effort */
        }
      }
      return failure
    }
    return { ok: true }
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

export function without<T>(s: Set<T>, v: T): Set<T> {
  const n = new Set(s)
  n.delete(v)
  return n
}

function splitKey(key: MarkKey): [MarkKind, string] {
  const i = key.indexOf(':')
  return [key.slice(0, i) as MarkKind, key.slice(i + 1)]
}

export function useMarks(authStatus: AuthState['status']): UseMarks {
  const [marks, setMarks] = useState<MarkMap>(new Map())
  const [status, setStatus] = useState<MarksStatus>('off')
  const [pending, setPending] = useState<Set<MarkKey>>(new Set())
  const [failed, setFailed] = useState<Set<MarkKey>>(new Set())
  // Desired state of marks whose save failed, so retry can resend it.
  const desired = useRef(new Map<MarkKey, MarkState | null>())
  const epoch = useRef(0)
  // Authoritative optimistic copy, written only from callbacks and the load effect.
  const current = useRef<MarkMap>(new Map())
  // Last server-confirmed state per key; failures roll back to this.
  const confirmed = useRef<MarkMap>(new Map())
  // Per-key save queue: at most one call in flight, the latest wanted state waits behind it.
  const inFlight = useRef(new Set<MarkKey>())
  const queued = useRef(new Map<MarkKey, MarkState | null>())
  // Keys tapped since the current load started, re-applied over the load result.
  const edited = useRef(new Set<MarkKey>())

  /* The effect resets state when the auth state changes; it is the sync point with the external session. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const my = ++epoch.current
    desired.current.clear()
    inFlight.current.clear()
    queued.current.clear()
    edited.current.clear()
    confirmed.current = new Map()
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
        confirmed.current = new Map(m)
        // Taps made while loading win over the (older) server snapshot.
        const merged = new Map(m)
        for (const key of edited.current) {
          const v = current.current.get(key)
          if (v === undefined) merged.delete(key)
          else merged.set(key, v)
        }
        edited.current.clear()
        current.current = merged
        setMarks(merged)
        setStatus('ready')
      } else {
        setStatus('error')
      }
    })
  }, [authStatus])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Runs one save for the key, then the queued latest state (if it differs from what is confirmed).
  const save = useCallback((key: MarkKey, first: MarkState | null, my: number) => {
    const [kind, id] = splitKey(key)
    const run = (state: MarkState | null) => {
      inFlight.current.add(key)
      void setMark(kind, id, state, confirmed.current.get(key) ?? null).then((res) => {
        if (my !== epoch.current) return
        inFlight.current.delete(key)
        if (res.ok) {
          if (state === null) confirmed.current.delete(key)
          else confirmed.current.set(key, state)
        }
        if (queued.current.has(key)) {
          const next = queued.current.get(key) ?? null
          queued.current.delete(key)
          if (!res.ok || next !== (confirmed.current.get(key) ?? null)) {
            // A newer tap supersedes this result; a failure here must not undo it.
            run(next)
            return
          }
        }
        setPending((cur) => without(cur, key))
        if (res.ok) {
          desired.current.delete(key)
          return
        }
        desired.current.set(key, state)
        const back = new Map(current.current)
        const was = confirmed.current.get(key)
        if (was === undefined) back.delete(key)
        else back.set(key, was)
        current.current = back
        setMarks(back)
        setFailed((cur) => new Set(cur).add(key))
      })
    }
    run(first)
  }, [])

  const set = useCallback(
    (kind: MarkKind, id: string, state: MarkState | null) => {
      const key = markKey(kind, id)
      const next = new Map(current.current)
      if (state === null) next.delete(key)
      else next.set(key, state)
      current.current = next
      edited.current.add(key)
      setMarks(next)
      setFailed((cur) => without(cur, key))
      setPending((cur) => new Set(cur).add(key))
      if (inFlight.current.has(key)) queued.current.set(key, state)
      else save(key, state, epoch.current)
    },
    [save],
  )

  const retry = useCallback(
    (key: MarkKey) => {
      if (!desired.current.has(key)) return
      const state = desired.current.get(key) ?? null
      const [kind, id] = splitKey(key)
      set(kind, id, state)
    },
    [set],
  )

  return { marks, status, set, pending, failed, retry }
}
