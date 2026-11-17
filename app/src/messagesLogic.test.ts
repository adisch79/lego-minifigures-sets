import { describe, expect, it } from 'vitest'
import {
  cleanText,
  filterMessages,
  firstSelection,
  mailtoHref,
  nextAfterDelete,
  parseMessages,
  senderLabel,
  shortWhen,
  sinceLast,
  stamp,
  toneOf,
  unreadCount,
  type ContactMessage,
} from './messagesLogic'

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  created_at: '2026-11-16T13:42:00.000Z',
  name: 'Lena',
  email: 'lena@example.com',
  message: 'Hello',
  read_at: null,
  ...over,
})

const msg = (id: number, read: boolean, over: Partial<ContactMessage> = {}): ContactMessage => ({
  id,
  createdAt: new Date(Date.UTC(2026, 10, 16, 12, 0) - id * 60000).toISOString(),
  name: `N${id}`,
  email: `n${id}@example.com`,
  message: `text ${id}`,
  readAt: read ? '2026-11-16T12:30:00.000Z' : null,
  ...over,
})

describe('parseMessages', () => {
  it('maps the admin_contact_list columns', () => {
    expect(parseMessages([row()])).toEqual([
      { id: 1, createdAt: '2026-11-16T13:42:00.000Z', name: 'Lena', email: 'lena@example.com', message: 'Hello', readAt: null },
    ])
  })

  it('treats null data as an empty list', () => {
    expect(parseMessages(null)).toEqual([])
  })

  it('accepts a bigint id sent as a string', () => {
    expect(parseMessages([row({ id: '42' })])[0].id).toBe(42)
  })

  it('turns an empty or blank name into null', () => {
    expect(parseMessages([row({ name: '   ' })])[0].name).toBeNull()
    expect(parseMessages([row({ name: null })])[0].name).toBeNull()
  })

  it('drops rows without an id, email or message', () => {
    const out = parseMessages([row({ id: null }), row({ id: 2, email: null }), row({ id: 3, message: 5 }), row({ id: 4 })])
    expect(out.map((m) => m.id)).toEqual([4])
  })

  it('throws on a non-array answer', () => {
    expect(() => parseMessages({ rows: [] })).toThrow()
  })

  it('keeps the server order, newest first, and at most 200 rows', () => {
    const many = Array.from({ length: 205 }, (_, i) => row({ id: 300 - i }))
    const out = parseMessages(many)
    expect(out).toHaveLength(200)
    expect(out[0].id).toBe(300)
  })
})

describe('cleanText', () => {
  it('strips bidi embedding, override and isolate characters', () => {
    const evil = 'a\u202Ab\u202Bc\u202Cd\u202De\u202Ef\u2066g\u2067h\u2068i\u2069j'
    expect(cleanText(evil)).toBe('abcdefghij')
  })

  it('strips LRM, RLM and ALM marks', () => {
    expect(cleanText('a‎b‏c؜d')).toBe('abcd')
  })

  it('keeps ordinary text, new lines and non-Latin letters', () => {
    expect(cleanText('Hi,\n\nshalom שלום & <b>')).toBe('Hi,\n\nshalom שלום & <b>')
  })

  it('leaves the marks just outside the ranges', () => {
    expect(cleanText('  ⁥⁪')).toBe('  ⁥⁪')
  })
})

describe('senderLabel', () => {
  it('uses the name, else the email, both cleaned', () => {
    expect(senderLabel(msg(1, false, { name: 'Ann\u202E' }))).toBe('Ann')
    expect(senderLabel(msg(1, false, { name: null, email: 'x\u2066@example.com' }))).toBe('x@example.com')
  })
})

describe('mailtoHref', () => {
  it('encodes the address and the subject', () => {
    expect(mailtoHref('a+b@example.com')).toBe(
      'mailto:a%2Bb%40example.com?subject=Re%3A%20your%20message%20to%20Minifig%20Hunt',
    )
  })

  it('cannot smuggle extra headers through the address', () => {
    const href = mailtoHref('x@example.com?bcc=evil@example.com&body=hi')
    expect(href.split('?')).toHaveLength(2)
    expect(href).not.toContain('&body')
  })

  it('strips bidi characters before encoding', () => {
    expect(mailtoHref('a\u202E@example.com')).toContain('mailto:a%40example.com?')
  })
})

describe('times', () => {
  const now = new Date(2026, 10, 16, 14, 0).getTime()
  const local = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).toISOString()

  it('shortWhen shows a clock time today and a day and month before', () => {
    expect(shortWhen(local(16, 9, 5), now)).toBe('09:05')
    expect(shortWhen(local(15, 21, 3), now)).toBe('15 Nov')
  })

  it('stamp is day, month, year and time', () => {
    expect(stamp(local(15, 21, 3))).toBe('15 Nov 2026, 21:03')
  })

  it('sinceLast drops the word ago', () => {
    expect(sinceLast(local(16, 13, 42), now)).toBe('18 min')
    expect(sinceLast(local(16, 9, 0), now)).toBe('5 h')
    expect(sinceLast(local(15, 13, 0), now)).toBe('1 day')
    expect(sinceLast(local(12, 14, 0), now)).toBe('4 days')
    expect(sinceLast(new Date(now - 10_000).toISOString(), now)).toBe('1 min')
  })

  it('returns empty text for a bad date', () => {
    expect(shortWhen('nope', now)).toBe('')
    expect(stamp('nope')).toBe('')
    expect(sinceLast('nope', now)).toBe('')
  })
})

describe('lists', () => {
  const list = [msg(1, true), msg(2, false), msg(3, false), msg(4, true)]

  it('counts unread', () => {
    expect(unreadCount(list)).toBe(2)
  })

  it('filters unread and keeps the open message in the unread view', () => {
    expect(filterMessages(list, 'all', null).map((m) => m.id)).toEqual([1, 2, 3, 4])
    expect(filterMessages(list, 'unread', null).map((m) => m.id)).toEqual([2, 3])
    expect(filterMessages(list, 'unread', 4).map((m) => m.id)).toEqual([2, 3, 4])
  })

  it('opens the newest unread message first, else the newest', () => {
    expect(firstSelection(list)).toBe(2)
    expect(firstSelection([msg(5, true), msg(6, true)])).toBe(5)
    expect(firstSelection([])).toBeNull()
  })

  it('after a delete opens the next row, else the one before, else nothing', () => {
    expect(nextAfterDelete(list, 2)).toBe(3)
    expect(nextAfterDelete(list, 4)).toBe(3)
    expect(nextAfterDelete([msg(9, true)], 9)).toBeNull()
  })

  it('gives one sender the same tone every time', () => {
    expect(toneOf('a@example.com')).toBe(toneOf('a@example.com'))
    expect(['', 't-ink', 't-y']).toContain(toneOf('b@example.com'))
  })
})
