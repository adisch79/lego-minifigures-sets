// Dev-only demo collection for screenshots and manual checks of the owned / wanted UI (story V2-03).
// Open the dev server with ?demo in the URL. import.meta.env.DEV is the constant false in a
// production build, so DEMO is false there and none of this runs or reaches the bundle's logic.
import { useCallback, useRef, useState } from 'react'
import type { AuthState } from './auth'
import { markKey, without, type MarkKey, type MarkKind, type MarkMap, type MarkState, type UseMarks } from './marks'

export const DEMO: boolean =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')

// ?demo=admin signs the demo in as the owner and serves the admin page from ./adminDemo (story V2-05).
// ?demo=admin&allow also opens the allowlist panel on load, for screenshots.
export const DEMO_ADMIN: boolean = DEMO && new URLSearchParams(window.location.search).get('demo') === 'admin'

export const DEMO_AUTH: AuthState = {
  status: 'signed-in',
  email: DEMO_ADMIN ? 'owner@example.com' : 'minifig.collector.longname@example.com',
}

// Invented marks over real catalog ids, matching the approved mockup (mockups/V2-03/kit.js).
const SEED: [MarkKind, string, MarkState][] = [
  ...[1, 5, 7, 8, 10, 11, 12].map((n): [MarkKind, string, MarkState] => ['figure', `71048-${n}`, 'owned']),
  ['figure', '71048-2', 'wanted'],
  ['figure', '71048-9', 'wanted'],
  ...Array.from({ length: 12 }, (_, i): [MarkKind, string, MarkState] => ['figure', `71052-${i + 1}`, 'owned']),
  ['series', '71052', 'owned'],
  ...[1, 2, 3, 4, 5].map((n): [MarkKind, string, MarkState] => ['figure', `71051-${n}`, 'owned']),
  ['figure', '71051-6', 'wanted'],
  ['figure', '71051-7', 'wanted'],
  ...[1, 2, 3].map((n): [MarkKind, string, MarkState] => ['figure', `71049-${n}`, 'owned']),
  ['series', '71049', 'wanted'],
]

// Fake round trip, long enough to see the spinner.
const DELAY_MS = 900
// Saving a mark on this figure always fails, so the rollback and Retry states can be seen.
const FAILING: MarkKey = 'figure:71048-4'


/** Same contract as useMarks, kept in memory. */
export function useDemoMarks(): UseMarks {
  const [marks, setMarks] = useState<MarkMap>(() => new Map(SEED.map(([k, id, s]) => [markKey(k, id), s])))
  const [pending, setPending] = useState<Set<MarkKey>>(new Set())
  const [failed, setFailed] = useState<Set<MarkKey>>(new Set())
  const current = useRef<MarkMap>(marks)
  const desired = useRef(new Map<MarkKey, MarkState | null>())

  const set = useCallback((kind: MarkKind, id: string, state: MarkState | null) => {
    const key = markKey(kind, id)
    const previous = current.current.get(key)
    const next = new Map(current.current)
    if (state === null) next.delete(key)
    else next.set(key, state)
    current.current = next
    setMarks(next)
    setFailed((cur) => without(cur, key))
    setPending((cur) => new Set(cur).add(key))
    window.setTimeout(() => {
      setPending((cur) => without(cur, key))
      if (key !== FAILING) return
      desired.current.set(key, state)
      const back = new Map(current.current)
      if (previous === undefined) back.delete(key)
      else back.set(key, previous)
      current.current = back
      setMarks(back)
      setFailed((cur) => new Set(cur).add(key))
    }, DELAY_MS)
  }, [])

  const retry = useCallback(
    (key: MarkKey) => {
      if (!desired.current.has(key)) return
      const i = key.indexOf(':')
      set(key.slice(0, i) as MarkKind, key.slice(i + 1), desired.current.get(key) ?? null)
    },
    [set],
  )

  return { marks, status: 'ready', set, pending, failed, retry }
}
