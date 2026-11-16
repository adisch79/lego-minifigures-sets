import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Turnstile } from './Turnstile'

type Opts = { callback: (t: string) => void; 'error-callback': () => void }

afterEach(() => {
  cleanup()
  delete window.turnstile
  vi.restoreAllMocks()
})

describe('Turnstile', () => {
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
