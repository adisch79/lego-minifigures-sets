// Story V2-15 PR 1: client call and field rules for the contact form (docs/design/V2-15-about-contact.md).
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MESSAGE_MAX,
  codePoints,
  contactEnabled,
  contactEndpoint,
  sendContact,
  validateContact,
  validateEmail,
  validateMessage,
  validateName,
} from './contactApi'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const input = { name: 'Dana', email: 'dana@example.com', message: 'Hi there', captchaToken: 'tok' }

function stubSupabase() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co/')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
}

describe('contactEnabled', () => {
  it('needs both VITE_CONTACT_ENABLED and VITE_TURNSTILE_SITE_KEY', () => {
    vi.stubEnv('VITE_CONTACT_ENABLED', '')
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    expect(contactEnabled()).toBe(false)
    vi.stubEnv('VITE_CONTACT_ENABLED', '1')
    expect(contactEnabled()).toBe(false)
    vi.stubEnv('VITE_CONTACT_ENABLED', '')
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0xKEY')
    expect(contactEnabled()).toBe(false)
    vi.stubEnv('VITE_CONTACT_ENABLED', '1')
    expect(contactEnabled()).toBe(true)
  })

  it('treats 0 and false as off', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0xKEY')
    for (const off of ['0', 'false', 'FALSE', ' ']) {
      vi.stubEnv('VITE_CONTACT_ENABLED', off)
      expect(contactEnabled()).toBe(false)
    }
  })
})

describe('field rules', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(codePoints('abc')).toBe(3)
    expect(codePoints('\u{1F600}\u{1F600}')).toBe(2)
    expect(codePoints('')).toBe(0)
  })

  it('name: optional, at most 80 code points, no control characters', () => {
    expect(validateName('')).toBeNull()
    expect(validateName('   ')).toBeNull()
    expect(validateName('Dana')).toBeNull()
    expect(validateName('a'.repeat(80))).toBeNull()
    expect(validateName('\u{1F600}'.repeat(80))).toBeNull()
    expect(validateName('a'.repeat(81))).toMatch(/80/)
    expect(validateName('Da\u0000na')).not.toBeNull()
    expect(validateName('Da\nna')).not.toBeNull()
    expect(validateName('Da\u0085na')).not.toBeNull()
  })

  it('email: required, ASCII, no whitespace or control characters, one @, at most 254', () => {
    expect(validateEmail('dana@example.com')).toBeNull()
    expect(validateEmail('  dana@example.com  ')).toBeNull()
    expect(validateEmail('')).not.toBeNull()
    expect(validateEmail('dana')).not.toBeNull()
    expect(validateEmail('@example.com')).not.toBeNull()
    expect(validateEmail('dana@')).not.toBeNull()
    expect(validateEmail('da@na@example.com')).not.toBeNull()
    expect(validateEmail('da na@example.com')).not.toBeNull()
    expect(validateEmail('dana@ex\u0007ample.com')).not.toBeNull()
    expect(validateEmail('däna@example.com')).not.toBeNull()
    const local = 'a'.repeat(254 - '@example.com'.length)
    expect(validateEmail(`${local}@example.com`)).toBeNull()
    expect(validateEmail(`a${local}@example.com`)).not.toBeNull()
  })

  it('message: 1 to 2000 code points, only newline and tab allowed as control characters', () => {
    expect(validateMessage('')).not.toBeNull()
    expect(validateMessage('  \n ')).not.toBeNull()
    expect(validateMessage('Hi')).toBeNull()
    expect(validateMessage('line one\n\tline two')).toBeNull()
    expect(validateMessage('a'.repeat(MESSAGE_MAX))).toBeNull()
    expect(validateMessage('\u{1F600}'.repeat(MESSAGE_MAX))).toBeNull()
    expect(validateMessage('a'.repeat(MESSAGE_MAX + 1))).toMatch(/2000/)
    expect(validateMessage('bad\rline')).not.toBeNull()
    expect(validateMessage('bad\u0000')).not.toBeNull()
    expect(validateMessage('bad\u007f')).not.toBeNull()
  })

  it('validateContact reports each failing field and nothing for a good form', () => {
    expect(validateContact({ name: '', email: 'a@b.c', message: 'x' })).toEqual({})
    const errors = validateContact({ name: 'a'.repeat(81), email: 'nope', message: '' })
    expect(Object.keys(errors).sort()).toEqual(['email', 'message', 'name'])
  })
})

describe('sendContact', () => {
  it('posts JSON with the anon key headers to the contact-message function', async () => {
    stubSupabase()
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(contactEndpoint()).toBe('https://abc.supabase.co/functions/v1/contact-message')
    await expect(sendContact(input)).resolves.toBe('sent')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://abc.supabase.co/functions/v1/contact-message')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers.apikey).toBe('anon-key')
    expect(headers.Authorization).toBe('Bearer anon-key')
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Dana',
      email: 'dana@example.com',
      message: 'Hi there',
      captchaToken: 'tok',
    })
  })

  it('sends trimmed name and email, and the message unchanged', async () => {
    stubSupabase()
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await sendContact({ ...input, name: '  Dana ', email: ' dana@example.com ', message: ' hi\n' })
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({ name: 'Dana', email: 'dana@example.com', message: ' hi\n' })
  })

  it.each([
    [200, 'sent'],
    [400, 'invalid'],
    [403, 'captcha'],
    [429, 'rate_limited'],
    [500, 'error'],
    [502, 'error'],
    [404, 'error'],
  ] as const)('maps HTTP %i to %s', async (status, state) => {
    stubSupabase()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })))
    await expect(sendContact(input)).resolves.toBe(state)
  })

  it('maps a network failure to error and never throws', async () => {
    stubSupabase()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(sendContact(input)).resolves.toBe('error')
  })

  it('returns error without a call when Supabase is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(contactEndpoint()).toBeNull()
    await expect(sendContact(input)).resolves.toBe('error')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('writes nothing to the console, on success or failure', async () => {
    stubSupabase()
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    )
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await sendContact(input)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))
    await sendContact(input)
    for (const s of spies) expect(s).not.toHaveBeenCalled()
  })
})
