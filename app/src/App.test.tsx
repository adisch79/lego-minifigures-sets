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
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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
    const src = (name: string) => screen.getByAltText(`${name} series`).getAttribute('src')
    expect(src('Ninjago Movie')).toContain('cards/71019.png')
    expect(src('Series 5')).toContain('img/8805/8805-1.webp')
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
