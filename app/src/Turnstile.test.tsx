import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Turnstile, turnstileSiteKey } from './Turnstile'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete window.turnstile
})

describe('turnstileSiteKey', () => {
  it('is empty when unset and trimmed when set', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    expect(turnstileSiteKey()).toBe('')
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', ' 0xABC ')
    expect(turnstileSiteKey()).toBe('0xABC')
  })
})

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
})
