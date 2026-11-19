// Dev-only fixture for the admin page (story V2-05), loaded only behind DEMO_ADMIN (?demo=admin).
// The import sits in a branch that is the constant false in a production build, so this module and
// its invented addresses never reach dist (checked by grepping the build for "example.com").
// SOURCE: mockups/V2-05/data.js. Figure ids are real catalog entries; every email is invented.
import { readPeopleResult, type PeopleResult } from './adminLogic'

type PersonRow = {
  email: string
  user_id: string
  display_name: string | null
  signed_up_at: string
  is_admin: boolean
  last_mark_at: string | null
}

type WantedRowRaw = {
  user_id: string
  label: string
  kind: 'figure' | 'series'
  target_id: string
  marked_at: string
  alert: 'sent' | 'unsent' | 'none'
  truncated: boolean
}

// The mockup's clock. Every stamp is shifted so "2 h ago" in the mockup reads "2 h ago" today.
const MOCK_NOW = Date.parse('2026-11-06T18:30:00Z')
const shift = (iso: string) => new Date(Date.now() - (MOCK_NOW - Date.parse(`${iso}:00Z`))).toISOString()

let people: PersonRow[] = [
  ['owner@example.com', 'Owner', '2026-11-02T09:00', '2026-11-02T09:04', true, '2026-11-06T18:12'],
  ['collector1@example.com', 'Maya', '2026-11-02T09:10', '2026-11-02T20:41', false, '2026-11-06T17:55'],
  ['collector2@example.com', 'Tom', '2026-11-03T11:30', '2026-11-03T12:02', false, '2026-11-06T08:20'],
  ['minifig.collector.longname@example.com', '', '2026-11-03T11:31', '2026-11-04T07:15', false, '2026-11-05T22:47'],
  ['collector3@example.com', 'Noa', '2026-11-04T16:00', '2026-11-05T19:26', false, '2026-11-06T16:03'],
  ['collector4@example.com', '', '2026-11-05T10:12', null, false, null],
  ['collector5@example.com', '', '2026-11-06T14:48', null, false, null],
].map(([email, name, , signed, admin, last], i) => ({
  email: email as string,
  user_id: `u${i}`,
  display_name: (name as string) || null,
  signed_up_at: shift(signed ? (signed as string) : '2026-11-06T14:48'),
  is_admin: admin as boolean,
  last_mark_at: last ? shift(last as string) : null,
}))

const uid = (email: string) => people.find((p) => p.email === email)?.user_id ?? 'u?'
const labelOf = (email: string) => people.find((p) => p.email === email)?.display_name || email

let wanted: WantedRowRaw[] = (
  [
    ['collector1@example.com', 'figure', '71048-8', '2026-11-06T17:55', 'unsent'],
    ['collector3@example.com', 'figure', '71047-7', '2026-11-06T16:03', 'sent'],
    ['collector1@example.com', 'figure', '71047-7', '2026-11-06T15:40', 'sent'],
    ['collector3@example.com', 'series', '71046', '2026-11-06T15:12', 'sent'],
    ['collector2@example.com', 'figure', '71039-2', '2026-11-06T08:20', 'sent'],
    ['collector2@example.com', 'figure', '71048-10', '2026-11-06T08:18', 'sent'],
    ['minifig.collector.longname@example.com', 'figure', '71045-3', '2026-11-05T22:47', 'none'],
    ['collector1@example.com', 'figure', '71045-3', '2026-11-05T21:02', 'sent'],
    ['collector3@example.com', 'figure', '71038-6', '2026-11-05T19:40', 'sent'],
    ['collector1@example.com', 'figure', '71046-11', '2026-11-05T18:15', 'sent'],
    ['collector2@example.com', 'figure', '71047-7', '2026-11-04T13:30', 'sent'],
    ['minifig.collector.longname@example.com', 'figure', '71037-6', '2026-11-04T07:30', 'sent'],
    ['collector2@example.com', 'figure', '71034-1', '2026-11-03T12:10', 'sent'],
    ['collector1@example.com', 'series', '71047', '2026-11-03T09:00', 'sent'],
  ] as const
).map(([email, kind, id, at, alert]) => ({
  user_id: uid(email),
  label: labelOf(email),
  kind,
  target_id: id,
  marked_at: shift(at),
  alert,
  // ?demo=admin&truncated shows the over-the-limit notice.
  truncated: new URLSearchParams(window.location.search).has('truncated'),
}))

// Long enough to see the busy states.
const DELAY_MS = 700
const wait = () => new Promise((r) => window.setTimeout(r, DELAY_MS))

export async function demoLists(): Promise<{ people: unknown; wanted: unknown }> {
  await wait()
  if (new URLSearchParams(window.location.search).has('fail')) throw new Error('demo: lists refused')
  const empty = new URLSearchParams(window.location.search).has('empty')
  return { people: structuredClone(people), wanted: empty ? [] : structuredClone(wanted) }
}

