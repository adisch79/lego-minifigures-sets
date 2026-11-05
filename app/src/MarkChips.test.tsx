import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from './auth'

// Supabase stand-in: records every query and answers from `results` (same pattern as marks.test.ts).
type Call = { op: string; args: unknown[] }
let calls: Call[] = []
let results: Record<string, { data?: unknown; error?: { code?: string } | null }> = {}
const authState: { current: AuthState } = { current: { status: 'signed-out' } }

function builder(op: string, args: unknown[]) {
  calls.push({ op, args })
  const b: Record<string, unknown> = {}
  b.eq = (...a: unknown[]) => {
    calls.push({ op: 'eq', args: a })
    return b
  }
  b.select = () => b
  // An update must return the touched row, or setMark treats it as a failed save.
  const dflt = op === 'update' ? { data: [{}], error: null } : { data: [], error: null }
  b.then = (res: (v: unknown) => unknown) => Promise.resolve(results[op] ?? dflt).then(res)
  return b
}

vi.mock('./auth', () => ({
  authEnabled: true,
  useAuth: () => authState.current,
  requestLink: vi.fn(),
  signOut: vi.fn(),
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({
      select: (...a: unknown[]) => builder('select', a),
      upsert: (...a: unknown[]) => builder('upsert', a),
      update: (...a: unknown[]) => builder('update', a),
      delete: (...a: unknown[]) => builder('delete', a),
    }),
  },
}))

import App from './App'

function series(id: string, name: string, year: number, names: string[]) {
  return {
    id,
    name,
    line: 'Series',
    seriesNo: null,
    year,
    age: null,
    bricklinkCode: null,
    figureCount: names.length,
    bag: `img/${id}/${id}-0.webp`,
    card: null,
    figures: names.map((n, i) => ({
      id: `${id}-${i + 1}`,
      no: i + 1,
      name: n,
      img: `img/${id}/${id}-${i + 1}.webp`,
      imgFallback: false,
    })),
  }
}

const catalog = {
  version: 2,
  source: 'test',
  series: [
    series('71048', 'Series 27 Minifigures', 2025, ['Hamster Costume Fan', 'Wolfpack Beastmaster']),
    series('71053', 'Shrek', 2026, ['Thelonious', 'Gingy']),
  ],
}

const SIGNED_IN: AuthState = { status: 'signed-in', email: 'fan@example.com' }

function renderAt(hash: string, auth: AuthState) {
  authState.current = auth
  window.history.replaceState(null, '', `/${hash}`)
  return render(<App />)
}

const ops = (op: string) => calls.filter((c) => c.op === op)

