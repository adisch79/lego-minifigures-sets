// Pure logic for story V2-05, the admin page (docs/design/V2-05-admin.md, direction C "Wanted wall").
// Row guards for the two admin RPCs, grouping wanted marks into ranked cards, the three wall views,
// relative times, email checks and the Edge Function answers. No React and no network in here.
import type { Series } from './catalog'
import { tileArt } from './home'
import type { MarkKind } from './marks'

export type AlertState = 'sent' | 'unsent' | 'none'

/** One row of rpc admin_allowlist_list. */
export interface Person {
  email: string
  addedAt: string
  userId: string | null
  displayName: string | null
  signedInAt: string | null
  isAdmin: boolean
  lastMarkAt: string | null
}

/** One row of rpc admin_wanted_list. */
export interface WantedRow {
  userId: string
  label: string
  kind: MarkKind
  targetId: string
  markedAt: string
  alert: AlertState
  truncated: boolean
}

export interface Collector {
  userId: string
  label: string
  markedAt: string
  alert: AlertState
}

export interface WantedCard {
  key: string
  kind: MarkKind
  targetId: string
  /** Figure name, or the series name without the trailing "Minifigures". */
  name: string
  /** Series the figure belongs to; for a whole-series mark a fixed line. */
  sub: string
  art: string | null
  /** cover: composed series card, cut: figure photo, render: opaque set render, photo: bag. */
  artKind: 'cover' | 'cut' | 'render' | 'photo' | null
  known: boolean
  /** Newest first. */
  collectors: Collector[]
  latest: string
  worst: AlertState
  sent: number
  /** 1-based position in the Most wanted order. */
  rank: number
}

export type WallView = 'popular' | 'newest' | 'unsent'

export const WALL_VIEWS: { value: WallView; label: string; hint: string }[] = [
  { value: 'popular', label: 'Most wanted', hint: 'Ranked by collectors, then newest' },
  { value: 'newest', label: 'Newest', hint: 'Latest mark first' },
  { value: 'unsent', label: 'Not sent', hint: 'Alert pending, failed or over the hourly cap' },
]

export const ALERT_TEXT: Record<AlertState, string> = {
  sent: 'Sent',
  unsent: 'Pending',
  none: 'Not sent',
}

// Worst state wins on a card: a dropped alert outranks a pending one, which outranks sent.
const ALERT_WEIGHT: Record<AlertState, number> = { sent: 0, unsent: 1, none: 2 }

// ---------------------------------------------------------------------------------------------
// Row guards. The RPCs are ours, but a migration that drifts from this contract must fail loudly.

function fail(path: string, msg: string): never {
  throw new Error(`admin: ${path}: ${msg}`)
}

function rec(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected object')
  return v as Record<string, unknown>
}

function text(o: Record<string, unknown>, k: string, path: string): string {
  const v = o[k]
  if (typeof v !== 'string') fail(`${path}.${k}`, 'expected string')
  return v
}

function maybeText(o: Record<string, unknown>, k: string, path: string): string | null {
  const v = o[k]
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') fail(`${path}.${k}`, 'expected string or null')
  return v
}

function flag(o: Record<string, unknown>, k: string, path: string): boolean {
  const v = o[k]
  if (typeof v !== 'boolean') fail(`${path}.${k}`, 'expected boolean')
  return v
}

function rows(data: unknown, name: string): unknown[] {
  if (data === null || data === undefined) return []
  if (!Array.isArray(data)) fail(name, 'expected array')
  return data
}

export function parsePeople(data: unknown): Person[] {
  return rows(data, 'admin_allowlist_list').map((v, i) => {
    const path = `admin_allowlist_list[${i}]`
    const o = rec(v, path)
    return {
      email: text(o, 'email', path),
      addedAt: text(o, 'added_at', path),
      userId: maybeText(o, 'user_id', path),
      displayName: maybeText(o, 'display_name', path),
      signedInAt: maybeText(o, 'signed_in_at', path),
      isAdmin: o.is_admin === null || o.is_admin === undefined ? false : flag(o, 'is_admin', path),
      lastMarkAt: maybeText(o, 'last_mark_at', path),
    }
  })
}