/** Same answers as the admin-people Edge Function. fail@example.com always fails, to show the error. */
export async function demoPeople(email: string): Promise<PeopleResult> {
  await wait()
  if (email === 'fail@example.com') return readPeopleResult({ error: 'internal' })
  const target = people.find((p) => p.email === email)
  if (target?.is_admin) return readPeopleResult({ error: 'is_admin' })
  people = people.filter((p) => p.email !== email)
  if (target) wanted = wanted.filter((w) => w.user_id !== target.user_id)
  return readPeopleResult({ ok: true })
}

// ---------------------------------------------------------------------------------------------
// Messages (story V2-15). Rows in the admin_contact_list shape.
// SOURCE: mockups/V2-15-messages/msgs.js (branch feature/V2-15-msgs). Every name, address and text is invented.
// ?demo=admin&messages opens the Messages view, &open=<id> opens one message, &msgfail fails the list,
// &msgempty serves an empty inbox.

type ContactRowRaw = {
  id: number
  created_at: string
  name: string | null
  email: string
  message: string
  read_at: string | null
}

// The mockup's clock, local time. Stamps are shifted so "18 min ago" in the mockup reads the same today.
const MSG_NOW = Date.parse('2026-11-16T14:00:00')
const shiftLocal = (local: string) => new Date(Date.now() - (MSG_NOW - Date.parse(`${local}:00`))).toISOString()

let messages: ContactRowRaw[] = (
  [
    [8, '2026-11-16T13:42', 'Lena Hartmann', 'lena.hartmann@example.de', true,
      'Hi! The Series 27 page shows the Bogeyman twice when I sort by "Newest". Refreshing fixes it for a moment, then it comes back. Firefox 132 on Windows.'],
    [7, '2026-11-16T09:15', '', 'brickfan_1987@example.com', false,
      'Could you add the Dungeons & Dragons promo figure (the Szass Tam polybag)? It is not a CMF but everyone I know collects it with the series.'],
    [6, '2026-11-15T21:03', 'Tomas Okafor', 'tomas.okafor@example.org', false,
      'Long-time collector here, and I have to say this site is the first one that made me actually finish a series instead of giving up halfway.\n\nA bit of background: I started with Series 1 back in 2010, bought blind bags at the corner shop and felt every one of them for the shape of the accessories. By Series 10 I had a spreadsheet with 400 rows, three colours of highlighting and a tab nobody but me understood. When the boxes went cardboard in 2021 the feel-the-bag trick died and I mostly stopped.\n\nA friend sent me the link last month. The wanted list is exactly what I needed: I marked the 14 figures I am missing across Series 21 to 25, and on Saturday at the Brick Fair in Leeds I found 9 of them in one afternoon because I could just show my phone to the traders.\n\nTwo small wishes, only if they are easy:\n1. A way to note duplicates I have for swaps.\n2. A printable checklist per series, for fairs where the signal is bad.\n\nEither way, thank you for building this. It brought the fun back.'],
    [5, '2026-11-14T17:48', 'Aiko Tanaka', 'aiko.t@example.jp', true,
      'Small correction: in the Disney 100 series the figure listed as "Mrs. Incredible" is officially "Elastigirl" on the LEGO box (71038-14).'],
    [4, '2026-11-12T08:30', 'Marco Bellini', 'marco.bellini@example.it', true,
      'Is there a way to get an invite? My daughter and I collect together and would love to share one wanted list.'],
    [3, '2026-11-09T19:22', 'Sophie Laurent', 's.laurent@example.fr', true,
      'The new card art is beautiful. The round series frame with the head count is a really nice touch.'],
    [2, '2026-11-04T12:05', 'Jon Price', 'jprice@example.co.uk', true,
      'Telegram alert arrived twice for the same Nutcracker mark yesterday evening. Not a big deal, just letting you know.'],
    [1, '2026-10-28T15:40', 'Dana Weiss', 'dana.weiss@example.com', true,
      'Thank you! Found the last Series 24 figure thanks to your list.'],
  ] as const
).map(([id, at, name, email, read, message]) => ({
  id,
  created_at: shiftLocal(at),
  name: name || null,
  email,
  message,
  read_at: read ? shiftLocal(at) : null,
}))

export async function demoMessages(): Promise<unknown> {
  await wait()
  const q = new URLSearchParams(window.location.search)
  if (q.has('msgfail')) throw new Error('demo: messages refused')
  return q.has('msgempty') ? [] : structuredClone(messages)
}

/** Same effect as rpc admin_contact_mark_read: the first read time is kept. */
export async function demoMarkRead(id: number): Promise<boolean> {
  await wait()
  const now = new Date().toISOString()
  messages = messages.map((m) => (m.id === id ? { ...m, read_at: m.read_at ?? now } : m))
  return true
}

/** Same effect as rpc admin_contact_delete. */
export async function demoDeleteMessage(id: number): Promise<boolean> {
  await wait()
  messages = messages.filter((m) => m.id !== id)
  return true
}
