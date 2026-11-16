// Story V2-15 PR 1: the About page, its coffee chapter, the header link and the site footer.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { Coffee } from './About'
import { KOFI_URL } from './kofi'

function series(id: string, name: string, year: number, figureCount: number) {
  return {
    id,
    name,
    line: 'Series',
    seriesNo: null,
    year,
    age: null,
    bricklinkCode: null,
    figureCount,
    bag: null,
    card: null,
    figures: Array.from({ length: figureCount }, (_, i) => ({
      id: `${id}-${i + 1}`,
      no: i + 1,
      name: `Figure ${i + 1}`,
      img: `img/${id}/${id}-${i + 1}.webp`,
      imgFallback: false,
    })),
  }
}

const catalog = {
  version: 2,
  source: 'test',
  series: [series('8683', 'Series 1', 2010, 16), series('71053', 'Shrek', 2026, 12)],
}

function stubFetch(response: Partial<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

const go = (hash: string) => {
  window.location.hash = hash
  fireEvent(window, new HashChangeEvent('hashchange'))
}

const scrollIntoView = vi.fn()

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  stubFetch({ ok: true, json: () => Promise.resolve(catalog) })
  // jsdom has no layout: scrolling is a spy and scrollIntoView does not exist.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  scrollIntoView.mockClear()
  Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const footer = () => screen.getByRole('contentinfo')

describe('About page', () => {
  it('renders from #about with the story, both chapters and the page title', async () => {
    window.history.replaceState(null, '', '/#about')
    const { container } = render(<App />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toContain('One collector.')
    expect(screen.getByRole('heading', { level: 2, name: 'Support the site' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Write to me' })).toBeTruthy()
    expect(screen.getByText('The contact form opens soon')).toBeTruthy()
    await waitFor(() => expect(container.querySelector('.stats')).not.toBeNull())
    expect(document.title).toBe('About - Minifig Hunt')
  })

  it('takes the stats from the loaded catalog', async () => {
    window.history.replaceState(null, '', '/#about')
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.stats')).not.toBeNull())
    const stats = container.querySelector('.stats') as HTMLElement
    expect(stats.textContent).toContain('2Series')
    expect(stats.textContent).toContain('28Figures')
    expect(stats.textContent).toContain('2010-2026Years')
  })

  it('hides the stats while the catalog loads', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    window.history.replaceState(null, '', '/#about')
    const { container } = render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    expect(container.querySelector('.stats')).toBeNull()
    expect(container.textContent).not.toContain('Infinity')
  })

  it('hides the stats after a load error and still shows the page', async () => {
    stubFetch({ ok: false, status: 500 })
    window.history.replaceState(null, '', '/#about')
    const { container } = render(<App />)
    // Let the rejected load settle.
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(container.querySelector('.stats')).toBeNull()
    expect(container.textContent).not.toContain('Infinity')
    expect(screen.getByRole('heading', { level: 2, name: 'Support the site' })).toBeTruthy()
  })

  it('shows figure cut-outs from the site images only', () => {
    window.history.replaceState(null, '', '/#about')
    const { container } = render(<App />)
    const srcs = [...container.querySelectorAll('.ab-figs img')].map((i) => i.getAttribute('src') ?? '')
    expect(srcs.length).toBeGreaterThan(0)
    for (const src of srcs) expect(src).toMatch(/img\/\d+\/\d+-\d+\.webp$/)
  })

  it('scrolls to a chapter when opened from its anchor', () => {
    window.history.replaceState(null, '', '/#about/support')
    render(<App />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('support'))
  })

  it('scrolls to a chapter on a hash change while already on About, keeping the page key', () => {
    window.history.replaceState(null, '', '/#about')
    render(<App />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(scrollIntoView).not.toHaveBeenCalled()

    go('#about/write')
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('write'))
    // Same page: the h1 is the same node and was not re-rendered.
    expect(screen.getByRole('heading', { level: 1 })).toBe(h1)
  })

  it('opens the page top for an unknown chapter', () => {
    window.history.replaceState(null, '', '/#about/nope')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('One collector.')
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls to top and focuses the heading when entered from home', async () => {
    render(<App />)
    await screen.findByText('Shrek')
    const scroll = vi.mocked(window.scrollTo)
    scroll.mockClear()
    go('#about')
    expect(scroll).toHaveBeenCalledWith(0, 0)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
  })
})

describe('Coffee chapter', () => {
  it('ships with no payment link yet', () => {
    expect(KOFI_URL).toBe('')
  })

  it('shows a disabled Coming soon button while the link is empty', () => {
    render(<Coffee url="" />)
    const button = screen.getByRole('button', { name: /Coming soon/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/The payment page is being set up\./)).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows a new-tab link once the link is set', () => {
    render(<Coffee url="https://ko-fi.com/example" />)
    const link = screen.getByRole('link', { name: /Buy me a coffee/ })
    expect(link.getAttribute('href')).toBe('https://ko-fi.com/example')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByText(/Opens a secure payment page/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Coming soon/ })).toBeNull()
  })
})

describe('Header and footer', () => {
  const checkFooter = () => {
    const f = footer()
    expect(f.textContent).toContain('Fan-made site, not affiliated with the LEGO Group')
    const href = (name: string) => within(f).getByRole('link', { name }).getAttribute('href')
    expect(href('About')).toBe('#about')
    expect(href('Contact')).toBe('#about/write')
    expect(href('Buy me a coffee')).toBe('#about/support')
  }

  it('has an About link in the home header', async () => {
    render(<App />)
    await screen.findByText('Shrek')
    const header = screen.getAllByRole('banner')[0]
    expect(within(header).getByRole('link', { name: 'About' }).getAttribute('href')).toBe('#about')
  })

  it('shows the footer on home', async () => {
    render(<App />)
    await screen.findByText('Shrek')
    checkFooter()
  })

  it('shows the footer on a series page', async () => {
    window.history.replaceState(null, '', '/#series/71053')
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Shrek' })
    checkFooter()
  })

  it('shows the footer on the About page', () => {
    window.history.replaceState(null, '', '/#about')
    render(<App />)
    checkFooter()
  })
})
