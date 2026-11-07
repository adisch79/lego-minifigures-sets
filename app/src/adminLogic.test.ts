import { describe, expect, it } from 'vitest'
import {
  ago,
  buildWall,
  initialOf,
  isTruncated,
  namesLine,
  normaliseEmail,
  parsePeople,
  parseWanted,
  personLabel,
  personStatus,
  readPeopleResult,
  seriesShortName,
  shortLabel,
  sortPeople,
  toneMap,
  viewCards,
  viewCounts,
  wantedPerUser,
  type Person,
  type WantedRow,
} from './adminLogic'
import type { Series } from './catalog'

function series(id: string, name: string, figs: [string, string, string | null, boolean?][]): Series {
  return {
    id,
    name,
    line: 'Series',
    seriesNo: null,
    year: 2020,
    age: null,
    bricklinkCode: null,
    figureCount: figs.length,
    bag: `img/${id}/bag.webp`,
    card: null,
    figures: figs.map(([fid, fname, img, fallback], i) => ({
      id: fid,
      no: i + 1,
      name: fname,
      img,
      imgFallback: fallback ?? false,
    })),
  }
}

const catalog = [
  series('71999', 'Plain Bag Minifigures', [['71999-1', 'Bagged', 'img/z.webp']]),
  series('71001', 'Series 10 Minifigures', [
    ['71001-1', 'Mummy', 'img/a.webp'],
    ['71001-2', 'Zombie', 'img/b.webp', true],
    ['71001-3', 'Ghost', null],
  ]),
]

function w(
  user: string,
  kind: 'figure' | 'series',
  target: string,
  at: string,
  alert: 'sent' | 'unsent' | 'none' = 'sent',
  truncated = false,
): WantedRow {
  return { userId: user, label: `${user}@x.com`, kind, targetId: target, markedAt: at, alert, truncated }
}

describe('parsePeople', () => {
  it('maps snake_case rows and defaults a null is_admin to false', () => {
    const out = parsePeople([
      {
        email: 'a@x.com',
        added_at: '2026-01-01T00:00:00Z',
        user_id: 'u1',
        display_name: 'A',
        signed_in_at: '2026-01-02T00:00:00Z',
        is_admin: true,
        last_mark_at: null,
      },
      { email: 'b@x.com', added_at: '2026-01-03T00:00:00Z', is_admin: null },
    ])
    expect(out[0]).toMatchObject({ email: 'a@x.com', userId: 'u1', displayName: 'A', isAdmin: true, lastMarkAt: null })
    expect(out[1]).toMatchObject({ userId: null, displayName: null, signedInAt: null, isAdmin: false })
  })
  it('treats null and undefined as empty', () => {
    expect(parsePeople(null)).toEqual([])
    expect(parsePeople(undefined)).toEqual([])
  })
  it('rejects non-array, non-object rows and wrong field types', () => {
    expect(() => parsePeople({})).toThrow(/expected array/)
    expect(() => parsePeople([5])).toThrow(/admin_allowlist_list\[0\]: expected object/)
    expect(() => parsePeople([[]])).toThrow(/expected object/)
    expect(() => parsePeople([{ added_at: 'x' }])).toThrow(/email/)
    expect(() => parsePeople([{ email: 'a', added_at: 'x', is_admin: 'yes' }])).toThrow(/is_admin/)
    expect(() => parsePeople([{ email: 'a', added_at: 'x', user_id: 4 }])).toThrow(/user_id/)
  })
})

describe('parseWanted', () => {
  const ok = {
    user_id: 'u1',
    label: 'Maya',
    kind: 'figure',
    target_id: '71001-1',
    marked_at: '2026-01-01T00:00:00Z',
    alert: 'sent',
    truncated: false,
  }
  it('maps a valid row', () => {
    expect(parseWanted([ok])[0]).toEqual({
      userId: 'u1',
      label: 'Maya',
      kind: 'figure',
      targetId: '71001-1',
      markedAt: '2026-01-01T00:00:00Z',
      alert: 'sent',
      truncated: false,
    })
  })
  it('rejects bad kind, bad alert, missing boolean', () => {
    expect(() => parseWanted([{ ...ok, kind: 'set' }])).toThrow(/bad kind set/)
    expect(() => parseWanted([{ ...ok, alert: 'maybe' }])).toThrow(/bad alert maybe/)
    expect(() => parseWanted([{ ...ok, truncated: undefined }])).toThrow(/truncated/)
    expect(() => parseWanted('x')).toThrow(/expected array/)
  })
  it('returns [] for null', () => {
    expect(parseWanted(null)).toEqual([])
  })
})

