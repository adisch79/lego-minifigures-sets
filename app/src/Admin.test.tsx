import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from './auth'
import type { AdminData } from './adminApi'
import type { AdminGate } from './adminApi'
import type { PeopleResult } from './adminLogic'
import { parsePeople, parseWanted } from './adminLogic'
import type { Load } from './series'

const authState: { current: AuthState } = { current: { status: 'signed-in', email: 'owner@x.com' } }
const gateState: { current: AdminGate } = { current: 'admin' }
const dataState: { current: AdminData } = { current: { status: 'loading' } }

const recheck = vi.fn()
const retry = vi.fn()
const refresh = vi.fn<() => Promise<void>>()
const changePerson = vi.fn<(action: 'add' | 'remove', email: string) => Promise<PeopleResult>>()

vi.mock('./auth', () => ({
  authEnabled: true,
  supabase: null,
  useAuth: () => authState.current,
  requestLink: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./adminApi', () => ({
  checkAdmin: vi.fn(),
  loadLists: vi.fn(),
  useIsAdmin: () => ({ gate: gateState.current, recheck: () => recheck() }),
  useAdminData: () => ({ data: dataState.current, refresh: () => refresh(), retry: () => retry() }),
  changePerson: (action: 'add' | 'remove', email: string) => changePerson(action, email),
}))

import Admin from './Admin'
import { AccountProvider } from './Account'

const NOW = Date.now()
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60000).toISOString()

const people = parsePeople([
  { email: 'owner@x.com', added_at: iso(9000), user_id: 'u0', display_name: 'Owner', signed_in_at: iso(8000), is_admin: true, last_mark_at: iso(5) },
  { email: 'maya@x.com', added_at: iso(8000), user_id: 'u1', display_name: 'Maya', signed_in_at: iso(7000), is_admin: false, last_mark_at: iso(30) },
  { email: 'tom@x.com', added_at: iso(7000), user_id: null, display_name: null, signed_in_at: null, is_admin: false, last_mark_at: null },
])

const wanted = parseWanted([
  { user_id: 'u1', label: 'Maya', kind: 'figure', target_id: '71001-1', marked_at: iso(30), alert: 'sent', truncated: false },
  { user_id: 'u0', label: 'Owner', kind: 'figure', target_id: '71001-1', marked_at: iso(60), alert: 'sent', truncated: false },
  { user_id: 'u1', label: 'Maya', kind: 'figure', target_id: '71001-2', marked_at: iso(10), alert: 'unsent', truncated: false },
])

const load: Load = {
  status: 'ready',
  series: [
    {
      id: '71001',
      name: 'Series 10 Minifigures',
      line: 'Series',
      seriesNo: 10,
      year: 2013,
      age: null,
      bricklinkCode: null,
      figureCount: 2,
      bag: null,
      card: null,
      figures: [
        { id: '71001-1', no: 1, name: 'Mummy', img: 'img/a.webp', imgFallback: false },
        { id: '71001-2', no: 2, name: 'Zombie', img: 'img/b.webp', imgFallback: false },
      ],
    },
  ],
}

function renderAdmin(l: Load = load) {
  return render(
    <AccountProvider>
      <Admin load={l} onRetry={vi.fn()} />
    </AccountProvider>,
  )
}

function ready(p = people, w = wanted) {
  dataState.current = { status: 'ready', people: p, wanted: w }
}

const panel = () => document.getElementById('ap-panel') as HTMLElement
const openButton = () => screen.getByRole('button', { name: /^Allowlist/ })

beforeEach(() => {
  authState.current = { status: 'signed-in', email: 'owner@x.com' }
  gateState.current = 'admin'
  dataState.current = { status: 'loading' }
  recheck.mockReset()
  retry.mockReset()
  refresh.mockReset()
  refresh.mockResolvedValue(undefined)
  changePerson.mockReset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Admin gate screens', () => {
  it('shows sign in when signed out and does not render the wall', () => {
    authState.current = { status: 'signed-out' }
    renderAdmin()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign in to continue')
    expect(screen.getAllByRole('button', { name: 'Sign in' }).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Wanted wall/)).toBeNull()
  })

  it('says admin is off when auth is disabled', () => {
    authState.current = { status: 'disabled' }
    renderAdmin()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Admin is off on this build')
  })

  it('shows a busy checking state while the admin check runs', () => {
    gateState.current = 'checking'
    renderAdmin()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Checking your access')
    expect(screen.getByText(/One moment/).getAttribute('role')).toBe('status')
  })

  it('shows not available for a non-admin and no wall', () => {
    gateState.current = 'not-admin'
    renderAdmin()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Not available')
    expect(screen.queryByRole('button', { name: /^Allowlist/ })).toBeNull()
  })

  it('shows an error with Try again that rechecks', () => {
    gateState.current = 'error'
    renderAdmin()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Could not check your access')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(recheck).toHaveBeenCalledTimes(1)
  })

  it('offers a way back to the vault on every gate screen', () => {
    gateState.current = 'not-admin'
    renderAdmin()
    const links = screen.getAllByRole('link', { name: /Back to the vault/ })
    expect(links.every((a) => a.getAttribute('href') === '#')).toBe(true)
  })
})

