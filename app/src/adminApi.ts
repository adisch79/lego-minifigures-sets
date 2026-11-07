// Network side of the admin page (story V2-05, docs/design/V2-05-admin.md "Route and gate").
// The UI gate is cosmetic: every RPC and the admin-people Edge Function check `admins` again.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, type AuthState } from './auth'
import { parsePeople, parseWanted, readPeopleResult, type PeopleResult, type Person, type WantedRow } from './adminLogic'
import { DEMO_ADMIN } from './demo'

export type AdminGate = 'checking' | 'admin' | 'not-admin' | 'error'

/** rpc is_admin. Null when the call failed, so the caller can tell "no" from "could not ask". */
export async function checkAdmin(): Promise<boolean | null> {
  if (DEMO_ADMIN) return true
  try {
    // Inside the try: a test double of ./auth without a client must not break the account menu.
    if (!supabase) return false
    const { data, error } = await supabase.rpc('is_admin')
    if (error) return null
    return data === true
  } catch {
    return null
  }
}

export type AdminLists = { people: Person[]; wanted: WantedRow[] }

/** Both admin lists in parallel. Throws on any failure; the page shows one error state. */
export async function loadLists(): Promise<AdminLists> {
  if (DEMO_ADMIN) {
    const { demoLists } = await import('./adminDemo')
    const raw = await demoLists()
    return { people: parsePeople(raw.people), wanted: parseWanted(raw.wanted) }
  }
  if (!supabase) throw new Error('Sign-in is not configured on this build.')
  const [p, w] = await Promise.all([supabase.rpc('admin_allowlist_list'), supabase.rpc('admin_wanted_list')])
  if (p.error) throw new Error(p.error.message || 'The allowlist could not be loaded.')
  if (w.error) throw new Error(w.error.message || 'The wanted list could not be loaded.')
  return { people: parsePeople(p.data), wanted: parseWanted(w.data) }
}

/** Invites or removes one address through the admin-people Edge Function. Never throws. */
export async function changePerson(action: 'add' | 'remove', email: string): Promise<PeopleResult> {
  if (DEMO_ADMIN) {
    const { demoPeople } = await import('./adminDemo')
    return demoPeople(action, email)
  }
  if (!supabase) return { ok: false, error: 'network' }
  try {
    const { data, error } = await supabase.functions.invoke('admin-people', { body: { action, email } })
    if (!error) return readPeopleResult(data)
    // A non-2xx answer arrives as an error whose context is the raw Response with the JSON body.
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        return readPeopleResult(await context.json())
      } catch {
        return { ok: false, error: 'network' }
      }
    }
    return { ok: false, error: 'network' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/**
 * Admin status for the signed-in user. No call while signed out, loading or with auth disabled.
 * Asked again when the account changes.
 */
export function useIsAdmin(auth: AuthState): { gate: AdminGate; recheck: () => void } {
  const signedIn = auth.status === 'signed-in' && !!auth.email
  const key = signedIn ? (auth.email as string) : null
  const [result, setResult] = useState<{ key: string; gate: AdminGate } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (key === null) return
    let live = true
    void checkAdmin().then((yes) => {
      if (live) setResult({ key, gate: yes === null ? 'error' : yes ? 'admin' : 'not-admin' })
    })
    return () => {
      live = false
    }
  }, [key, attempt])

  const recheck = useCallback(() => {
    setResult(null)
    setAttempt((n) => n + 1)
  }, [])

  let gate: AdminGate
  if (auth.status === 'loading') gate = 'checking'
  else if (key === null) gate = 'not-admin'
  else gate = result && result.key === key ? result.gate : 'checking'
  return { gate, recheck }
}

export type AdminData =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ({ status: 'ready' } & AdminLists)

/**
 * Loads both lists once `enabled` is true. `refresh` reloads in place (the old lists stay on
 * screen) and resolves when done; `retry` goes back to the loading state first.
 */
export function useAdminData(enabled: boolean): {
  data: AdminData
  refresh: () => Promise<void>
  retry: () => void
} {
  const [data, setData] = useState<AdminData>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const fetchNow = useCallback(async () => {
    try {
      const lists = await loadLists()
      if (live.current) setData({ status: 'ready', ...lists })
    } catch (err) {
      if (live.current) setData({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  // State is set in the promise callbacks only, never synchronously in the effect body.
  useEffect(() => {
    if (!enabled) return
    let current = true
    loadLists().then(
      (lists) => {
        if (current && live.current) setData({ status: 'ready', ...lists })
      },
      (err: unknown) => {
        if (current && live.current) setData({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      },
    )
    return () => {
      current = false
    }
  }, [enabled, attempt])

  const retry = useCallback(() => {
    setData({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { data, refresh: fetchNow, retry }
}
