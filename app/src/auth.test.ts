import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signInWithOtp = vi.fn()
const initialize = vi.fn()
const getSession = vi.fn()
let authListener: ((event: string, session: unknown) => void) | null = null
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOtp,
      signOut: vi.fn(),
      initialize: () => initialize(),
      getSession: () => getSession(),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        authListener = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
    },
  })),
}))

async function load(withEnv: boolean) {
  vi.resetModules()
  if (withEnv) {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
  } else {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
  }
  return import('./auth')
}

beforeEach(() => {
  signInWithOtp.mockReset()
  initialize.mockReset().mockResolvedValue({ error: null })
  getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null })
  authListener = null
  window.history.replaceState(null, '', '/app/')
})
afterEach(() => vi.unstubAllEnvs())

describe('authEnabled', () => {
  it('is false and client null when vars are missing', async () => {
    const a = await load(false)
    expect(a.authEnabled).toBe(false)
    expect(a.supabase).toBeNull()
  })
  it('is true when both vars are set', async () => {
    const a = await load(true)
    expect(a.authEnabled).toBe(true)
    expect(a.supabase).not.toBeNull()
  })
})

describe('requestLink', () => {
  it('maps success', async () => {
    const a = await load(true)
    signInWithOtp.mockResolvedValue({ error: null })
    expect(await a.requestLink('a@b.co')).toEqual({ ok: true })
  })
  it('trims, lower-cases, forbids user creation, sets redirect', async () => {
    const a = await load(true)
    signInWithOtp.mockResolvedValue({ error: null })
    await a.requestLink('  Foo@Bar.COM ')
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'foo@bar.com',
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + '/app/' },
    })
  })
  it('redirect drops query and hash', async () => {
    const a = await load(true)
    window.history.replaceState(null, '', '/app/?q=x#series/71019')
    signInWithOtp.mockResolvedValue({ error: null })
    await a.requestLink('a@b.co')
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBe(window.location.origin + '/app/')
  })
  it('treats unlisted errors as ok', async () => {
    const a = await load(true)
    signInWithOtp.mockResolvedValue({ error: { status: 422, code: 'signup_disabled', message: 'Signups not allowed for otp' } })
    expect(await a.requestLink('x@y.zz')).toEqual({ ok: true })
    signInWithOtp.mockResolvedValue({ error: { status: 400, message: 'User not found' } })
    expect(await a.requestLink('x@y.zz')).toEqual({ ok: true })
  })
  it('maps 429 to rate', async () => {
    const a = await load(true)
    signInWithOtp.mockResolvedValue({ error: { status: 429, message: 'slow down' } })
    expect(await a.requestLink('a@b.co')).toEqual({ ok: false, reason: 'rate' })
  })
  it('maps other errors and throws to network', async () => {
    const a = await load(true)
    signInWithOtp.mockResolvedValue({ error: { status: 500, message: 'boom' } })
    expect(await a.requestLink('a@b.co')).toEqual({ ok: false, reason: 'network' })
    signInWithOtp.mockRejectedValue(new Error('offline'))
    expect(await a.requestLink('a@b.co')).toEqual({ ok: false, reason: 'network' })
  })
  it('rejects a bad address without calling Supabase', async () => {
    const a = await load(true)
    expect(await a.requestLink('nope')).toEqual({ ok: false, reason: 'invalid' })
    expect(await a.requestLink('   ')).toEqual({ ok: false, reason: 'invalid' })
    expect(signInWithOtp).not.toHaveBeenCalled()
  })
})