export function parseWanted(data: unknown): WantedRow[] {
  return rows(data, 'admin_wanted_list').map((v, i) => {
    const path = `admin_wanted_list[${i}]`
    const o = rec(v, path)
    const kind = text(o, 'kind', path)
    if (kind !== 'figure' && kind !== 'series') fail(`${path}.kind`, `bad kind ${kind}`)
    const alert = text(o, 'alert', path)
    if (alert !== 'sent' && alert !== 'unsent' && alert !== 'none') fail(`${path}.alert`, `bad alert ${alert}`)
    return {
      userId: text(o, 'user_id', path),
      label: text(o, 'label', path),
      kind,
      targetId: text(o, 'target_id', path),
      markedAt: text(o, 'marked_at', path),
      alert,
      truncated: flag(o, 'truncated', path),
    }
  })
}

// ---------------------------------------------------------------------------------------------
// Labels

/** A name to show: the display name, else the part of the email before the @. */
export function shortLabel(label: string): string {
  const t = label.trim()
  const at = t.indexOf('@')
  return at > 0 ? t.slice(0, at) : t
}

export function personLabel(p: Person): string {
  const name = p.displayName?.trim()
  return name ? name : shortLabel(p.email)
}

export function initialOf(label: string): string {
  return (shortLabel(label).charAt(0) || '?').toUpperCase()
}

/** "Maya", "Maya & Tom", or "Noa, Maya +1". */
export function namesLine(labels: string[]): string {
  const l = labels.map(shortLabel)
  return l.length <= 2 ? l.join(' & ') : `${l.slice(0, 2).join(', ')} +${l.length - 2}`
}

export function seriesShortName(name: string): string {
  return name.replace(/\s+Minifigures$/i, '')
}

// ---------------------------------------------------------------------------------------------
// The wall

type Lookup = {
  figures: Map<string, { name: string; img: string | null; render: boolean; series: Series }>
  series: Map<string, Series>
}

export function catalogLookup(series: readonly Series[]): Lookup {
  const figures: Lookup['figures'] = new Map()
  const byId: Lookup['series'] = new Map()
  for (const s of series) {
    byId.set(s.id, s)
    for (const f of s.figures) figures.set(f.id, { name: f.name, img: f.img, render: f.imgFallback, series: s })
  }
  return { figures, series: byId }
}

function describeTarget(kind: MarkKind, targetId: string, lookup: Lookup) {
  if (kind === 'series') {
    const s = lookup.series.get(targetId)
    if (!s) return { name: `Series ${targetId}`, sub: 'Not in the catalog', art: null, artKind: null, known: false } as const
    const art = tileArt(s)
    return {
      name: seriesShortName(s.name),
      sub: 'All figures in the series',
      art: art?.src ?? null,
      artKind: art ? (art.kind === 'card' ? 'cover' : 'photo') : null,
      known: true,
    } as const
  }
  const f = lookup.figures.get(targetId)
  if (!f) return { name: `Figure ${targetId}`, sub: 'Not in the catalog', art: null, artKind: null, known: false } as const
  return {
    name: f.name,
    sub: seriesShortName(f.series.name),
    art: f.img,
    artKind: f.img ? (f.render ? 'render' : 'cut') : null,
    known: true,
  } as const
}

function byPopularity(a: WantedCard, b: WantedCard): number {
  return (
    b.collectors.length - a.collectors.length ||
    Date.parse(b.latest) - Date.parse(a.latest) ||
    a.key.localeCompare(b.key)
  )
}

function byLatest(a: WantedCard, b: WantedCard): number {
  return Date.parse(b.latest) - Date.parse(a.latest) || a.key.localeCompare(b.key)
}

/**
 * Groups wanted marks by target (one card per figure or whole series) and ranks the cards by
 * number of collectors, then by the newest mark. A collector who appears twice for one target
 * (it cannot happen with the marks primary key, but rows are data) is counted once.
 */
export function buildWall(wanted: readonly WantedRow[], series: readonly Series[]): WantedCard[] {
  const lookup = catalogLookup(series)
  const cards = new Map<string, WantedCard>()
  for (const w of wanted) {
    const key = `${w.kind}:${w.targetId}`
    let card = cards.get(key)
    if (!card) {
      card = {
        key,
        kind: w.kind,
        targetId: w.targetId,
        ...describeTarget(w.kind, w.targetId, lookup),
        collectors: [],
        latest: w.markedAt,
        worst: 'sent',
        sent: 0,
        rank: 0,
      }
      cards.set(key, card)
    }
    if (card.collectors.some((c) => c.userId === w.userId)) continue
    card.collectors.push({ userId: w.userId, label: w.label, markedAt: w.markedAt, alert: w.alert })
    if (Date.parse(w.markedAt) > Date.parse(card.latest)) card.latest = w.markedAt
    if (ALERT_WEIGHT[w.alert] > ALERT_WEIGHT[card.worst]) card.worst = w.alert
    if (w.alert === 'sent') card.sent++
  }
  const ranked = [...cards.values()].sort(byPopularity)
  ranked.forEach((c, i) => {
    c.rank = i + 1
    c.collectors.sort((a, b) => Date.parse(b.markedAt) - Date.parse(a.markedAt))
  })
  return ranked
}

