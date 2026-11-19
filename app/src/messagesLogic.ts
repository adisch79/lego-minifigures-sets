// Pure logic for the admin "Messages" view (story V2-15, docs/design/V2-15-about-contact.md "Admin page",
// approved direction A, mockups/V2-15-messages/a.html). Row guard for rpc admin_contact_list, display
// cleaning, the mailto link, short times and list helpers. No React and no network in here.
import { ago } from './adminLogic'

/** One row of rpc admin_contact_list. ip_hash is never returned by the server. */
export interface ContactMessage {
  id: number
  createdAt: string
  /** Null when the sender left the name empty. */
  name: string | null
  email: string
  message: string
  readAt: string | null
}

export type MessageFilter = 'all' | 'unread'

// SOURCE: supabase/migrations/20261117000000_v2_15_contact_messages.sql, admin_contact_list "limit 200".
export const MESSAGES_LIMIT = 200

// Only these fixed texts reach the UI, never a raw PostgREST message.
export const MESSAGES_NOT_ALLOWED = 'Not allowed'
export const MESSAGES_LOAD_FAILED = 'Could not load'

export const ACTION_ERROR_TEXT = {
  read: 'Could not mark it read. Check your connection and try again.',
  delete: 'Could not delete it. Check your connection and try again.',
} as const

// ---------------------------------------------------------------------------------------------
// Row guard

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/**
 * Parses the admin_contact_list answer. Rows missing an id, email, message or date are dropped
 * rather than failing the whole list; a non-array answer throws. bigint ids may arrive as strings.
 */
export function parseMessages(data: unknown): ContactMessage[] {
  if (data === null || data === undefined) return []
  if (!Array.isArray(data)) throw new Error('admin_contact_list: expected array')
  const out: ContactMessage[] = []
  for (const v of data) {
    if (out.length >= MESSAGES_LIMIT) break
    if (typeof v !== 'object' || v === null) continue
    const o = v as Record<string, unknown>
    const id = typeof o.id === 'number' ? o.id : typeof o.id === 'string' && /^\d+$/.test(o.id) ? Number(o.id) : NaN
    const createdAt = str(o.created_at)
    const email = str(o.email)
    const message = str(o.message)
    if (!Number.isSafeInteger(id) || createdAt === null || email === null || message === null) continue
    const name = str(o.name)?.trim() || null
    out.push({ id, createdAt, name, email, message, readAt: str(o.read_at) })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Display

// SOURCE: docs/design/V2-15-about-contact.md "Admin page": bidi override characters U+202A-202E and
// U+2066-2069 are stripped on display, so a sender cannot reorder how the admin reads the text.
// Also LRM/RLM U+200E/200F and ALM U+061C (code review 2026-11-17). Escapes only, never raw characters.
const BIDI = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/g

/** Text as shown to the admin: bidi embedding, override and isolate characters removed. */
export function cleanText(s: string): string {
  return s.replace(BIDI, '')
}

/** The name, else the email: what the list row and the confirm call the sender. */
export function senderLabel(m: ContactMessage): string {
  return cleanText(m.name ?? m.email)
}

// SOURCE: mockups/V2-15-messages/msgs.js mailto(): fixed reply subject.
const REPLY_SUBJECT = 'Re: your message to Minifig Hunt'

/** Reply link. Both parts go through encodeURIComponent, so an address cannot add headers. */
export function mailtoHref(email: string): string {
  return `mailto:${encodeURIComponent(cleanText(email))}?subject=${encodeURIComponent(REPLY_SUBJECT)}`
}

/** Three avatar tones picked from the email, so one sender keeps one colour (mockup msgs.js tone()). */
export function toneOf(email: string): '' | 't-ink' | 't-y' {
  let h = 0
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0
  return (['', 't-ink', 't-y'] as const)[h % 3]
}

// ---------------------------------------------------------------------------------------------
// Time, in the admin's local time zone

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

function dateOf(iso: string): Date | null {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : new Date(t)
}

/** List row time: "09:15" for today, else "15 Nov". */
export function shortWhen(iso: string, now: number = Date.now()): string {
  const d = dateOf(iso)
  if (!d) return ''
  if (d.toDateString() === new Date(now).toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Reading pane stamp: "15 Nov 2026, 21:03". */
export function stamp(iso: string): string {
  const d = dateOf(iso)
  if (!d) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Hero figure "18 min", "5 h", "1 day", "4 days": the time since a message, without "ago". */
export function sinceLast(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const a = ago(iso, now)
  if (a === 'just now') return '1 min'
  if (a === 'yesterday') return '1 day'
  return a.replace(/ ago$/, '')
}

// ---------------------------------------------------------------------------------------------
// Lists

export function unreadCount(list: readonly ContactMessage[]): number {
  return list.filter((m) => m.readAt === null).length
}

/**
 * Rows for a filter. The open message stays in the Unread view after it is marked read, so the
 * row the admin is looking at does not jump away under the cursor.
 */
export function filterMessages(list: readonly ContactMessage[], filter: MessageFilter, keepId: number | null): ContactMessage[] {
  if (filter === 'all') return [...list]
  return list.filter((m) => m.readAt === null || m.id === keepId)
}

/** The message opened first: the newest unread one, else the newest. */
export function firstSelection(list: readonly ContactMessage[]): number | null {
  return (list.find((m) => m.readAt === null) ?? list[0])?.id ?? null
}

/** After deleting `id` from `list`: the row below it, else the row above, else nothing. */
export function nextAfterDelete(list: readonly ContactMessage[], id: number): number | null {
  const i = list.findIndex((m) => m.id === id)
  if (i < 0) return list[0]?.id ?? null
  return list[i + 1]?.id ?? list[i - 1]?.id ?? null
}
