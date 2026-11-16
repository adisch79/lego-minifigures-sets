// Story V2-15 PR 1: client side of the contact form (docs/design/V2-15-about-contact.md "Contact form").
// The server (Edge Function contact-message, PR 2) is the authority; these rules only spare a round trip.
// Never logs: the message text and the email must not reach the console.
import { turnstileSiteKey } from './Turnstile'

// SOURCE: docs/design/V2-15-about-contact.md "Contact form" (same limits as the table checks in PR 2).
export const NAME_MAX = 80
export const EMAIL_MAX = 254
export const MESSAGE_MAX = 2000

export type ContactFields = { name: string; email: string; message: string }
export type ContactInput = ContactFields & { captchaToken: string }
export type ContactErrors = Partial<Record<keyof ContactFields, string>>

/** Outcome of one send. `invalid` = 400, `captcha` = 403, `error` = 500, any other status or no network. */
export type ContactResult = 'sent' | 'invalid' | 'captcha' | 'rate_limited' | 'error'

function env(name: string): string {
  return ((import.meta.env[name] as string | undefined) ?? '').trim()
}

/**
 * The form is live only when VITE_CONTACT_ENABLED is on AND a Turnstile site key is set.
 * Read on each call so tests can stub the env. "0" and "false" count as off.
 */
export function contactEnabled(): boolean {
  const flag = env('VITE_CONTACT_ENABLED').toLowerCase()
  const on = flag !== '' && flag !== '0' && flag !== 'false'
  return on && turnstileSiteKey() !== ''
}

/** Code points, as the server and the DB count them (an emoji is one, not two UTF-16 units). */
export function codePoints(s: string): number {
  return Array.from(s).length
}

// C0 and C1 control characters, and DEL. Matching them is the point of these patterns.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/
// The same set minus newline (\n) and tab (\t), which a message may contain.
// eslint-disable-next-line no-control-regex
const CONTROL_IN_MESSAGE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/

/** Optional name. Null when fine. */
export function validateName(raw: string): string | null {
  const v = raw.trim()
  if (v === '') return null
  if (CONTROL.test(v)) return 'Use letters, numbers and punctuation only.'
  if (codePoints(v) > NAME_MAX) return `Keep the name to ${NAME_MAX} characters.`
  return null
}

/** Same rules as normalizeEmail in supabase/functions/admin-people/logic.ts. Null when fine. */
export function validateEmail(raw: string): string | null {
  const v = raw.trim()
  if (v === '') return 'Enter your email, so I can answer.'
  if (v.length > EMAIL_MAX) return `Keep the email to ${EMAIL_MAX} characters.`
  // Printable ASCII only (! to ~): rules out whitespace, control characters and homograph addresses.
  if (/[^!-~]/.test(v)) return 'Check the email address.'
  const parts = v.split('@')
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return 'Check the email address.'
  return null
}

/** Required message, 1 to MESSAGE_MAX code points. Null when fine. */
export function validateMessage(raw: string): string | null {
  if (raw.trim() === '') return 'Write a message first.'
  if (CONTROL_IN_MESSAGE.test(raw)) return 'The message contains characters that cannot be sent.'
  if (codePoints(raw) > MESSAGE_MAX) return `Keep the message to ${MESSAGE_MAX} characters.`
  return null
}

export function validateContact(f: ContactFields): ContactErrors {
  const errors: ContactErrors = {}
  const name = validateName(f.name)
  const email = validateEmail(f.email)
  const message = validateMessage(f.message)
  if (name) errors.name = name
  if (email) errors.email = email
  if (message) errors.message = message
  return errors
}

/** Full URL of the Edge Function, or null when Supabase is not configured. */
export function contactEndpoint(): string | null {
  const url = env('VITE_SUPABASE_URL').replace(/\/+$/, '')
  if (!url || !env('VITE_SUPABASE_ANON_KEY')) return null
  return `${url}/functions/v1/contact-message`
}

/** One POST to contact-message. Never throws and never logs. */
export async function sendContact(input: ContactInput): Promise<ContactResult> {
  const endpoint = contactEndpoint()
  if (!endpoint) return 'error'
  const anonKey = env('VITE_SUPABASE_ANON_KEY')
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      // The same two headers supabase-js sends with the anon key; the function itself runs with verify_jwt = false.
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({
        name: input.name.trim(),
        email: input.email.trim(),
        message: input.message,
        captchaToken: input.captchaToken,
      }),
    })
    // SOURCE: docs/design/V2-15-about-contact.md "Responses" (200, 400, 403, 429, 500).
    switch (res.status) {
      case 200:
        return 'sent'
      case 400:
        return 'invalid'
      case 403:
        return 'captcha'
      case 429:
        return 'rate_limited'
      default:
        return 'error'
    }
  } catch {
    return 'error'
  }
}
