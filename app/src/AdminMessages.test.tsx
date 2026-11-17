import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from './auth'
import type { AdminData, AdminGate } from './adminApi'
import type { MessagesData } from './messagesApi'
import { parseMessages } from './messagesLogic'
import type { Load } from './series'

const authState: { current: AuthState } = { current: { status: 'signed-in', email: 'owner@x.com' } }
const gateState: { current: AdminGate } = { current: 'admin' }
const dataState: { current: AdminData } = { current: { status: 'ready', people: [], wanted: [] } }
const msgState: { current: MessagesData } = { current: { status: 'loading' } }
const phone: { current: boolean } = { current: false }

const retryMessages = vi.fn()
const markRead = vi.fn<(id: number) => Promise<boolean>>()
const remove = vi.fn<(id: number) => Promise<boolean>>()

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
  useIsAdmin: () => ({ gate: gateState.current, recheck: vi.fn() }),
  useAdminData: () => ({ data: dataState.current, refresh: vi.fn(), retry: vi.fn() }),
  deleteAccount: vi.fn(),
}))

vi.mock('./messagesApi', () => ({
  useMessages: () => ({
    data: msgState.current,
    retry: () => retryMessages(),
    markRead: (id: number) => markRead(id),
    remove: (id: number) => remove(id),
  }),
}))

import Admin from './Admin'
import { AccountProvider } from './Account'

const NOW = Date.now()
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60000).toISOString()

// Newest first, like admin_contact_list. Two unread: 7 and 6.
const messages = parseMessages([
  { id: 8, created_at: iso(18), name: 'Lena Hartmann', email: 'lena@example.de', message: 'The Series 27 page shows the Bogeyman twice.', read_at: iso(10) },
  { id: 7, created_at: iso(285), name: null, email: 'brickfan_1987@example.com', message: 'Could you add the promo figure?', read_at: null },
  {
    id: 6,
    created_at: iso(1017),
    name: 'Tomas \u202EOkafor',
    email: 'tomas+cmf@example.org',
    message: 'Line one.\n\n<img src=x onerror=alert(1)> stays text \u2066here\u2069.',
    read_at: null,
  },
  { id: 5, created_at: iso(3000), name: 'Aiko Tanaka', email: 'aiko@example.jp', message: 'Small correction.', read_at: iso(2900) },
])

const load: Load = { status: 'ready', series: [] }

function renderAdmin() {
  return render(
    <AccountProvider>
      <Admin load={load} onRetry={vi.fn()} />
    </AccountProvider>,
  )
}

const view = (name: RegExp) => within(screen.getByRole('group', { name: 'Admin view' })).getByRole('button', { name })
const openMessages = () => fireEvent.click(view(/^Messages/))
const list = () => screen.getByRole('list', { name: 'Messages' })
const rowNames = () => within(list()).getAllByRole('button').map((b) => b.querySelector('.ma-who')?.textContent)
const pane = () => screen.getByRole('article')

