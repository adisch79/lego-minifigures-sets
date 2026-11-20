import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'

const MSG_EXPIRED = 'That sign-in link has expired. Ask for a new one.'
// Token-link failures say nothing about the browser: the link is opened from a mail, not the sign-in tab.
const MSG_LINK_FAILED = 'That sign-in link did not work. Ask for a new one.'
const MSG_OTHER =
  'Open the sign-in link in the same browser where you asked for it, or ask for a new one.'

const LINK_PARAMS = ['error', 'error_code', 'error_description']
// Implicit-flow tokens that must not stay in the address bar.
const TOKEN_PARAMS = ['access_token', 'refresh_token', 'token_type']

export type LinkResult =
  | { ok: true }
  | { ok: false; reason: 'rate' | 'invalid' | 'network' | 'captcha' }

export type AuthState = {
  status: 'disabled' | 'loading' | 'signed-out' | 'signed-in'
  email?: string
  linkError?: string
  /** True while an email token link waits for the visitor to confirm (no verifyOtp has run yet). */
  pendingLink?: boolean
  /** Runs the one verifyOtp for the pending link. Safe to call twice. */
  continueLink?: () => Promise<void>
  /** Drops the pending link without using it. */
  dismissLink?: () => void
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

// V2-16: the email button opens `<site>?token_hash=...&type=email` (no Supabase host in the mail).
// Read and strip at module load, like the PKCE code, so the secret hash does not stay in the address bar.
// The link is NOT used on load: a mail scanner or a forged link must not sign the visitor in by itself
// (login CSRF). verifyOtp runs only when the visitor clicks Continue.
// SOURCE: https://supabase.com/docs/guides/auth/auth-email-templates (token_hash + type, then verifyOtp)
// SOURCE: https://supabase.com/docs/reference/javascript/auth-verifyotp ("Verify Email Auth (Token Hash)": type 'email')
const TOKEN_HASH_TYPES = ['email']
// Shape check only (URL-safe characters, bounded length); Supabase validates the value itself.
const TOKEN_HASH_SHAPE = /^[A-Za-z0-9_-]{1,128}$/
// True when a token_hash was present but malformed: the visitor sees the failed-link message.
let invalidTokenLink = false
/** Returns the invalid-link flag and clears it, so only the first caller (first mount) sees it. */
function takeInvalidTokenLink(): boolean {
  const v = invalidTokenLink
  invalidTokenLink = false
  return v
}
let pendingTokenLink: { tokenHash: string; type: 'email' } | null = (() => {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search)
  if (!p.has('token_hash')) return null
  const tokenHash = p.get('token_hash') ?? ''
  const type = p.get('type') ?? ''
  p.delete('token_hash')
  p.delete('type')
  const qs = p.toString()
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
  if (!TOKEN_HASH_SHAPE.test(tokenHash) || !TOKEN_HASH_TYPES.includes(type)) {
    invalidTokenLink = true
    return null
  }
  return { tokenHash, type: 'email' }
})()

export const authEnabled: boolean = Boolean(url && anonKey)

// Created once at module load so the PKCE `?code=` is read before React effects run.
export const supabase: SupabaseClient | null = authEnabled
  ? createClient(url as string, anonKey as string, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    })
  : null

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Same answer for every address (anti-enumeration). signup_disabled stays ok:true on purpose: with the
// Supabase sign-up flag off, an unknown address must look like a known one; the release checklist
// covers turning sign-up on. email_not_confirmed is included so an unconfirmed account
// cannot be told apart from a new one.
const SAME_ANSWER_CODES = ['signup_disabled', 'user_not_found', 'otp_disabled', 'not_allowed', 'email_not_confirmed']
const RATE_CODES = ['over_email_send_rate_limit', 'over_request_rate_limit']

// Runs verifyOtp at most once per page load (double click, StrictMode); resolves to an error message or undefined.
let tokenLinkResult: Promise<string | undefined> | null = null
function verifyTokenLink(): Promise<string | undefined> {
  if (!pendingTokenLink || !supabase) return Promise.resolve(undefined)
  const client = supabase
  const link = pendingTokenLink
  tokenLinkResult ??= (async () => {
    try {
      const { error } = await client.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      return error ? MSG_LINK_FAILED : undefined
    } catch {
      return MSG_LINK_FAILED
    }
  })()
  return tokenLinkResult
}

/**
 * Asks for a sign-in link; a new address creates an account (V2-09 open sign-up). Every address gets the
 * same answer. captchaToken is the Turnstile token, sent only when the widget is configured.
 */
export async function requestLink(email: string, captchaToken?: string): Promise<LinkResult> {
  const clean = email.trim().toLowerCase()
  if (!EMAIL_SHAPE.test(clean)) return { ok: false, reason: 'invalid' }
  if (!supabase) return { ok: false, reason: 'network' }
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + window.location.pathname,
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    if (!error) return { ok: true }
    if (error.status === 429 || (error.code && RATE_CODES.includes(error.code))) {
      return { ok: false, reason: 'rate' }
    }
    const msg = (error.message ?? '').toLowerCase()
    if (error.code === 'captcha_failed' || msg.includes('captcha')) return { ok: false, reason: 'captcha' }
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
  // Taken once per hook instance (useState keeps the first result across StrictMode re-renders).
  const [initialTokenFailure] = useState(takeInvalidTokenLink)
  const [state, setState] = useState<AuthState>(
    authEnabled
      ? {
          status: 'loading',
          linkError: initialLinkError ?? (initialTokenFailure ? MSG_LINK_FAILED : undefined),
          pendingLink: pendingTokenLink !== null,
        }
      : { status: 'disabled' },
  )
  // A token-link failure survives later auth events while signed in (until dismissed or a later link works).
  const tokenFailure = useRef(initialTokenFailure)
  // Email of the current session, to tell a real sign-in from a re-emitted SIGNED_IN.
  const emailRef = useRef<string | undefined>(undefined)

  const dismissLink = useCallback(() => {
    pendingTokenLink = null
    setState((prev) => ({ ...prev, pendingLink: false }))
  }, [])

  const continueLink = useCallback(async () => {
    if (!supabase) return
    const tokenError = await verifyTokenLink()
    tokenFailure.current = tokenError !== undefined
    pendingTokenLink = null
    try {
      const { data: s } = await supabase.auth.getSession()
      const email = s.session?.user.email ?? undefined
      emailRef.current = email
      setState((prev) => ({
        ...prev,
        status: email ? 'signed-in' : 'signed-out',
        email,
        pendingLink: false,
        linkError: tokenError ?? (email ? undefined : prev.linkError),
      }))
    } catch {
      setState((prev) => ({ ...prev, pendingLink: false, linkError: tokenError ?? MSG_LINK_FAILED }))
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    const apply = (email: string | undefined, linkError?: string) => {
      if (!active) return
      emailRef.current = email
      setState((prev) => ({
        status: email ? 'signed-in' : 'signed-out',
        email,
        // A session ends the failed-link story, so the strip must not return after a later sign-out.
        linkError:
          email && !(tokenFailure.current && prev.linkError) ? undefined : (linkError ?? prev.linkError),
        pendingLink: prev.pendingLink,
      }))
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // A real transition into a session (was signed out, or a different user) ends any earlier
      // token-link failure. A re-emitted SIGNED_IN for the same user (refocus, recovery) does not.
      const next = session?.user.email ?? undefined
      if (event === 'SIGNED_IN' && next && next !== emailRef.current) tokenFailure.current = false
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

  return { ...state, continueLink, dismissLink }
}
