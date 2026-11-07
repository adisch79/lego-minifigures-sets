// Dev-only fixture for the admin page (story V2-05), loaded only behind DEMO_ADMIN (?demo=admin).
// The import sits in a branch that is the constant false in a production build, so this module and
// its invented addresses never reach dist (checked by grepping the build for "example.com").
// SOURCE: mockups/V2-05/data.js. Figure ids are real catalog entries; every email is invented.
import { readPeopleResult, type PeopleResult } from './adminLogic'

type PersonRow = {
  email: string
  added_at: string
  user_id: string | null
  display_name: string | null
  signed_in_at: string | null
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
].map(([email, name, added, signed, admin, last], i) => ({
  email: email as string,
  added_at: shift(added as string),
  user_id: signed ? `u${i}` : null,
  display_name: signed ? (name as string) || null : null,
  signed_in_at: signed ? shift(signed as string) : null,
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
export async function demoPeople(action: 'add' | 'remove', email: string): Promise<PeopleResult> {
  await wait()
  if (email === 'fail@example.com') return readPeopleResult({ error: 'internal' })
  if (action === 'add') {
    if (!people.some((p) => p.email === email)) {
      people = [
        ...people,
        { email, added_at: new Date().toISOString(), user_id: null, display_name: null, signed_in_at: null, is_admin: false, last_mark_at: null },
      ]
    }
    return readPeopleResult({ ok: true })
  }
  const target = people.find((p) => p.email === email)
  if (target?.is_admin) return readPeopleResult({ error: 'is_admin' })
  people = people.filter((p) => p.email !== email)
  if (target?.user_id) wanted = wanted.filter((w) => w.user_id !== target.user_id)
  return readPeopleResult({ ok: true })
}
