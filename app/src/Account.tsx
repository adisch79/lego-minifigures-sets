// Sign-in UI, approved direction A "Pocket popover" (mockups/V2-02/a.html).
// An ink pill closes the header row and opens a white popover anchored under it. A red strip
// under the header reports a failed sign-in link. All auth behaviour lives in ./auth.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { requestLink, signOut, useAuth, type AuthState } from './auth'
import { useIsAdmin, type AdminGate } from './adminApi'
import { DEMO, DEMO_AUTH } from './demo'
import { Turnstile, turnstileSiteKey } from './Turnstile'

type AccountUi = {
  auth: AuthState
  open: boolean
  setOpen: (open: boolean) => void
  pillRef: RefObject<HTMLButtonElement | null>
  stripShown: boolean
  dismissStrip: () => void
  /** Story V2-05: admin status, asked once per account and shared by the menu and the admin page. */
  adminGate: AdminGate
  recheckAdmin: () => void
}

const AccountContext = createContext<AccountUi | null>(null)

/** Holds the one auth subscription and the popover state shared by the pill and the strip. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const real = useAuth()
  // Dev-only: ?demo shows a signed-in collector without a session (see ./demo).
  const auth = DEMO ? DEMO_AUTH : real
  const [open, setOpen] = useState(false)
  const [stripDismissed, setStripDismissed] = useState(false)
  const pillRef = useRef<HTMLButtonElement | null>(null)
  // A changed failure (new failure, or cleared by a sign-in) is a new strip: forget the old dismissal.
  useEffect(() => setStripDismissed(false), [auth.linkError])
  const stripShown =
    !stripDismissed && !!auth.linkError && auth.status !== 'disabled'
  const dismissStrip = useCallback(() => setStripDismissed(true), [])
  const { gate: adminGate, recheck: recheckAdmin } = useIsAdmin(auth)
  return (
    <AccountContext.Provider
      value={{ auth, open, setOpen, pillRef, stripShown, dismissStrip, adminGate, recheckAdmin }}
    >
      {children}
    </AccountContext.Provider>
  )
}

function useAccountUi(): AccountUi {
  const ui = useContext(AccountContext)
  if (!ui) throw new Error('Account components need an AccountProvider')
  return ui
}

/** Admin status for the signed-in user, and a way to ask again after a failed check. */
export function useAdminGate(): { gate: AdminGate; recheck: () => void } {
  const { adminGate, recheckAdmin } = useAccountUi()
  return { gate: adminGate, recheck: recheckAdmin }
}

/** Auth state and a way to open the sign-in popover, for pages that react to the session. */
export function useAccount(): { auth: AuthState; openSignIn: () => void } {
  const { auth, setOpen } = useAccountUi()
  const openSignIn = useCallback(() => setOpen(true), [setOpen])
  return { auth, openSignIn }
}

function KeyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8m-3 3 3 3m-6 0 2 2" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6m0 4h.01" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function OfflineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.8a10 10 0 0 1 5-2.6M19 12.8a10 10 0 0 0-2.4-1.7M12 20h.01" />
    </svg>
  )
}

function EnvelopeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d={up ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  )
}

type Failure = 'invalid' | 'rate' | 'network' | 'captcha'

const LIVE_TEXT: Record<Failure | 'sent', string> = {
  sent: 'Check your email for the sign-in link and code.',
  captcha: 'Verification failed, try again.',
  invalid: 'That does not look like an email address.',
  rate: 'Too many requests. Try again in an hour.',
  network: 'Could not reach the server. Check your connection and try again.',
}

/** Email form and the sent confirmation. State resets each time the popover opens. */
function SignInPanel({ onAnnounce }: { onAnnounce: (text: string) => void }) {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<'form' | 'sending' | 'sent'>('form')
  const [failure, setFailure] = useState<Failure | null>(null)
  // Turnstile: token is null until solved; the widget remounts (resetKey) after each send.
  const siteKey = turnstileSiteKey()
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const sentRef = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const inputId = `${id}-email`
  const errId = `${id}-err`

  useEffect(() => {
    if (phase === 'form') inputRef.current?.focus()
    if (phase === 'sent') sentRef.current?.focus()
  }, [phase])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (phase === 'sending' || failure === 'rate') return
    if (siteKey && !token) return
    setPhase('sending')
    const result = await requestLink(email, siteKey ? (token ?? undefined) : undefined)
    // A Turnstile token works once, so ask for a fresh one whatever the result.
    if (siteKey) {
      setToken(null)
      setResetKey((k) => k + 1)
    }
    if (result.ok) {
      setFailure(null)
      setPhase('sent')
      onAnnounce(LIVE_TEXT.sent)
    } else {
      setFailure(result.reason)
      setPhase('form')
      onAnnounce(LIVE_TEXT[result.reason])
    }
  }

  if (phase === 'sent') {
    return (
      <div className="sent">
        <div className="env">
          <EnvelopeIcon />
        </div>
        <h3 ref={sentRef} tabIndex={-1}>
          Check your email
        </h3>
        <p>Check your email for the sign-in link and code. Open the link in this browser.</p>
        <button
          type="button"
          className="linkish"
          onClick={() => {
            setPhase('form')
            onAnnounce('')
          }}
        >
          Use a different address
        </button>
      </div>
    )
  }

  const bad = failure === 'invalid'
  const sending = phase === 'sending'
  const label = sending
    ? 'Sending...'
    : failure === 'rate'
      ? 'Try again later'
      : failure === 'network'
        ? 'Try again'
        : 'Email me a sign-in link'

  return (
    <form onSubmit={submit} noValidate>
      <h3>Sign in</h3>
      <p className="sub">We email you a one-time link. No password.</p>
      {failure === 'rate' && (
        <div className="callout">
          <span className="dot">
            <ClockIcon />
          </span>
          <span>
            <b>Too many requests.</b>Try again in an hour.
          </span>
        </div>
      )}
      {failure === 'network' && (
        <div className="callout red">
          <span className="dot">
            <OfflineIcon />
          </span>
          <span>
            <b>Could not reach the server.</b>Check your connection and try again.
          </span>
        </div>
      )}
      {failure === 'captcha' && (
        <div className="callout red">
          <span className="dot">
            <WarnIcon />
          </span>
          <span>
            <b>Verification failed, try again.</b>
          </span>
        </div>
      )}
      <label className="f" htmlFor={inputId}>
        Email address
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        placeholder="you@example.com"
        value={email}
        className={bad ? 'bad' : undefined}
        aria-invalid={bad || undefined}
        aria-describedby={bad ? errId : undefined}
        onChange={(e) => {
          setEmail(e.target.value)
          if (failure === 'invalid') setFailure(null)
        }}
      />
      {bad && (
        <p className="msg" id={errId}>
          <WarnIcon />
          That does not look like an email address.
        </p>
      )}
      {siteKey && <Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetKey} />}
      <button type="submit" className="send" disabled={sending || failure === 'rate' || (!!siteKey && !token)}>
        {label}
      </button>
    </form>
  )
}

function AdminIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function SignedInPanel({ email, onDone }: { email: string; onDone: () => void }) {
  const outRef = useRef<HTMLButtonElement>(null)
  const { adminGate } = useAccountUi()
  useEffect(() => outRef.current?.focus(), [])
  return (
    <>
      <p className="who">Signed in as</p>
      <p className="full">{email}</p>
      {adminGate === 'admin' && (
        <a className="adm-link" href="#admin" onClick={onDone}>
          <AdminIcon />
          <span>
            <b>Admin</b>
            <small>Wanted wall and collectors</small>
          </span>
        </a>
      )}
      <button
        ref={outRef}
        type="button"
        className="out"
        onClick={async () => {
          try {
            await signOut()
          } finally {
            onDone()
          }
        }}
      >
        Sign out
      </button>
    </>
  )
}

/** Header control: Sign in pill or the signed-in chip, each with its popover. */
export function AccountControl() {
  const { auth, open, setOpen, pillRef } = useAccountUi()
  const rootRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')
  const popId = useId()

  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false)
      setAnnouncement('')
      if (refocus) pillRef.current?.focus()
    },
    [setOpen, pillRef],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(true)
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close])

  if (auth.status === 'disabled') return null
  if (auth.status === 'loading') {
    return (
      <div className="acct" role="status" aria-busy="true" aria-label="Loading account">
        <span className="acct-wait" aria-hidden="true" />
      </div>
    )
  }

  const signedIn = auth.status === 'signed-in' && !!auth.email
  const email = auth.email ?? ''
  const toggle = () => (open ? close(false) : setOpen(true))

  return (
    <div className="acct" ref={rootRef}>
      {signedIn ? (
        <button
          ref={pillRef}
          type="button"
          className={`me${open ? ' open' : ''}`}
          aria-expanded={open}
          aria-controls={popId}
          aria-label={`Account, signed in as ${email}`}
          title={email}
          onClick={toggle}
        >
          <span className="av" aria-hidden="true">
            {email.charAt(0).toUpperCase()}
          </span>
          <span className="addr" aria-hidden="true">
            {email}
          </span>
          <Chevron up={open} />
        </button>
      ) : (
        <button
          ref={pillRef}
          type="button"
          className={`pill-in${open ? ' open' : ''}`}
          aria-expanded={open}
          aria-controls={popId}
          onClick={toggle}
        >
          <KeyIcon />
          <span className="t">Sign in</span>
        </button>
      )}
      <p className="sr" role="status" aria-live="polite">
        {announcement}
      </p>
      {open && (
        <div
          className={`pop${signedIn ? ' pop-me' : ''}`}
          id={popId}
          role="dialog"
          aria-label={signedIn ? 'Account' : 'Sign in'}
        >
          {signedIn ? (
            <SignedInPanel email={email} onDone={() => close(true)} />
          ) : (
            <SignInPanel onAnnounce={setAnnouncement} />
          )}
        </div>
      )}
    </div>
  )
}

/** Red strip under the header after a sign-in link failed. */
export function LinkErrorStrip() {
  const { auth, stripShown, dismissStrip, setOpen, pillRef } = useAccountUi()
  if (auth.pendingLink && auth.status !== 'loading' && auth.status !== 'disabled') {
    // V2-16: a mail link is used only after this click (no sign-in on page load).
    const switching = auth.status === 'signed-in'
    return (
      <div className="linkgo" role="status" aria-label="Sign-in link">
        <p>
          {switching
            ? `You are signed in as ${auth.email}. Continue to switch to the account from the email link.`
            : 'Your sign-in link is ready.'}
        </p>
        <button type="button" className="send" onClick={() => void auth.continueLink?.()}>
          Continue sign-in
        </button>
        {switching && (
          <button type="button" className="linkgo-keep" onClick={() => auth.dismissLink?.()}>
            Keep current account
          </button>
        )}
      </div>
    )
  }
  if (!stripShown) return null
  return (
    <div className="linkbar" role="alert">
      <div className="wrap">
        <span>{auth.linkError}</span>
        <button
          type="button"
          onClick={() => {
            dismissStrip()
            setOpen(true)
          }}
        >
          Send a new link
        </button>
        <button
          type="button"
          className="x"
          aria-label="Dismiss"
          onClick={() => {
            dismissStrip()
            pillRef.current?.focus()
          }}
        >
          &times;
        </button>
      </div>
    </div>
  )
}