describe('link errors', () => {
  const EXPIRED = 'That sign-in link has expired. Ask for a new one.'
  const OTHER = 'Open the sign-in link in the same browser where you asked for it, or ask for a new one.'

  it('parses the hash form', async () => {
    const a = await load(false)
    expect(a.parseLinkError('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toBe(EXPIRED)
  })
  it('parses the query form', async () => {
    const a = await load(false)
    expect(a.parseLinkError('?error=access_denied&error_code=otp_expired', '')).toBe(EXPIRED)
    expect(a.parseLinkError('?error_description=PKCE+code+verifier+not+found', '')).toBe(OTHER)
  })
  it('returns null with no error and ignores route hashes', async () => {
    const a = await load(false)
    expect(a.parseLinkError('?q=x', '#series/71019')).toBeNull()
  })
  it('cleanup keeps q, sort and the series hash', async () => {
    const a = await load(false)
    const out = a.cleanLinkUrl('https://x.io/app/?q=bat&sort=name&code=abc&error=e&error_code=c#series/71019', true)
    expect(out).toBe('/app/?q=bat&sort=name#series/71019')
  })
  it('cleanup keeps code when not asked to strip it', async () => {
    const a = await load(false)
    expect(a.cleanLinkUrl('https://x.io/app/?code=abc&q=1', false)).toBe('/app/?code=abc&q=1')
  })
  it('cleanup drops an error hash', async () => {
    const a = await load(false)
    expect(a.cleanLinkUrl('https://x.io/app/?q=1#error=access_denied&error_code=otp_expired', false)).toBe('/app/?q=1')
  })
  it('cleanup drops implicit-flow tokens from the hash but keeps route hashes', async () => {
    const a = await load(false)
    expect(a.cleanLinkUrl('https://x.io/app/?q=1#access_token=a&refresh_token=b&token_type=bearer', false)).toBe('/app/?q=1')
    expect(a.cleanLinkUrl('https://x.io/app/#token_type=bearer', false)).toBe('/app/')
    expect(a.cleanLinkUrl('https://x.io/app/#series/71019', false)).toBe('/app/#series/71019')
  })
  it('module clears URL error params at load', async () => {
    window.history.replaceState(null, '', '/app/?q=bat#error=access_denied&error_code=otp_expired')
    await load(true)
    expect(window.location.search).toBe('?q=bat')
    expect(window.location.hash).toBe('')
  })
})

describe('useAuth', () => {
  const OTHER = 'Open the sign-in link in the same browser where you asked for it, or ask for a new one.'
  const session = { data: { session: { user: { email: 'a@b.co' } } }, error: null }

  it('shows the exchange error returned by initialize', async () => {
    const a = await load(true)
    initialize.mockResolvedValue({ error: { code: 'flow_state_not_found', message: 'PKCE code verifier not found' } })
    const { result } = renderHook(() => a.useAuth())
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    expect(result.current.linkError).toBe(OTHER)
  })
  it('clears linkError once signed in so it does not return after sign-out', async () => {
    const a = await load(true)
    initialize.mockResolvedValue({ error: { code: 'x', message: 'bad' } })
    const { result } = renderHook(() => a.useAuth())
    await waitFor(() => expect(result.current.linkError).toBe(OTHER))
    act(() => authListener?.('SIGNED_IN', { user: { email: 'a@b.co' } }))
    expect(result.current.status).toBe('signed-in')
    expect(result.current.linkError).toBeUndefined()
    act(() => authListener?.('SIGNED_OUT', null))
    expect(result.current.status).toBe('signed-out')
    expect(result.current.linkError).toBeUndefined()
  })
  it('strips ?code= only when the page loaded with one', async () => {
    window.history.replaceState(null, '', '/app/?code=abc&q=1')
    const a = await load(true)
    getSession.mockResolvedValue(session)
    const { result } = renderHook(() => a.useAuth())
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(window.location.search).toBe('?q=1')
  })
  it('leaves a later ?code= alone when the load had none', async () => {
    const a = await load(true)
    window.history.replaceState(null, '', '/app/?code=zzz')
    const { result } = renderHook(() => a.useAuth())
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    expect(window.location.search).toBe('?code=zzz')
  })
  it('clears implicit-flow tokens from the hash', async () => {
    window.history.replaceState(null, '', '/app/#access_token=a&refresh_token=b&token_type=bearer')
    const a = await load(true)
    const { result } = renderHook(() => a.useAuth())
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    expect(window.location.hash).toBe('')
  })
})

describe('requestLink loose match', () => {
  it('does not treat an unrelated "not allowed" message as the same answer', async () => {
    const a = await load(true)
    signInWithOtp.mockResolvedValue({ error: { status: 400, message: 'Origin not allowed' } })
    expect(await a.requestLink('a@b.co')).toEqual({ ok: false, reason: 'network' })
  })
})