describe('labels', () => {
  it('shortLabel cuts at @ but keeps names and a leading @', () => {
    expect(shortLabel(' maya@x.com ')).toBe('maya')
    expect(shortLabel('Maya')).toBe('Maya')
    expect(shortLabel('@odd')).toBe('@odd')
  })
  it('personLabel prefers a non-blank display name', () => {
    const p = { email: 'tom@x.com', displayName: '  ' } as Person
    expect(personLabel(p)).toBe('tom')
    expect(personLabel({ ...p, displayName: ' Tom T ' })).toBe('Tom T')
  })
  it('initialOf upper-cases and falls back to ?', () => {
    expect(initialOf('maya@x.com')).toBe('M')
    expect(initialOf('')).toBe('?')
  })
  it('namesLine joins one, two and many', () => {
    expect(namesLine([])).toBe('')
    expect(namesLine(['a@x.com'])).toBe('a')
    expect(namesLine(['Maya', 'Tom'])).toBe('Maya & Tom')
    expect(namesLine(['Noa', 'Maya', 'Tom', 'Eve'])).toBe('Noa, Maya +2')
  })
  it('seriesShortName drops a trailing Minifigures only', () => {
    expect(seriesShortName('Series 10 Minifigures')).toBe('Series 10')
    expect(seriesShortName('Minifigures Fan')).toBe('Minifigures Fan')
  })
})

describe('buildWall', () => {
  it('returns no cards for no rows', () => {
    expect(buildWall([], catalog)).toEqual([])
  })
  it('groups by target, ranks by collectors then newest', () => {
    const cards = buildWall(
      [
        w('u1', 'figure', '71001-1', '2026-01-01T10:00:00Z'),
        w('u2', 'figure', '71001-2', '2026-01-03T10:00:00Z'),
        w('u2', 'figure', '71001-1', '2026-01-02T10:00:00Z'),
        w('u1', 'series', '71001', '2026-01-04T10:00:00Z'),
      ],
      catalog,
    )
    expect(cards.map((c) => c.key)).toEqual(['figure:71001-1', 'series:71001', 'figure:71001-2'])
    expect(cards.map((c) => c.rank)).toEqual([1, 2, 3])
    expect(cards[0].collectors.map((c) => c.userId)).toEqual(['u2', 'u1'])
    expect(cards[0].latest).toBe('2026-01-02T10:00:00Z')
  })
  it('describes figures: cut, render, and no image', () => {
    const [a, b, c] = ['71001-1', '71001-2', '71001-3'].map(
      (id) => buildWall([w('u1', 'figure', id, '2026-01-01T00:00:00Z')], catalog)[0],
    )
    expect(a).toMatchObject({ name: 'Mummy', sub: 'Series 10', artKind: 'cut', known: true })
    expect(b.artKind).toBe('render')
    expect(c).toMatchObject({ art: null, artKind: null })
  })
  it('describes a series mark with a composed card', () => {
    const [c] = buildWall([w('u1', 'series', '71001', '2026-01-01T00:00:00Z')], catalog)
    expect(c).toMatchObject({
      name: 'Series 10',
      sub: 'All figures in the series',
      art: 'cards/71001.png',
      artKind: 'cover',
      known: true,
    })
  })
  it('describes a series mark with bag art', () => {
    const [c] = buildWall([w('u1', 'series', '71999', '2026-01-01T00:00:00Z')], catalog)
    expect(c).toMatchObject({ name: 'Plain Bag', art: 'img/71999/bag.webp', artKind: 'photo' })
  })
  it('keeps unknown targets as unknown cards', () => {
    const cards = buildWall(
      [w('u1', 'figure', '9-9', '2026-01-01T00:00:00Z'), w('u1', 'series', '9999', '2026-01-01T00:00:00Z')],
      catalog,
    )
    expect(cards.every((c) => !c.known && c.art === null)).toBe(true)
    expect(cards.map((c) => c.name).sort()).toEqual(['Figure 9-9', 'Series 9999'])
  })
  it('counts a duplicate collector once', () => {
    const [c] = buildWall(
      [
        w('u1', 'figure', '71001-1', '2026-01-01T00:00:00Z'),
        w('u1', 'figure', '71001-1', '2026-01-02T00:00:00Z', 'none'),
      ],
      catalog,
    )
    expect(c.collectors).toHaveLength(1)
    expect(c.worst).toBe('sent')
  })
  it('worst alert wins and sent is counted', () => {
    const [c] = buildWall(
      [
        w('u1', 'figure', '71001-1', '2026-01-01T00:00:00Z', 'sent'),
        w('u2', 'figure', '71001-1', '2026-01-01T00:00:00Z', 'unsent'),
        w('u3', 'figure', '71001-1', '2026-01-01T00:00:00Z', 'none'),
        w('u4', 'figure', '71001-1', '2026-01-01T00:00:00Z', 'unsent'),
      ],
      catalog,
    )
    expect(c.worst).toBe('none')
    expect(c.sent).toBe(1)
  })
  it('breaks full ties by key', () => {
    const cards = buildWall(
      [w('u1', 'figure', '71001-2', '2026-01-01T00:00:00Z'), w('u1', 'figure', '71001-1', '2026-01-01T00:00:00Z')],
      catalog,
    )
    expect(cards.map((c) => c.targetId)).toEqual(['71001-1', '71001-2'])
  })
})

