// Story V2-15 PR 1: the About page, its coffee chapter, the header link and the site footer.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { Coffee, ContactForm } from './About'
import { KOFI_URL } from './kofi'
import { TURNSTILE_SCRIPT } from './Turnstile'
import type { ContactInput, ContactResult } from './contactApi'

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
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  delete window.turnstile
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
    expect(screen.queryByText(/handled by Ko-fi/)).toBeNull()
  })

  it('shows a new-tab link once the link is set', () => {
    render(<Coffee url="https://ko-fi.com/example" />)
    const link = screen.getByRole('link', { name: /Buy me a coffee/ })
    expect(link.getAttribute('href')).toBe('https://ko-fi.com/example')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByText(/Opens a secure payment page/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Coming soon/ })).toBeNull()
    expect(screen.getByText(/handled by Ko-fi/)).toBeTruthy()
  })
})

// A fake Turnstile: every render is recorded; solve() hands the newest widget a token.
type WidgetOpts = { sitekey: string; action?: string; callback: (t: string) => void }
function fakeTurnstile() {
  const widgets: WidgetOpts[] = []
  window.turnstile = {
    render: vi.fn((_el: HTMLElement, o: WidgetOpts) => {
      widgets.push(o)
      return `w${widgets.length}`
    }),
    remove: vi.fn(),
  } as unknown as typeof window.turnstile
  const solve = async (token = 'tok') => {
    await act(async () => {
      widgets[widgets.length - 1].callback(token)
    })
  }
  return { widgets, solve }
}

const field = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement | HTMLTextAreaElement
const type = (name: RegExp, value: string) => fireEvent.change(field(name), { target: { value } })
const sendButton = () => screen.getByRole('button', { name: /Send/ }) as HTMLButtonElement
const submit = async () => {
  await act(async () => {
    fireEvent.click(sendButton())
  })
}
const fillGood = () => {
  type(/Your name/, 'Dana')
  type(/Your email/, 'dana@example.com')
  type(/Message/, 'Is there a way to export my owned list?')
}

const PRIVACY =
  'Your email is used only to answer you. It is not shown, shared or added to a list. Messages are kept for up to a year. To stop spam, a scrambled form of your network address is kept for one hour.'

describe('Write to me chapter', () => {
  it('keeps the opens-soon card and loads no Turnstile script while the contact flag is off', () => {
    vi.stubEnv('VITE_CONTACT_ENABLED', '')
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0xKEY')
    const append = vi.spyOn(document.head, 'appendChild')
    window.history.replaceState(null, '', '/#about')
    render(<App />)
    expect(screen.getByText('The contact form opens soon')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Send/ })).toBeNull()
    const scripts = append.mock.calls.filter(([n]) => n instanceof HTMLScriptElement)
    expect(scripts).toHaveLength(0)
    expect(document.querySelector(`script[src="${TURNSTILE_SCRIPT}"]`)).toBeNull()
  })

  it('keeps the opens-soon card while the Turnstile key is missing', () => {
    vi.stubEnv('VITE_CONTACT_ENABLED', '1')
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    window.history.replaceState(null, '', '/#about')
    render(<App />)
    expect(screen.getByText('The contact form opens soon')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Send/ })).toBeNull()
  })

  it('shows the form with a contact Turnstile widget when both are set', async () => {
    vi.stubEnv('VITE_CONTACT_ENABLED', '1')
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0xKEY')
    const { widgets } = fakeTurnstile()
    window.history.replaceState(null, '', '/#about')
    render(<App />)
    await act(async () => {})
    expect(screen.queryByText('The contact form opens soon')).toBeNull()
    expect(field(/Your name/)).toBeTruthy()
    expect(field(/Your email/)).toBeTruthy()
    expect(field(/Message/)).toBeTruthy()
    expect(widgets).toHaveLength(1)
    expect(widgets[0]).toMatchObject({ sitekey: '0xKEY', action: 'contact' })
    expect(screen.getByText(PRIVACY)).toBeTruthy()
  })
})

