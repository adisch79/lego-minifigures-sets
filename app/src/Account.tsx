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

type AccountUi = {
  auth: AuthState
  open: boolean
  setOpen: (open: boolean) => void
  pillRef: RefObject<HTMLButtonElement | null>
  stripShown: boolean
  dismissStrip: () => void
}

const AccountContext = createContext<AccountUi | null>(null)

/** Holds the one auth subscription and the popover state shared by the pill and the strip. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [stripDismissed, setStripDismissed] = useState(false)
  const pillRef = useRef<HTMLButtonElement | null>(null)
  const stripShown =
    !stripDismissed && !!auth.linkError && auth.status !== 'disabled' && auth.status !== 'signed-in'
  const dismissStrip = useCallback(() => setStripDismissed(true), [])
  return (
    <AccountContext.Provider value={{ auth, open, setOpen, pillRef, stripShown, dismissStrip }}>
      {children}
    </AccountContext.Provider>
  )
}

function useAccountUi(): AccountUi {
  const ui = useContext(AccountContext)
  if (!ui) throw new Error('Account components need an AccountProvider')
  return ui
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

type Failure = 'invalid' | 'rate' | 'network'

const LIVE_TEXT: Record<Failure | 'sent', string> = {
  sent: 'Check your email. If this address is invited, a sign-in link is on its way.',
  invalid: 'That does not look like an email address.',
  rate: 'Too many requests. Try again in an hour.',
  network: 'Could not reach the server. Check your connection and try again.',
}

/** Email form and the sent confirmation. State resets each time the popover opens. */
function SignInPanel({ onAnnounce }: { onAnnounce: (text: string) => void }) {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<'form' | 'sending' | 'sent'>('form')
  const [failure, setFailure] = useState<Failure | null>(null)
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
    setPhase('sending')
    const result = await requestLink(email)
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
        <p>If this address is invited, a sign-in link is on its way. Open it in this browser.</p>
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
      <button type="submit" className="send" disabled={sending || failure === 'rate'}>
        {label}
      </button>
    </form>
  )
}

function SignedInPanel({ email, onDone }: { email: string; onDone: () => void }) {
  const outRef = useRef<HTMLButtonElement>(null)
  useEffect(() => outRef.current?.focus(), [])
  return (
    <>
      <p className="who">Signed in as</p>
      <p className="full">{email}</p>
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