describe('views', () => {
  const cards = buildWall(
    [
      w('u1', 'figure', '71001-1', '2026-01-01T00:00:00Z'),
      w('u2', 'figure', '71001-1', '2026-01-01T01:00:00Z'),
      w('u1', 'figure', '71001-2', '2026-01-05T00:00:00Z', 'unsent'),
      w('u1', 'figure', '71001-3', '2026-01-03T00:00:00Z'),
    ],
    catalog,
  )
  it('popular keeps wall order and copies the array', () => {
    const v = viewCards(cards, 'popular')
    expect(v.map((c) => c.targetId)).toEqual(cards.map((c) => c.targetId))
    expect(v).not.toBe(cards)
  })
  it('newest sorts by latest mark', () => {
    expect(viewCards(cards, 'newest').map((c) => c.targetId)).toEqual(['71001-2', '71001-3', '71001-1'])
  })
  it('unsent keeps only cards whose worst alert is not sent', () => {
    expect(viewCards(cards, 'unsent').map((c) => c.targetId)).toEqual(['71001-2'])
  })
  it('viewCounts', () => {
    expect(viewCounts(cards)).toEqual({ popular: 3, newest: 3, unsent: 1 })
    expect(viewCounts([])).toEqual({ popular: 0, newest: 0, unsent: 0 })
  })
})

describe('wanted helpers', () => {
  it('isTruncated is true if any row says so', () => {
    expect(isTruncated([])).toBe(false)
    expect(
      isTruncated([
        w('u1', 'figure', 'a', '2026-01-01T00:00:00Z'),
        w('u1', 'figure', 'b', '2026-01-01T00:00:00Z', 'sent', true),
      ]),
    ).toBe(true)
  })
  it('wantedPerUser counts rows', () => {
    const m = wantedPerUser([w('u1', 'figure', 'a', 'x'), w('u1', 'figure', 'b', 'x'), w('u2', 'figure', 'a', 'x')])
    expect(m.get('u1')).toBe(2)
    expect(m.get('u2')).toBe(1)
    expect(m.get('u3')).toBeUndefined()
  })
})

