import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Turnstile, turnstileSiteKey } from './Turnstile'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete window.turnstile
  vi.restoreAllMocks()
})

describe('turnstileSiteKey', () => {
  it('is empty when unset and trimmed when set', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    expect(turnstileSiteKey()).toBe('')
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', ' 0xABC ')
    expect(turnstileSiteKey()).toBe('0xABC')
  })
})

type Opts = { callback: (t: string) => void; 'error-callback': () => void }

describe('Turnstile', () => {
  it('renders explicitly, reports the token, and re-renders on resetKey', async () => {
    let cb: (t: string) => void = () => {}
    const render_ = vi.fn((_el: HTMLElement, o: { callback: (t: string) => void }) => {
      cb = o.callback
      return 'w' + render_.mock.calls.length
    })
    const remove = vi.fn()
    window.turnstile = { render: render_, remove } as unknown as typeof window.turnstile
    const onToken = vi.fn()
    const { rerender } = render(<Turnstile siteKey="k1" onToken={onToken} resetKey={0} />)
    await act(async () => {})
    expect(render_).toHaveBeenCalledTimes(1)
    expect(render_.mock.calls[0][1]).toMatchObject({ sitekey: 'k1' })
    act(() => cb('tok'))
    expect(onToken).toHaveBeenLastCalledWith('tok')
    rerender(<Turnstile siteKey="k1" onToken={onToken} resetKey={1} />)
    await act(async () => {})
    expect(remove).toHaveBeenCalledWith('w1')
    expect(render_).toHaveBeenCalledTimes(2)
    expect(onToken).toHaveBeenCalledWith(null)
  })
  it('shows a retry message when the widget reports an error, and Retry remounts it', async () => {
    const opts: Opts[] = []
    window.turnstile = {
      render: vi.fn((_el, o: Opts) => {
        opts.push(o)
        return `w${opts.length}`
      }),
      remove: vi.fn(),
    }
    const onToken = vi.fn()
    render(<Turnstile siteKey="k" onToken={onToken} resetKey={0} />)
    await act(async () => {})
    expect(opts).toHaveLength(1)
    await act(async () => {
      opts[0]['error-callback']()
    })
    expect(screen.getByText(/Verification could not load\./)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    })
    expect(opts).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    await act(async () => {
      opts[1].callback('tok')
    })
    expect(onToken).toHaveBeenLastCalledWith('tok')
  })

  it('shows the retry message when the script fails to load', async () => {
    const real = document.head.appendChild.bind(document.head)
    vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
      if (node instanceof HTMLScriptElement) {
        queueMicrotask(() => node.onerror?.(new Event('error')))
        return node
      }
      return real(node)
    })
    render(<Turnstile siteKey="k" onToken={() => {}} resetKey={0} />)
    await act(async () => {})
    expect(screen.getByText(/Verification could not load\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
