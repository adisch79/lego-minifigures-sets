import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const MSG_EXPIRED = 'That sign-in link has expired. Ask for a new one.'
const MSG_OTHER =
  'Open the sign-in link in the same browser where you asked for it, or ask for a new one.'

const LINK_PARAMS = ['error', 'error_code', 'error_description']
// Implicit-flow tokens that must not stay in the address bar.
const TOKEN_PARAMS = ['access_token', 'refresh_token', 'token_type']

export type LinkResult =
  | { ok: true }
  | { ok: false; reason: 'rate' | 'invalid' | 'network' }

export type AuthState = {
  status: 'disabled' | 'loading' | 'signed-out' | 'signed-in'
  email?: string
  linkError?: string
}

/** Maps an error code or text from Supabase to a plain message. */
export function describeLinkError(code: string, description = ''): string {
  const text = `${code} ${description}`.toLowerCase()
  return text.includes('expired') ? MSG_EXPIRED : MSG_OTHER
}

/** Reads link errors from the query string or from a hash like `#error=...`. Returns null if none. */
export function parseLinkError(search: string, hash: string): string | null {
  const fromHash = hash.startsWith('#') && hash.includes('=') ? hash.slice(1) : ''
  for (const raw of [search, fromHash]) {
    const p = new URLSearchParams(raw)
    if (p.has('error') || p.has('error_code') || p.has('error_description')) {
      return describeLinkError(p.get('error_code') ?? p.get('error') ?? '', p.get('error_description') ?? '')
    }
  }
  return null
}

/**
 * Returns the URL (path, query, hash) with link-error params removed, and the used `code` when
 * stripCode is set. Unrelated query params and route hashes like `#series/71019` stay.
 */
export function cleanLinkUrl(href: string, stripCode: boolean): string {
  const url = new URL(href)
  for (const k of LINK_PARAMS) url.searchParams.delete(k)
  if (stripCode) url.searchParams.delete('code')
  const hashParams =
    url.hash.startsWith('#') && url.hash.includes('=') ? new URLSearchParams(url.hash.slice(1)) : null
  if (hashParams && [...LINK_PARAMS, ...TOKEN_PARAMS].some((k) => hashParams.has(k))) url.hash = ''
  return url.pathname + url.search + url.hash
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Read the URL error before the client touches the URL, then clear it so it is shown once.
const initialLinkError: string | null =
  typeof window === 'undefined' ? null : parseLinkError(window.location.search, window.location.hash)
if (initialLinkError !== null) {
  window.history.replaceState(null, '', cleanLinkUrl(window.location.href, false))
}

// True when the page was opened with a PKCE `?code=`; only then is it stripped after the exchange.
const initialHadCode: boolean =
  typeof window === 'undefined' ? false : new URLSearchParams(window.location.search).has('code')

export const authEnabled: boolean = Boolean(url && anonKey)

// Created once at module load so the PKCE `?code=` is read before React effects run.
export const supabase: SupabaseClient | null = authEnabled
  ? createClient(url as string, anonKey as string, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    })
  : null

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// email_not_confirmed is included so an unconfirmed account cannot reveal who is invited.
const SAME_ANSWER_CODES = ['signup_disabled', 'user_not_found', 'otp_disabled', 'not_allowed', 'email_not_confirmed']
const RATE_CODES = ['over_email_send_rate_limit', 'over_request_rate_limit']

/** Asks for a sign-in link. Listed and unlisted addresses get the same answer. */
export async function requestLink(email: string): Promise<LinkResult> {
  const clean = email.trim().toLowerCase()
  if (!EMAIL_SHAPE.test(clean)) return { ok: false, reason: 'invalid' }
  if (!supabase) return { ok: false, reason: 'network' }
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    })
    if (!error) return { ok: true }
    if (error.status === 429 || (error.code && RATE_CODES.includes(error.code))) {
      return { ok: false, reason: 'rate' }
    }
    const msg = (error.message ?? '').toLowerCase()
    if (
      (error.code && SAME_ANSWER_CODES.includes(error.code)) ||
      msg === 'signups not allowed for otp' ||
      msg.includes('signup is disabled') ||
      msg.includes('user not found')
    ) {
      return { ok: true }
    }
    return { ok: false, reason: 'network' }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Local sign-out must not throw out of the click; the stored session is dropped on next load anyway.
  }
}

/** Session state for the UI. Safe to call when auth is disabled. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(
    authEnabled ? { status: 'loading', linkError: initialLinkError ?? undefined } : { status: 'disabled' },
  )

  useEffect(() => {
    if (!supabase) return
    let active = true
    const apply = (email: string | undefined, linkError?: string) => {
      if (!active) return
      setState((prev) => ({
        status: email ? 'signed-in' : 'signed-out',
        email,
        // A session ends the failed-link story, so the strip must not return after a later sign-out.
        linkError: email ? undefined : (linkError ?? prev.linkError),
      }))
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user.email ?? undefined)
    })
    void (async () => {
      try {
        // initialize() runs the PKCE exchange and returns its error; getSession alone would drop it.
        const { error } = await supabase.auth.initialize()
        const exchangeError = error ? describeLinkError(error.code ?? '', error.message) : undefined
        const { data: s } = await supabase.auth.getSession()
        const next = cleanLinkUrl(window.location.href, initialHadCode)
        if (next !== window.location.pathname + window.location.search + window.location.hash) {
          window.history.replaceState(null, '', next)
        }
        apply(s.session?.user.email ?? undefined, exchangeError)
      } catch {
        // A rejected call must not leave the control on the loading state.
        apply(undefined)
      }
    })()
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