beforeEach(() => {
  authState.current = { status: 'signed-in', email: 'owner@x.com' }
  gateState.current = 'admin'
  dataState.current = { status: 'ready', people: [], wanted: [] }
  msgState.current = { status: 'ready', messages }
  phone.current = false
  retryMessages.mockReset()
  markRead.mockReset()
  remove.mockReset()
  // jsdom has no matchMedia; the page asks it for the phone layout.
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width') ? phone.current : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Admin view switch', () => {
  it('starts on the wanted wall with an unread badge on Messages', () => {
    renderAdmin()
    expect(view(/^Wanted wall/).getAttribute('aria-pressed')).toBe('true')
    const m = view(/^Messages/)
    expect(m.getAttribute('aria-pressed')).toBe('false')
    expect(m.textContent).toContain('2')
    expect(m.getAttribute('aria-label')).toBe('Messages, 2 unread')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('What they want')
  })

  it('shows no badge while messages load or when all are read', () => {
    msgState.current = { status: 'loading' }
    renderAdmin()
    expect(view(/^Messages/).querySelector('i')).toBeNull()
  })

  it('switches to Messages and back, keeping focus on the switch', () => {
    renderAdmin()
    openMessages()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('What they say')
    expect(view(/^Messages/).getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(view(/^Messages/))
    fireEvent.click(view(/^Wanted wall/))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('What they want')
  })
})

describe('Messages list and reader', () => {
  it('shows the counts in the hero', () => {
    renderAdmin()
    openMessages()
    const sum = screen.getByRole('list', { name: 'Summary' })
    expect(sum.textContent).toContain('4messages')
    expect(sum.textContent).toContain('2unread')
    expect(sum.textContent).toContain('18 minsince the last one')
  })

  it('lists newest first and opens the newest unread message', () => {
    renderAdmin()
    openMessages()
    expect(rowNames()).toEqual(['Lena Hartmann', 'brickfan_1987@example.com', 'Tomas Okafor', 'Aiko Tanaka'])
    const current = within(list()).getAllByRole('button').find((b) => b.getAttribute('aria-current') === 'true')
    expect(current?.textContent).toContain('brickfan_1987@example.com')
    expect(within(pane()).getByRole('heading', { level: 2 }).textContent).toBe('No name given')
  })

  it('marks unread rows for screen readers', () => {
    renderAdmin()
    openMessages()
    expect(within(list()).getAllByText('Unread', { selector: '.sr' })).toHaveLength(2)
  })

  it('filters to unread and back to all', () => {
    renderAdmin()
    openMessages()
    const bar = screen.getByRole('group', { name: 'Filter messages' })
    fireEvent.click(within(bar).getByRole('button', { name: /^Unread/ }))
    expect(rowNames()).toEqual(['brickfan_1987@example.com', 'Tomas Okafor'])
    fireEvent.click(within(bar).getByRole('button', { name: /^All/ }))
    expect(rowNames()).toHaveLength(4)
  })

  it('renders the message as plain text, without bidi characters', () => {
    renderAdmin()
    openMessages()
    fireEvent.click(within(list()).getByText('Tomas Okafor'))
    const p = pane()
    expect(within(p).getByRole('heading', { level: 2 }).textContent).toBe('Tomas Okafor')
    const body = p.querySelector('.ma-body') as HTMLElement
    expect(body.textContent).toBe('Line one.\n\n<img src=x onerror=alert(1)> stays text here.')
    expect(p.querySelector('img')).toBeNull()
    expect(document.body.innerHTML).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/)
  })

  it('links the reply with an encoded mailto', () => {
    renderAdmin()
    openMessages()
    fireEvent.click(within(list()).getByText('Tomas Okafor'))
    const a = within(pane()).getByRole('link', { name: /tomas\+cmf@example\.org/ })
    expect(a.getAttribute('href')).toBe('mailto:tomas%2Bcmf%40example.org?subject=Re%3A%20your%20message%20to%20Minifig%20Hunt')
  })

  it('moves through the list with the arrow keys', () => {
    renderAdmin()
    openMessages()
    const rows = within(list()).getAllByRole('button')
    rows[1].focus()
    fireEvent.keyDown(rows[1], { key: 'ArrowDown' })
    expect(within(pane()).getByRole('heading', { level: 2 }).textContent).toBe('Tomas Okafor')
    expect(document.activeElement?.textContent).toContain('Tomas Okafor')
  })

  it('Mark read calls the API with the id', async () => {
    markRead.mockResolvedValue(true)
    renderAdmin()
    openMessages()
    await act(async () => {
      fireEvent.click(within(pane()).getByRole('button', { name: 'Mark read' }))
    })
    expect(markRead).toHaveBeenCalledWith(7)
  })

  it('shows Read and no Mark read button on a read message', () => {
    renderAdmin()
    openMessages()
    fireEvent.click(within(list()).getByText('Lena Hartmann'))
    expect(within(pane()).queryByRole('button', { name: 'Mark read' })).toBeNull()
    expect(within(pane()).getByText('Read')).toBeTruthy()
  })

  it('shows an error when Mark read fails', async () => {
    markRead.mockResolvedValue(false)
    renderAdmin()
    openMessages()
    await act(async () => {
      fireEvent.click(within(pane()).getByRole('button', { name: 'Mark read' }))
    })
    expect(within(pane()).getByRole('alert').textContent).toMatch(/Could not mark it read/)
  })
})

describe('Delete', () => {
  it('asks first; Keep cancels without calling the API', () => {
    renderAdmin()
    openMessages()
    fireEvent.click(within(pane()).getByRole('button', { name: 'Delete' }))
    const ask = within(pane()).getByRole('group', { name: /Delete this message/ })
    expect(ask.textContent).toContain('brickfan_1987@example.com')
    expect(document.activeElement?.textContent).toBe('Keep')
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep' }))
    expect(remove).not.toHaveBeenCalled()
    expect(within(pane()).queryByRole('group', { name: /Delete this message/ })).toBeNull()
  })

  it('runs only after the confirm', async () => {
    remove.mockResolvedValue(true)
    renderAdmin()
    openMessages()
    fireEvent.click(within(pane()).getByRole('button', { name: 'Delete' }))
    expect(remove).not.toHaveBeenCalled()
    const ask = within(pane()).getByRole('group', { name: /Delete this message/ })
    await act(async () => {
      fireEvent.click(within(ask).getByRole('button', { name: 'Delete message' }))
    })
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith(7)
  })

  it('keeps the confirm open and shows the error when it fails', async () => {
    remove.mockResolvedValue(false)
    renderAdmin()
    openMessages()
    fireEvent.click(within(pane()).getByRole('button', { name: 'Delete' }))
    const ask = within(pane()).getByRole('group', { name: /Delete this message/ })
    await act(async () => {
      fireEvent.click(within(ask).getByRole('button', { name: 'Delete message' }))
    })
    expect(within(ask).getByRole('alert').textContent).toMatch(/Could not delete it/)
  })

  it('never uses window.confirm', () => {
    const spy = vi.spyOn(window, 'confirm')
    renderAdmin()
    openMessages()
    fireEvent.click(within(pane()).getByRole('button', { name: 'Delete' }))
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('Messages states', () => {
  it('shows ghost rows and a busy list while loading', () => {
    msgState.current = { status: 'loading' }
    renderAdmin()
    openMessages()
    expect(screen.getByRole('region', { name: 'Messages' }).getAttribute('aria-busy')).toBe('true')
  })

  it('shows the error and retries', () => {
    msgState.current = { status: 'error', message: 'Could not load' }
    renderAdmin()
    openMessages()
    expect(screen.getByRole('alert').textContent).toContain('Could not load')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retryMessages).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state with no messages', () => {
    msgState.current = { status: 'ready', messages: [] }
    renderAdmin()
    openMessages()
    expect(screen.getByText('No messages yet')).toBeTruthy()
  })

  it('shows all caught up on the unread filter when everything is read', () => {
    msgState.current = { status: 'ready', messages: messages.map((m) => ({ ...m, readAt: m.readAt ?? iso(1) })) }
    renderAdmin()
    openMessages()
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter messages' })).getByRole('button', { name: /^Unread/ }))
    expect(screen.getByText('All caught up')).toBeTruthy()
  })
})

describe('Phone layout', () => {
  it('unfolds the open message under its row, with no side pane', () => {
    phone.current = true
    renderAdmin()
    openMessages()
    expect(screen.queryByRole('article')).toBeNull()
    const fold = list().querySelector('.ma-fold') as HTMLElement
    expect(fold.closest('li')?.textContent).toContain('brickfan_1987@example.com')
    expect(within(fold).getByRole('button', { name: 'Mark read' })).toBeTruthy()
  })

  it('folds the open message away when its row is tapped again', () => {
    phone.current = true
    renderAdmin()
    openMessages()
    fireEvent.click(within(list()).getByText('brickfan_1987@example.com'))
    expect(list().querySelector('.ma-fold')).toBeNull()
  })
})