beforeEach(() => {
  calls = []
  results = {
    select: {
      data: [
        { kind: 'figure', target_id: '71048-1', state: 'owned' },
        { kind: 'figure', target_id: '71053-2', state: 'wanted' },
      ],
      error: null,
    },
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('signed out', () => {
  it('shows no chips, no progress and no filter', async () => {
    renderAt('#series/71048', { status: 'signed-out' })
    await screen.findByRole('heading', { level: 3, name: /Hamster Costume Fan/ })
    expect(screen.queryByRole('button', { name: 'Owned' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Own it' })).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(ops('select')).toHaveLength(0)
  })

  it('offers sign-in on the home rule instead of the filter', async () => {
    renderAt('', { status: 'signed-out' })
    await screen.findByText('Shrek')
    expect(screen.queryByRole('group', { name: 'Filter series' })).toBeNull()
    expect(screen.queryByText(/owned$/)).toBeNull()
    const hint = screen.getByText(/to track what you own/)
    fireEvent.click(within(hint).getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeTruthy()
  })
})

describe('signed in, home', () => {
  it('shows progress and wanted counts on every tile', async () => {
    renderAt('', SIGNED_IN)
    const bar = await screen.findByRole('progressbar', { name: 'Series 27 Minifigures owned' })
    expect(bar.getAttribute('aria-valuenow')).toBe('1')
    expect(bar.getAttribute('aria-valuemax')).toBe('2')
    expect(screen.getByText('1 figure wanted')).toBeTruthy()
  })

  it('filters to wanted and missing series and shows the empty state', async () => {
    results.select = { data: [{ kind: 'figure', target_id: '71048-1', state: 'owned' }, { kind: 'figure', target_id: '71048-2', state: 'owned' }], error: null }
    renderAt('', SIGNED_IN)
    const seg = await screen.findByRole('group', { name: 'Filter series' })
    fireEvent.click(within(seg).getByRole('button', { name: /Missing/ }))
    expect(within(seg).getByRole('button', { name: /Missing/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('Series 27 Minifigures')).toBeNull()
    expect(screen.getByText('Shrek')).toBeTruthy()
    fireEvent.click(within(seg).getByRole('button', { name: /My wanted/ }))
    expect(screen.getByText('Your wanted list is empty')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show all series' }))
    expect(screen.getByText('Series 27 Minifigures')).toBeTruthy()
  })
})

describe('signed in, series page', () => {
  it('shows the owned count in the hero', async () => {
    renderAt('#series/71048', SIGNED_IN)
    const bar = await screen.findByRole('progressbar', { name: 'Figures owned' })
    await waitFor(() => expect(bar.getAttribute('aria-valuenow')).toBe('1'))
    expect(bar.parentElement!.textContent).toContain('1/2')
  })

  it('a chip tap saves the mark, a second tap clears it', async () => {
    renderAt('#series/71048', SIGNED_IN)
    const group = await screen.findByRole('group', { name: 'Mark Wolfpack Beastmaster' })
    const owned = within(group).getByRole('button', { name: 'Owned' })
    await waitFor(() => expect((owned as HTMLButtonElement).disabled).toBe(false))
    expect(owned.getAttribute('aria-pressed')).toBe('false')

    await act(async () => {
      fireEvent.click(owned)
    })
    expect(owned.getAttribute('aria-pressed')).toBe('true')
    expect(ops('upsert')[0].args[0]).toEqual({ user_id: 'u1', kind: 'figure', target_id: '71048-2', state: 'owned' })
    expect(screen.getByRole('progressbar', { name: 'Figures owned' }).getAttribute('aria-valuenow')).toBe('2')

    await act(async () => {
      fireEvent.click(owned)
    })
    expect(owned.getAttribute('aria-pressed')).toBe('false')
    expect(ops('delete')).toHaveLength(1)
  })

  it('Want replaces Owned, never both', async () => {
    renderAt('#series/71048', SIGNED_IN)
    const group = await screen.findByRole('group', { name: 'Mark Hamster Costume Fan' })
    const owned = within(group).getByRole('button', { name: 'Owned' })
    await waitFor(() => expect(owned.getAttribute('aria-pressed')).toBe('true'))
    await act(async () => {
      fireEvent.click(within(group).getByRole('button', { name: 'Want' }))
    })
    expect(owned.getAttribute('aria-pressed')).toBe('false')
    expect(within(group).getByRole('button', { name: 'Want' }).getAttribute('aria-pressed')).toBe('true')
    expect(ops('update').at(-1)!.args[0]).toEqual({ state: 'wanted' })
  })

  it('a failed save rolls back and offers Retry', async () => {
    renderAt('#series/71048', SIGNED_IN)
    const group = await screen.findByRole('group', { name: 'Mark Wolfpack Beastmaster' })
    const want = within(group).getByRole('button', { name: 'Want' })
    await waitFor(() => expect((want as HTMLButtonElement).disabled).toBe(false))
    results.upsert = { error: { code: 'XX000' } }
    await act(async () => {
      fireEvent.click(want)
    })
    expect(want.getAttribute('aria-pressed')).toBe('false')
    expect(want.className).toContain('bad')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Not saved')

    results.upsert = { error: null }
    await act(async () => {
      fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    })
    expect(want.getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('Not saved')).toBeNull()
  })

  it('the series chips mark the whole series', async () => {
    renderAt('#series/71048', SIGNED_IN)
    const group = await screen.findByRole('group', { name: 'Mark the whole series' })
    const own = within(group).getByRole('button', { name: 'Own it' })
    await waitFor(() => expect((own as HTMLButtonElement).disabled).toBe(false))
    await act(async () => {
      fireEvent.click(own)
    })
    expect(own.getAttribute('aria-pressed')).toBe('true')
    expect(ops('upsert')[0].args[0]).toEqual({ user_id: 'u1', kind: 'series', target_id: '71048', state: 'owned' })
  })
})