describe('people ordering and tones', () => {
  const mk = (email: string, addedAt: string, userId: string | null): Person => ({
    email,
    addedAt,
    userId,
    displayName: null,
    signedInAt: userId ? addedAt : null,
    isAdmin: false,
    lastMarkAt: null,
  })
  const people = [
    mk('c@x.com', '2026-01-03T00:00:00Z', 'u3'),
    mk('a@x.com', '2026-01-01T00:00:00Z', 'u1'),
    mk('b@x.com', '2026-01-01T00:00:00Z', null),
    mk('d@x.com', '2026-01-04T00:00:00Z', 'u4'),
  ]
  it('sorts by invite time then email without mutating', () => {
    expect(sortPeople(people).map((p) => p.email)).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'])
    expect(people[0].email).toBe('c@x.com')
  })
  it('assigns tones by position, skipping people without an account', () => {
    const t = toneMap(people)
    expect(t.get('u1')).toBe('')
    expect(t.get('u3')).toBe('y')
    expect(t.get('u4')).toBe('')
    expect(t.size).toBe(3)
  })
})

describe('ago and personStatus', () => {
  const now = Date.parse('2026-01-10T12:00:00Z')
  it('formats ranges', () => {
    expect(ago('2026-01-10T11:59:40Z', now)).toBe('just now')
    expect(ago('2026-01-10T12:30:00Z', now)).toBe('just now')
    expect(ago('2026-01-10T11:48:00Z', now)).toBe('12 min ago')
    expect(ago('2026-01-10T09:00:00Z', now)).toBe('3 h ago')
    expect(ago('2026-01-09T10:00:00Z', now)).toBe('yesterday')
    expect(ago('2026-01-06T12:00:00Z', now)).toBe('4 days ago')
  })
  it('returns empty for an invalid date', () => {
    expect(ago('nope', now)).toBe('')
  })
  it('personStatus covers the three states', () => {
    const base: Person = {
      email: 'a@x.com',
      addedAt: '2026-01-09T12:00:00Z',
      userId: null,
      displayName: null,
      signedInAt: null,
      isAdmin: false,
      lastMarkAt: null,
    }
    expect(personStatus(base, now)).toBe('Invited yesterday, not signed in')
    expect(personStatus({ ...base, signedInAt: '2026-01-10T09:00:00Z' }, now)).toBe('Signed in 3 h ago')
    expect(
      personStatus({ ...base, signedInAt: '2026-01-10T09:00:00Z', lastMarkAt: '2026-01-10T11:48:00Z' }, now),
    ).toBe('Last mark 12 min ago')
  })
})

describe('normaliseEmail', () => {
  it('trims and lower-cases', () => {
    expect(normaliseEmail('  Maya@Example.COM ')).toBe('maya@example.com')
  })
  it.each([
    '',
    '   ',
    'plain',
    'a@b',
    'a@@b.com',
    '@b.com',
    'a@',
    'a b@c.com',
    'a@b .com',
    'a@.com',
    'a@b..com',
    'a@b.',
    'a\u0000@b.com',
    'a@b.com\n x',
  ])('rejects %j', (raw) => {
    expect(normaliseEmail(raw)).toBeNull()
  })
  it('accepts exactly 254 characters and rejects 255', () => {
    const tail = '@x.com'
    expect(normaliseEmail('a'.repeat(254 - tail.length) + tail)).not.toBeNull()
    expect(normaliseEmail('a'.repeat(255 - tail.length) + tail)).toBeNull()
  })
})

describe('readPeopleResult', () => {
  it('maps ok', () => {
    expect(readPeopleResult({ ok: true })).toEqual({ ok: true })
  })
  it.each(['unauthorized', 'not_admin', 'bad_request', 'bad_email', 'is_admin', 'internal'])(
    'maps server code %s',
    (code) => {
      expect(readPeopleResult({ ok: false, error: code })).toEqual({ ok: false, error: code })
    },
  )
  it.each([
    null,
    undefined,
    'x',
    5,
    {},
    { ok: false },
    { ok: false, error: 'duplicate' },
    { ok: false, error: 'weird' },
    { ok: 'true' },
  ])('treats %j as network', (body) => {
    expect(readPeopleResult(body)).toEqual({ ok: false, error: 'network' })
  })
})