/** Cards for one view. Not sent keeps the Most wanted order. */
export function viewCards(cards: readonly WantedCard[], view: WallView): WantedCard[] {
  if (view === 'newest') return [...cards].sort(byLatest)
  if (view === 'unsent') return cards.filter((c) => c.worst !== 'sent')
  return [...cards]
}

export function viewCounts(cards: readonly WantedCard[]): Record<WallView, number> {
  return {
    popular: cards.length,
    newest: cards.length,
    unsent: cards.filter((c) => c.worst !== 'sent').length,
  }
}

export function isTruncated(wanted: readonly WantedRow[]): boolean {
  return wanted.some((w) => w.truncated)
}

/** Wanted marks per collector, for the allowlist rows. */
export function wantedPerUser(wanted: readonly WantedRow[]): Map<string, number> {
  const n = new Map<string, number>()
  for (const w of wanted) n.set(w.userId, (n.get(w.userId) ?? 0) + 1)
  return n
}

/** Allowlist in the order people were invited; the oldest invite (the owner) first. */
export function sortPeople(people: readonly Person[]): Person[] {
  return [...people].sort(
    (a, b) => Date.parse(a.addedAt) - Date.parse(b.addedAt) || a.email.localeCompare(b.email),
  )
}

export const AVATAR_TONES = ['', 'ink', 'y'] as const

/** Stable avatar colour per collector: their place on the allowlist, three tones round. */
export function toneMap(people: readonly Person[]): Map<string, string> {
  const tones = new Map<string, string>()
  sortPeople(people).forEach((p, i) => {
    if (p.userId) tones.set(p.userId, AVATAR_TONES[i % AVATAR_TONES.length])
  })
  return tones
}

// ---------------------------------------------------------------------------------------------
// Time

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago". */
export function ago(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const m = Math.round((now - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

/** Second line of an allowlist row. */
export function personStatus(p: Person, now: number = Date.now()): string {
  if (!p.signedInAt) return `Invited ${ago(p.addedAt, now)}, not signed in`
  if (p.lastMarkAt) return `Last mark ${ago(p.lastMarkAt, now)}`
  return `Signed in ${ago(p.signedInAt, now)}`
}

// ---------------------------------------------------------------------------------------------
// Inviting and removing

// SOURCE: docs/design/V2-05-admin.md "Writes": trim, lower-case, max 254 chars, one @, no whitespace
// or control chars. The client applies the same rule so a typo never costs a round trip.
const MAX_EMAIL = 254

/** Cleaned email, or null when the server would refuse it as bad_email. */
export function normaliseEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  if (!e || e.length > MAX_EMAIL) return null
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(e)) return null
  const parts = e.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  if (!/^[^.]+(\.[^.]+)+$/.test(parts[1])) return null
  return e
}

export type PeopleError =
  | 'unauthorized'
  | 'not_admin'
  | 'bad_request'
  | 'bad_email'
  | 'is_admin'
  | 'internal'
  | 'network'
  | 'duplicate'

export type PeopleResult = { ok: true } | { ok: false; error: PeopleError }

const SERVER_CODES: PeopleError[] = ['unauthorized', 'not_admin', 'bad_request', 'bad_email', 'is_admin', 'internal']

/** Reads the admin-people answer. Anything that is not the contract counts as a network failure. */
export function readPeopleResult(body: unknown): PeopleResult {
  if (typeof body === 'object' && body !== null) {
    const o = body as Record<string, unknown>
    if (o.ok === true) return { ok: true }
    if (typeof o.error === 'string' && (SERVER_CODES as string[]).includes(o.error)) {
      return { ok: false, error: o.error as PeopleError }
    }
  }
  return { ok: false, error: 'network' }
}

export const PEOPLE_ERROR_TEXT: Record<PeopleError, string> = {
  unauthorized: 'Your session has ended. Sign in again, then retry.',
  not_admin: 'This account is no longer an admin.',
  bad_request: 'The server refused the request. Reload the page and try again.',
  bad_email: 'That does not look like an email address.',
  is_admin: 'Admins cannot be removed from this page.',
  internal: 'The server could not finish. Nothing was changed; try again.',
  network: 'Could not reach the server. Check your connection and try again.',
  duplicate: 'That address is already on the allowlist.',
}