describe('Contact form', () => {
  it('validates on Send and does not call the server', async () => {
    fakeTurnstile()
    const send = vi.fn<(i: ContactInput) => Promise<ContactResult>>()
    render(<ContactForm siteKey="k" send={send} />)
    await act(async () => {})
    await submit()
    expect(screen.getByText('Enter your email, so I can answer.')).toBeTruthy()
    expect(screen.getByText('Write a message first.')).toBeTruthy()
    expect(field(/Your email/).getAttribute('aria-invalid')).toBe('true')
    expect(send).not.toHaveBeenCalled()

    type(/Your name/, 'a'.repeat(81))
    type(/Your email/, 'not-an-email')
    expect(screen.getByText('Keep the name to 80 characters.')).toBeTruthy()
    expect(screen.getByText('Check the email address.')).toBeTruthy()
    type(/Message/, 'bad\u0000text')
    expect(screen.getByText('The message contains characters that cannot be sent.')).toBeTruthy()
    await submit()
    expect(send).not.toHaveBeenCalled()
  })

  it('counts the message in code points and flags more than 2000', async () => {
    fakeTurnstile()
    render(<ContactForm siteKey="k" send={vi.fn()} />)
    await act(async () => {})
    const counter = () => document.querySelector('.cf-count')?.textContent
    expect(counter()).toBe('0 / 2000')
    type(/Message/, 'hi \u{1F600}')
    expect(counter()).toBe('4 / 2000')
    type(/Message/, 'a'.repeat(2001))
    expect(counter()).toBe('2001 / 2000')
    expect(document.querySelector('.cf-count')?.classList.contains('over')).toBe(true)
  })

  it('asks for the human check before sending', async () => {
    fakeTurnstile()
    const send = vi.fn<(i: ContactInput) => Promise<ContactResult>>()
    render(<ContactForm siteKey="k" send={send} />)
    await act(async () => {})
    fillGood()
    await submit()
    expect(screen.getByText(/Complete the human check/)).toBeTruthy()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends, shows the sending state, then thanks the sender by name', async () => {
    const { widgets, solve } = fakeTurnstile()
    let finish: (r: ContactResult) => void = () => {}
    const send = vi.fn(() => new Promise<ContactResult>((r) => (finish = r)))
    render(<ContactForm siteKey="k" send={send} />)
    await act(async () => {})
    fillGood()
    await solve('tok-1')
    await submit()
    expect(send).toHaveBeenCalledWith({
      name: 'Dana',
      email: 'dana@example.com',
      message: 'Is there a way to export my owned list?',
      captchaToken: 'tok-1',
    })
    const busy = screen.getByRole('button', { name: /Sending/ }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    // A second click while sending does not send twice.
    await act(async () => {
      fireEvent.click(busy)
    })
    expect(send).toHaveBeenCalledTimes(1)
    await act(async () => finish('sent'))
    expect(screen.getByText('Thanks, Dana. Message received.')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('dana@example.com')

    // Send another message: an empty form and a fresh widget.
    const before = widgets.length
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send another message' }))
    })
    expect(field(/Your name/).value).toBe('')
    expect(field(/Message/).value).toBe('')
    expect(widgets.length).toBeGreaterThan(before)
  })

  it('thanks without a name when none was given', async () => {
    const { solve } = fakeTurnstile()
    render(<ContactForm siteKey="k" send={vi.fn().mockResolvedValue('sent')} />)
    await act(async () => {})
    type(/Your email/, 'dana@example.com')
    type(/Message/, 'Hello')
    await solve()
    await submit()
    expect(screen.getByText('Thanks. Message received.')).toBeTruthy()
  })

  it.each([
    ['rate_limited', 'Too many messages from here. Try again later.'],
    ['error', 'Could not send. Try again.'],
    ['invalid', 'Could not send. Try again.'],
    ['captcha', 'Could not send. Try again.'],
  ] as const)('shows %s, keeps the text, and gets a fresh token', async (result, text) => {
    const { widgets, solve } = fakeTurnstile()
    const send = vi.fn().mockResolvedValue(result)
    render(<ContactForm siteKey="k" send={send} />)
    await act(async () => {})
    fillGood()
    await solve('tok-1')
    expect(widgets).toHaveLength(1)
    await submit()
    expect(screen.getByRole('alert').textContent).toBe(text)
    expect(field(/Message/).value).toBe('Is there a way to export my owned list?')
    // resetKey bump: the widget was rendered again, and the used token is gone.
    expect(widgets).toHaveLength(2)
    await submit()
    expect(send).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Complete the human check/)).toBeTruthy()
    await solve('tok-2')
    await submit()
    expect(send).toHaveBeenCalledTimes(2)
    expect((send.mock.calls[1][0] as ContactInput).captchaToken).toBe('tok-2')
    expect(widgets).toHaveLength(3)
  })

  it('also gets a fresh token after a successful send', async () => {
    const { widgets, solve } = fakeTurnstile()
    render(<ContactForm siteKey="k" send={vi.fn().mockResolvedValue('sent')} />)
    await act(async () => {})
    fillGood()
    await solve()
    await submit()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send another message' }))
    })
    expect(widgets).toHaveLength(2)
  })

  it('writes no email or message text to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m))
    const { solve } = fakeTurnstile()
    const send = vi.fn().mockResolvedValueOnce('error').mockResolvedValueOnce('sent')
    render(<ContactForm siteKey="k" send={send} />)
    await act(async () => {})
    fillGood()
    await solve()
    await submit()
    await solve()
    await submit()
    const printed = spies.flatMap((s) => s.mock.calls.flat().map(String)).join('\n')
    expect(printed).not.toContain('dana@example.com')
    expect(printed).not.toContain('export my owned list')
  })
})

describe('Header and footer', () => {
  const checkFooter = () => {
    const f = footer()
    expect(f.textContent).toContain('does not sponsor, authorize or endorse this site')
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
