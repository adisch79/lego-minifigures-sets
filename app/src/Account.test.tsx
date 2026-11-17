import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState, LinkResult } from './auth'

const authState: { current: AuthState } = { current: { status: 'signed-out' } }
const requestLink = vi.fn<(email: string, token?: string) => Promise<LinkResult>>()
const signOut = vi.fn<() => Promise<void>>()

vi.mock('./auth', () => ({
  authEnabled: true,
  useAuth: () => authState.current,
  requestLink: (email: string, token?: string) => requestLink(email, token),
  signOut: () => signOut(),
}))

import { AccountControl, AccountProvider, LinkErrorStrip } from './Account'

function renderAccount(state: AuthState) {
  authState.current = state
  return render(
    <AccountProvider>
      <header>
        <AccountControl />
        <LinkErrorStrip />
      </header>
      <main>
        <p>Outside</p>
      </main>
    </AccountProvider>,
  )
}

function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  return screen.getByRole('dialog', { name: 'Sign in' })
}

async function submitWith(address: string, result: LinkResult) {
  requestLink.mockResolvedValueOnce(result)
  openPopover()
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: address } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))
  })
}

beforeEach(() => {
  requestLink.mockReset()
  signOut.mockReset()
  signOut.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('Account', () => {
  it('renders nothing when auth is disabled', () => {
    const { container } = renderAccount({ status: 'disabled' })
    expect(container.querySelector('.acct')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a placeholder while the session loads', () => {
    const { container } = renderAccount({ status: 'loading' })
    expect(container.querySelector('.acct-wait')).not.toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a closed Sign in pill when signed out', () => {
    renderAccount({ status: 'signed-out' })
    const pill = screen.getByRole('button', { name: 'Sign in' })
    expect(pill.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the email form with focus in the field', () => {
    renderAccount({ status: 'signed-out' })
    const dialog = openPopover()
    const pill = screen.getByRole('button', { name: 'Sign in' })
    expect(pill.getAttribute('aria-expanded')).toBe('true')
    expect(pill.getAttribute('aria-controls')).toBe(dialog.id)
    expect(document.activeElement).toBe(screen.getByLabelText('Email address'))
    expect(screen.getByText('We email you a one-time link. No password.')).toBeTruthy()
  })

  it('submits the typed address and shows the sent state', async () => {
    renderAccount({ status: 'signed-out' })
    await submitWith('fan@example.com', { ok: true })
    expect(requestLink).toHaveBeenCalledWith('fan@example.com', undefined)
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeTruthy()
    expect(
      screen.getByText('Check your email for the sign-in link and code. Open the link in this browser.'),
    ).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Check your email')
    fireEvent.click(screen.getByRole('button', { name: 'Use a different address' }))
    expect(screen.getByLabelText('Email address')).toBeTruthy()
  })

  it('marks a bad address and links the message to the field', async () => {
    renderAccount({ status: 'signed-out' })
    await submitWith('lego fan@gmail', { ok: false, reason: 'invalid' })
    const input = screen.getByLabelText('Email address')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const err = document.getElementById(input.getAttribute('aria-describedby') ?? '')
    expect(err?.textContent).toBe('That does not look like an email address.')
    expect(screen.getByRole('status').textContent).toBe('That does not look like an email address.')
  })

  it('disables sending after a rate limit', async () => {
    renderAccount({ status: 'signed-out' })
    await submitWith('fan@example.com', { ok: false, reason: 'rate' })
    expect(screen.getByText('Too many requests.')).toBeTruthy()
    expect(document.querySelector('.callout')?.textContent).toBe('Too many requests.Try again in an hour.')
    const send = screen.getByRole('button', { name: 'Try again later' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
  })

  it('keeps the address and offers a retry after a network failure', async () => {
    renderAccount({ status: 'signed-out' })
    await submitWith('fan@example.com', { ok: false, reason: 'network' })
    expect(screen.getByText('Could not reach the server.')).toBeTruthy()
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe('fan@example.com')
    requestLink.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(requestLink).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeTruthy()
  })

  it('shows a verification message after a captcha failure', async () => {
    renderAccount({ status: 'signed-out' })
    await submitWith('fan@example.com', { ok: false, reason: 'captcha' })
    expect(document.querySelector('.callout.red')?.textContent).toBe('Verification failed, try again.')
    expect(screen.getByRole('status').textContent).toBe('Verification failed, try again.')
  })

  it('closes on Escape and returns focus to the pill', () => {
    renderAccount({ status: 'signed-out' })
    openPopover()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sign in' }))
  })

  it('closes on an outside click', () => {
    renderAccount({ status: 'signed-out' })
    openPopover()
    fireEvent.pointerDown(screen.getByText('Outside'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the signed-in chip and the menu with Sign out', async () => {
    renderAccount({ status: 'signed-in', email: 'minifig@example.com' })
    const chip = screen.getByRole('button', { name: 'Account, signed in as minifig@example.com' })
    expect(chip.textContent).toContain('M')
    fireEvent.click(chip)
    expect(screen.getByRole('dialog', { name: 'Account' })).toBeTruthy()
    expect(screen.getByText('Signed in as')).toBeTruthy()
    const out = screen.getByRole('button', { name: 'Sign out' })
    expect(document.activeElement).toBe(out)
    await act(async () => {
      fireEvent.click(out)
    })
    expect(signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('shows the expired-link strip, which reopens the popover', () => {
    const msg = 'That sign-in link has expired. Ask for a new one.'
    renderAccount({ status: 'signed-out', linkError: msg })
    expect(screen.getByRole('alert').textContent).toContain(msg)
    fireEvent.click(screen.getByRole('button', { name: 'Send a new link' }))
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('dismisses the strip with the close button', () => {
    renderAccount({ status: 'signed-out', linkError: 'That sign-in link has expired. Ask for a new one.' })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Continue sign-in panel (V2-16)', () => {
  const continueLink = vi.fn<() => Promise<void>>()
  const dismissLink = vi.fn<() => void>()
  beforeEach(() => {
    continueLink.mockReset().mockResolvedValue(undefined)
    dismissLink.mockReset()
  })

  it('shows a Continue sign-in button and calls continueLink on click', () => {
    renderAccount({ status: 'signed-out', pendingLink: true, continueLink, dismissLink })
    expect(continueLink).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue sign-in' }))
    expect(continueLink).toHaveBeenCalledTimes(1)
  })
  it('names the current account when signed in and offers Keep current account', () => {
    renderAccount({ status: 'signed-in', email: 'a@b.co', pendingLink: true, continueLink, dismissLink })
    expect(
      screen.getByText(
        'You are signed in as a@b.co. Continue to switch to the account from the email link.',
      ),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep current account' }))
    expect(dismissLink).toHaveBeenCalledTimes(1)
    expect(continueLink).not.toHaveBeenCalled()
  })
  it('shows the failure message after the link failed', () => {
    renderAccount({ status: 'signed-out', linkError: 'That sign-in link did not work. Ask for a new one.' })
    expect(screen.getByRole('alert').textContent).toContain('did not work')
    expect(screen.queryByRole('button', { name: 'Continue sign-in' })).toBeNull()
  })
  it('shows nothing extra without a pending link', () => {
    renderAccount({ status: 'signed-out' })
    expect(screen.queryByRole('button', { name: 'Continue sign-in' })).toBeNull()
  })
})

describe('Account with Turnstile configured', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete window.turnstile
  })

  it('holds the send button until solved, passes the token, then asks for a fresh one', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key')
    let cb: (t: string) => void = () => {}
    const render_ = vi.fn((_el: HTMLElement, o: { callback: (t: string) => void }) => {
      cb = o.callback
      return 'w' + render_.mock.calls.length
    })
    window.turnstile = { render: render_, remove: vi.fn() } as unknown as typeof window.turnstile
    renderAccount({ status: 'signed-out' })
    requestLink.mockResolvedValueOnce({ ok: true })
    openPopover()
    await act(async () => {})
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'new@example.com' } })
    const send = screen.getByRole('button', { name: 'Email me a sign-in link' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    act(() => cb('tok-1'))
    expect(send.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(send)
    })
    expect(requestLink).toHaveBeenCalledWith('new@example.com', 'tok-1')
    fireEvent.click(screen.getByRole('button', { name: 'Use a different address' }))
    await act(async () => {})
    expect(render_).toHaveBeenCalledTimes(2)
  })
})
