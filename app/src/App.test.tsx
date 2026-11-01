import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function series(id: string, name: string, year: number, figure: string) {
  return {
    id,
    name,
    line: 'Series',
    seriesNo: null,
    year,
    age: null,
    bricklinkCode: null,
    figureCount: 1,
    bag: `img/${id}/${id}-0.webp`,
    card: null,
    figures: [
      { id: `${id}-1`, no: 1, name: figure, img: `img/${id}/${id}-1.webp`, imgFallback: false },
    ],
  }
}

const catalog = {
  version: 2,
  source: 'test',
  series: [
    series('71019', 'Ninjago Movie', 2017, 'Kai Kendo'),
    series('71053', 'Shrek', 2026, 'Thelonious'),
    series('8805', 'Series 5', 2011, 'Graduate'),
  ],
}

function stubFetch(response: Partial<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

const headings = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  stubFetch({ ok: true, json: () => Promise.resolve(catalog) })
  // jsdom has no layout, so scrolling is a spy.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('renders the brand and the page title', async () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'Minifig Vault home' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Every series.')
    await screen.findByText('Shrek')
  })

  it('shows tiles newest first with the agreed art', async () => {
    render(<App />)
    await screen.findByText('Shrek')
    expect(headings()).toEqual(['Shrek', 'Ninjago Movie', 'Series 5'])
    const src = (name: string) =>
      screen
        .getAllByRole('link', { name: new RegExp(`^${name},`) })[0]
        .querySelector('img')
        ?.getAttribute('src')
    expect(src('Ninjago Movie')).toContain('cards/71019.png')
    expect(src('Series 5')).toContain('cards/8805.png')
  })

  it('restores sort and search from the URL', async () => {
    window.history.replaceState(null, '', '/?sort=az&q=kendo')
    render(<App />)
    await screen.findByText('Ninjago Movie')
    expect(headings()).toEqual(['Ninjago Movie'])
    expect(screen.getByText('Includes Kai Kendo')).toBeTruthy()
    expect((screen.getByLabelText('Sort series') as HTMLSelectElement).value).toBe('az')
  })

  it('keeps the URL in sync with the controls', async () => {
    render(<App />)
    await screen.findByText('Shrek')
    fireEvent.change(screen.getByLabelText('Sort series'), { target: { value: 'old' } })
    expect(headings()).toEqual(['Series 5', 'Ninjago Movie', 'Shrek'])
    fireEvent.change(screen.getByLabelText('Search series'), { target: { value: 'shrek' } })
    expect(window.location.search).toBe('?sort=old&q=shrek')
  })

  it('shows a message for an empty search and can clear it', async () => {
    render(<App />)
    await screen.findByText('Shrek')
    fireEvent.change(screen.getByLabelText('Search series'), { target: { value: 'zzz' } })
    const message = screen.getByText('No series match "zzz"')
    fireEvent.click(within(message.parentElement!).getByRole('button', { name: 'Clear search' }))
    expect(headings()).toHaveLength(3)
    expect(window.location.search).toBe('')
  })

  it('shows an error with a working retry', async () => {
    stubFetch({ ok: false, status: 500 })
    render(<App />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('HTTP 500')
    stubFetch({ ok: true, json: () => Promise.resolve(catalog) })
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    await screen.findByText('Shrek')
  })
})

describe('series page', () => {
  const go = (hash: string) => {
    window.location.hash = hash
    fireEvent(window, new HashChangeEvent('hashchange'))
  }

  it('opens from the hash with the card, facts and figure', async () => {
    window.history.replaceState(null, '', '/#series/71019')
    render(<App />)
    const title = await screen.findByRole('heading', { level: 1, name: 'Ninjago Movie' })
    expect(title).toBeTruthy()
    expect(document.title).toContain('Ninjago Movie')
    const hero = title.closest('section')!
    expect(hero.textContent).toContain('No. 71019')
    expect(hero.textContent).toContain('2017')
    expect(hero.textContent).toContain('1 to collect')
    const card = screen.getByAltText('Ninjago Movie series card')
    expect(card.getAttribute('src')).toContain('cards/71019.png')
    expect(document.querySelector('img[src*="71019-0"]')).toBeNull()
    const pic = screen.getByAltText('Kai Kendo minifigure')
    expect(pic.getAttribute('src')).toContain('img/71019/71019-1.webp')
    expect(pic.getAttribute('loading')).toBe('lazy')
    expect(screen.getByRole('heading', { level: 3 }).textContent).toContain('Kai Kendo')
  })

  it('shows no sign-in features', async () => {
    window.history.replaceState(null, '', '/#series/71019')
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Ninjago Movie' })
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/owned|wanted/i)
  })

  it('shows a text placeholder when a figure image fails', async () => {
    window.history.replaceState(null, '', '/#series/71019')
    render(<App />)
    const pic = await screen.findByAltText('Kai Kendo minifigure')
    fireEvent.error(pic)
    expect(screen.queryByAltText('Kai Kendo minifigure')).toBeNull()
    expect(screen.getByText('No picture yet')).toBeTruthy()
  })

  it('shows a not-found state with a link home for an unknown id', async () => {
    window.history.replaceState(null, '', '/?sort=az#series/99999')
    render(<App />)
    const title = await screen.findByRole('heading', { level: 1, name: 'Series not found' })
    expect(title.parentElement!.textContent).toContain('99999')
    const home = screen.getByRole('link', { name: 'Back to all series' })
    expect(home.getAttribute('href')).toBe('#')
  })

  it('does not call an id missing while the catalog is still loading', () => {
    window.history.replaceState(null, '', '/#series/71019')
    render(<App />)
    expect(screen.queryByRole('heading', { name: 'Series not found' })).toBeNull()
    expect(screen.getByRole('link', { name: /All series/ })).toBeTruthy()
  })

  it('reports a catalog failure rather than not-found', async () => {
    stubFetch({ ok: false, status: 500 })
    window.history.replaceState(null, '', '/#series/71019')
    render(<App />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('HTTP 500')
    expect(screen.queryByRole('heading', { name: 'Series not found' })).toBeNull()
  })

  it('goes back home keeping the sort and search, and scrolls to top on entry', async () => {
    window.history.replaceState(null, '', '/?sort=az&q=ninjago')
    render(<App />)
    await screen.findByText('Ninjago Movie')
    const scroll = vi.mocked(window.scrollTo)
    scroll.mockClear()

    go('#series/71019')
    await screen.findByRole('heading', { level: 1, name: 'Ninjago Movie' })
    expect(scroll).toHaveBeenCalledWith(0, 0)
    expect(window.location.search).toBe('?sort=az&q=ninjago')
    expect(screen.getByRole('link', { name: /All series/ }).getAttribute('href')).toBe('#')

    go('')
    await screen.findByLabelText('Search series')
    expect(window.location.search).toBe('?sort=az&q=ninjago')
    expect((screen.getByLabelText('Search series') as HTMLInputElement).value).toBe('ninjago')
    expect((screen.getByLabelText('Sort series') as HTMLSelectElement).value).toBe('az')
    expect(headings()).toEqual(['Ninjago Movie'])
  })
})