describe('Admin wall', () => {
  it('shows ghost cards and a disabled allowlist button while loading', () => {
    renderAdmin()
    expect(document.querySelectorAll('.aw-ghost').length).toBeGreaterThan(0)
    expect(openButton().hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: /Most wanted/ }).hasAttribute('disabled')).toBe(true)
  })

  it('renders ranked cards, summary and view counts from fixture data', () => {
    ready()
    renderAdmin()
    const list = screen.getByRole('list', { name: 'Most wanted' })
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByRole('heading', { level: 3 }).textContent).toBe('Mummy')
    expect(within(cards[0]).getByText('2 collectors')).toBeTruthy()
    expect(within(cards[1]).getByRole('heading', { level: 3 }).textContent).toBe('Zombie')
    expect(within(cards[1]).getByText('1 collector')).toBeTruthy()
    const summary = screen.getByRole('list', { name: 'Summary' })
    expect(summary.textContent).toBe('2wanted3marks1to check')
    expect(screen.getByRole('button', { name: /Not sent/ }).textContent).toMatch(/1/)
  })

  it('switches to Not sent and filters the cards', () => {
    ready()
    renderAdmin()
    const chip = screen.getByRole('button', { name: /Not sent/ })
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    const cards = within(screen.getByRole('list', { name: 'Not sent' })).getAllByRole('listitem')
    expect(cards).toHaveLength(1)
    expect(cards[0].textContent).toMatch(/Zombie/)
  })

  it('shows the empty state when nobody wants anything', () => {
    ready(people, [])
    renderAdmin()
    expect(screen.getByText('Nobody wants anything yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Not sent/ }))
    expect(screen.getByText('Every alert went out')).toBeTruthy()
  })

  it('shows the truncation note when the server cut the list', () => {
    ready(people, wanted.map((w) => ({ ...w, truncated: true })))
    renderAdmin()
    expect(screen.getByRole('note').textContent).toMatch(/Only the newest 5,000/)
  })

  it('shows the admin list error and retries', () => {
    dataState.current = { status: 'error', message: 'rpc failed' }
    renderAdmin()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch(/rpc failed/)
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('shows the catalog error and calls the catalog retry', () => {
    ready()
    const onRetry = vi.fn()
    render(
      <AccountProvider>
        <Admin load={{ status: 'error', message: 'catalog down' }} onRetry={onRetry} />
      </AccountProvider>,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch(/catalog down/)
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('Allowlist slide-over', () => {
  it('is closed at first, opens from the button and closes by X, scrim and Escape', () => {
    ready()
    renderAdmin()
    expect(panel().className).toBe('ap-panel')
    expect(openButton().getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(openButton())
    expect(panel().className).toBe('ap-panel on')
    expect(openButton().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(document.getElementById('ap-mail'))
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Close allowlist' }))
    expect(panel().className).toBe('ap-panel')
    expect(document.body.style.overflow).not.toBe('hidden')

    fireEvent.click(openButton())
    fireEvent.click(document.querySelector('.ap-scrim') as HTMLElement)
    expect(panel().className).toBe('ap-panel')

    fireEvent.click(openButton())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel().className).toBe('ap-panel')
  })

  it('lists people with counts, and no remove button for the admin', () => {
    ready()
    renderAdmin()
    fireEvent.click(openButton())
    const list = within(panel()).getByRole('list', { name: 'Invited addresses' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(within(list).getByText('2 wanted')).toBeTruthy()
    expect(within(list).queryByRole('button', { name: 'Remove owner@x.com' })).toBeNull()
    expect(within(list).getByRole('button', { name: 'Remove maya@x.com' })).toBeTruthy()
    expect(within(list).getByText('You')).toBeTruthy()
    expect(panel().textContent).toMatch(/2.*signed in.*1.*not yet/)
  })

  it('refuses a bad email and a duplicate without calling the API', async () => {
    ready()
    renderAdmin()
    fireEvent.click(openButton())
    const input = document.getElementById('ap-mail') as HTMLInputElement
    const submit = () =>
      act(async () => {
        fireEvent.click(within(panel()).getByRole('button', { name: 'Invite' }))
      })

    fireEvent.change(input, { target: { value: 'nope' } })
    await submit()
    expect(within(panel()).getByRole('alert').textContent).toMatch(/does not look like an email/)

    fireEvent.change(input, { target: { value: ' MAYA@x.com ' } })
    await submit()
    expect(within(panel()).getByRole('alert').textContent).toMatch(/already on the allowlist/)
    expect(changePerson).not.toHaveBeenCalled()
  })

  it('invites a clean address, refreshes and confirms', async () => {
    ready()
    changePerson.mockResolvedValue({ ok: true })
    renderAdmin()
    fireEvent.click(openButton())
    fireEvent.change(document.getElementById('ap-mail') as HTMLInputElement, { target: { value: ' New@X.com ' } })
    await act(async () => {
      fireEvent.click(within(panel()).getByRole('button', { name: 'Invite' }))
    })
    expect(changePerson).toHaveBeenCalledWith('add', 'new@x.com')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(panel().textContent).toMatch(/Invited new@x.com/)
  })

  it('shows the server error text when an invite fails', async () => {
    ready()
    changePerson.mockResolvedValue({ ok: false, error: 'not_admin' })
    renderAdmin()
    fireEvent.click(openButton())
    fireEvent.change(document.getElementById('ap-mail') as HTMLInputElement, { target: { value: 'new@x.com' } })
    await act(async () => {
      fireEvent.click(within(panel()).getByRole('button', { name: 'Invite' }))
    })
    expect(within(panel()).getByRole('alert').textContent).toMatch(/no longer an admin/)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('Inline remove confirm', () => {
  function openConfirm() {
    ready()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAdmin()
    fireEvent.click(openButton())
    fireEvent.click(screen.getByRole('button', { name: 'Remove maya@x.com' }))
    return { confirmSpy, group: within(panel()).getByRole('group') }
  }

  it('asks inline with the email and wanted count, never window.confirm', () => {
    const { confirmSpy, group } = openConfirm()
    expect(group.textContent).toMatch(/Remove maya@x\.com\?/)
    expect(group.textContent).toMatch(/including 2 wanted/)
    expect(within(group).getByRole('button', { name: 'Keep' })).toBeTruthy()
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: 'Keep' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(changePerson).not.toHaveBeenCalled()
  })

  it('Keep cancels without calling the API', () => {
    const { confirmSpy, group } = openConfirm()
    fireEvent.click(within(group).getByRole('button', { name: 'Keep' }))
    expect(within(panel()).queryByRole('group')).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove maya@x.com' })).toBeTruthy()
    expect(changePerson).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('closing the panel drops the confirm without calling the API', () => {
    openConfirm()
    fireEvent.click(screen.getByRole('button', { name: 'Close allowlist' }))
    fireEvent.click(openButton())
    expect(within(panel()).queryByRole('group')).toBeNull()
    expect(changePerson).not.toHaveBeenCalled()
  })

  it('Remove calls the API once, refreshes and closes the confirm', async () => {
    const { group } = openConfirm()
    changePerson.mockResolvedValue({ ok: true })
    await act(async () => {
      fireEvent.click(within(group).getByRole('button', { name: 'Remove' }))
    })
    expect(changePerson).toHaveBeenCalledTimes(1)
    expect(changePerson).toHaveBeenCalledWith('remove', 'maya@x.com')
    expect(refresh).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(within(panel()).queryByRole('group')).toBeNull())
    expect(panel().textContent).toMatch(/Removed maya@x\.com\./)
  })

  it('keeps the confirm open and shows the error when removal fails', async () => {
    const { group } = openConfirm()
    changePerson.mockResolvedValue({ ok: false, error: 'network' })
    await act(async () => {
      fireEvent.click(within(group).getByRole('button', { name: 'Remove' }))
    })
    const g = within(panel()).getByRole('group')
    expect(within(g).getByRole('alert').textContent).toMatch(/Could not reach the server/)
    expect(within(g).getByRole('button', { name: 'Remove' }).hasAttribute('disabled')).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })
})
