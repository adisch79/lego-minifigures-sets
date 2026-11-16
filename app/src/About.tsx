// Story V2-15 PR 1: the About page, approved direction C "The collector's story" (mockups/V2-15/c.html).
// Dark story column on the left, two numbered chapters on the right: 01 Support the site, 02 Write to me.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Load } from './series'
import { AccountControl } from './Account'
import { Brand } from './SeriesPage'
import Stats from './Stats'
import { KOFI_URL } from './kofi'
import { Turnstile, turnstileSiteKey } from './Turnstile'
import {
  MESSAGE_MAX,
  codePoints,
  contactEnabled,
  sendContact,
  validateContact,
  type ContactErrors,
  type ContactFields,
  type ContactInput,
  type ContactResult,
} from './contactApi'

// Vite base is './', so this stays correct under a Pages sub-path.
const BASE = import.meta.env.BASE_URL
const HOME_HREF = '#'

// SOURCE: mockups/V2-15/c.html (owner-approved direction C). Cut-outs already in site/img/,
// chosen for the coffee and collector theme. No bag art and no LEGO logo (decisions.md, V2-16).
const FIGURES = [
  { src: 'img/71052/71052-5.webp', name: 'Boba Cup Fan' },
  { src: 'img/71004/71004-10.webp', name: 'Larry the Barista' },
  { src: 'img/71001/71001-1.webp', name: 'Librarian' },
]

function CupIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V9Z" />
      <path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path className="steam" d="M8 2.8c-.8 1 .8 2 0 3.2M12 2.8c-.8 1 .8 2 0 3.2" />
    </svg>
  )
}

/** The coffee card. `url` empty: a disabled "Coming soon" button. Set: a link that opens in a new tab. */
export function Coffee({ url = KOFI_URL }: { url?: string }) {
  const live = url !== ''
  return (
    <div className={live ? 'ab-coffee ab-coffee-live' : 'ab-coffee'}>
      <div>
        <b>Buy me a coffee</b>
        <small>
          {live
            ? 'Opens a secure payment page in a new tab.'
            : 'The payment page is being set up. The button goes live as soon as it is ready.'}
        </small>
      </div>
      {live ? (
        <a className="ab-live" href={url} target="_blank" rel="noopener noreferrer">
          <CupIcon />
          Buy me a coffee
          <span className="sr"> (opens in a new tab)</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </a>
      ) : (
        <button className="ab-soon" type="button" disabled>
          <CupIcon />
          Coming soon
        </button>
      )}
    </div>
  )
}

// SOURCE: docs/design/V2-15-about-contact.md "Contact form" (privacy line verbatim, state texts).
const PRIVACY =
  'Your email is used only to answer you. It is not shown, shared or added to a list. Messages are kept for up to a year. To stop spam, a scrambled form of your network address is kept for one hour.'
const RATE_LIMITED = 'Too many messages from here. Try again later.'
const SEND_FAILED = 'Could not send. Try again.'
const NEED_CHECK = 'Complete the human check next to Send first.'
// Length of the quoted message on the thank-you card.
const PREVIEW_MAX = 140

const EMPTY: ContactFields = { name: '', email: '', message: '' }

type Phase = 'idle' | 'sending' | 'sent' | 'rate_limited' | 'error'
type Receipt = { name: string; email: string; preview: string }

function preview(message: string): string {
  const cps = Array.from(message.trim())
  return cps.length > PREVIEW_MAX ? `${cps.slice(0, PREVIEW_MAX).join('').trimEnd()}...` : cps.join('')
}

function SendIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 3 10 14" />
      <path d="m21 3-7 18-4-7-7-4 18-7Z" />
    </svg>
  )
}

/**
 * Chapter 02 form. `send` is injectable for tests. The Turnstile widget remounts (resetKey) after every
 * send, whatever the result, as a token works once. Nothing here logs the email or the message.
 */
export function ContactForm({
  siteKey,
  send = sendContact,
}: {
  siteKey: string
  send?: (input: ContactInput) => Promise<ContactResult>
}) {
  const id = useId()
  const [fields, setFields] = useState<ContactFields>(EMPTY)
  // Errors show after the first Send, then follow every keystroke.
  const [checked, setChecked] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [needCheck, setNeedCheck] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const sending = useRef(false)
  const live = useRef(true)
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const thanksRef = useRef<HTMLHeadingElement>(null)
  // Where focus goes after the next render: the thank-you heading or the first field.
  const focusNext = useRef<'thanks' | 'form' | null>(null)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  useEffect(() => {
    if (focusNext.current === 'thanks') thanksRef.current?.focus()
    if (focusNext.current === 'form') nameRef.current?.focus()
    focusNext.current = null
  }, [phase])

  const errors: ContactErrors = checked ? validateContact(fields) : {}
  const count = codePoints(fields.message)

  const onToken = (t: string | null) => {
    setToken(t)
    if (t) setNeedCheck(false)
  }

  const set = (key: keyof ContactFields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (sending.current) return
    setChecked(true)
    const errs = validateContact(fields)
    if (errs.name || errs.email || errs.message) {
      setPhase('idle')
      ;(errs.name ? nameRef : errs.email ? emailRef : messageRef).current?.focus()
      return
    }
    if (!token) {
      setPhase('idle')
      setNeedCheck(true)
      return
    }
    sending.current = true
    setPhase('sending')
    const result = await send({ ...fields, captchaToken: token })
    sending.current = false
    if (!live.current) return
    // A used token is spent whatever the answer: drop it and ask the widget for a new one.
    setToken(null)
    setResetKey((k) => k + 1)
    if (result === 'sent') {
      setReceipt({ name: fields.name.trim(), email: fields.email.trim(), preview: preview(fields.message) })
      setFields(EMPTY)
      setChecked(false)
      focusNext.current = 'thanks'
      setPhase('sent')
    } else {
      setPhase(result === 'rate_limited' ? 'rate_limited' : 'error')
    }
  }

  if (phase === 'sent' && receipt) {
    return (
      <div className="ab-sent" role="status">
        <span className="tick" aria-hidden="true">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div>
          <h3 ref={thanksRef} tabIndex={-1}>
            {receipt.name ? `Thanks, ${receipt.name}. Message received.` : 'Thanks. Message received.'}
          </h3>
          <p>
            I will answer at <strong>{receipt.email}</strong>.
          </p>
          <blockquote>{receipt.preview}</blockquote>
          <button
            className="linkish"
            type="button"
            onClick={() => {
              setReceipt(null)
              focusNext.current = 'form'
              setPhase('idle')
            }}
          >
            Send another message
          </button>
        </div>
      </div>
    )
  }

  const busy = phase === 'sending'
  const over = count > MESSAGE_MAX
  const ids = {
    name: `${id}-name`,
    email: `${id}-email`,
    message: `${id}-message`,
    count: `${id}-count`,
  }
  const describe = (key: keyof ContactFields, extra?: string) =>
    [errors[key] ? `${ids[key]}-err` : '', extra ?? ''].filter(Boolean).join(' ') || undefined

  return (
    <form className="cf" onSubmit={onSubmit} noValidate aria-busy={busy}>
      <div className="cf-row">
        <div className="cf-fld">
          <label className="cf-lbl" htmlFor={ids.name}>
            Your name <i>optional</i>
          </label>
          <input
            ref={nameRef}
            id={ids.name}
            className="cf-in"
            type="text"
            value={fields.name}
            onChange={set('name')}
            placeholder="What should I call you?"
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describe('name')}
          />
          {errors.name && (
            <span className="cf-err" id={`${ids.name}-err`}>
              {errors.name}
            </span>
          )}
        </div>
        <div className="cf-fld">
          <label className="cf-lbl" htmlFor={ids.email}>
            Your email <i>for the reply</i>
          </label>
          <input
            ref={emailRef}
            id={ids.email}
            className="cf-in"
            type="email"
            value={fields.email}
            onChange={set('email')}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describe('email')}
          />
          {errors.email && (
            <span className="cf-err" id={`${ids.email}-err`}>
              {errors.email}
            </span>
          )}
        </div>
      </div>
      <div className="cf-fld">
        <label className="cf-lbl" htmlFor={ids.message}>
          Message
        </label>
        {/* No maxLength: the browser counts UTF-16 units, the server counts code points. */}
        <textarea
          ref={messageRef}
          id={ids.message}
          className="cf-in"
          rows={6}
          value={fields.message}
          onChange={set('message')}
          placeholder="A missing figure, a wrong name, an idea for the site..."
          required
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describe('message', ids.count)}
        />
        <div className="cf-under">
          {errors.message ? (
            <span className="cf-err" id={`${ids.message}-err`}>
              {errors.message}
            </span>
          ) : (
            <span />
          )}
          <span className={over ? 'cf-count over' : 'cf-count'} id={ids.count}>
            {count} / {MESSAGE_MAX}
          </span>
        </div>
      </div>

      {(phase === 'rate_limited' || phase === 'error') && (
        <p className="cf-alert" role="alert">
          {phase === 'rate_limited' ? RATE_LIMITED : SEND_FAILED}
        </p>
      )}

      <div className="cf-foot">
        <div className="cf-ts">
          <Turnstile siteKey={siteKey} onToken={onToken} resetKey={resetKey} action="contact" />
          {needCheck && (
            <p className="cf-err" role="alert">
              {NEED_CHECK}
            </p>
          )}
        </div>
        <button type="submit" className="cf-go" disabled={busy}>
          {busy ? <span className="cf-spin" aria-hidden="true" /> : <SendIcon />}
          <span>{busy ? 'Sending...' : 'Send'}</span>
        </button>
      </div>
      <p className="cf-priv">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
        </svg>
        <span>{PRIVACY}</span>
      </p>
    </form>
  )
}

/** Chapter 02 until the form ships (V2-15 step 2): says when, never pretends to send. */
function WriteSoon() {
  return (
    <div className="ab-wait">
      <span className="ab-wait-ico" aria-hidden="true">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      </span>
      <div>
        <strong>The contact form opens soon</strong>
        <p>It is being set up and goes live shortly. Until then, thanks for your patience.</p>
      </div>
    </div>
  )
}

export default function About({ load }: { load: Load }) {
  return (
    <div className="ab-split">
      <section className="ab-ink" aria-labelledby="about-title">
        <Brand href={HOME_HREF} />
        <p className="eyebrow">About</p>
        <h1 id="about-title" tabIndex={-1}>
          One collector.
          <br />
          <em>Every figure.</em>
        </h1>
        <p>
          Minifig Hunt started as a list I kept for myself: which series came out when, which figure
          was in which bag, which ones I still needed.
        </p>
        <p>
          It grew into this site, <strong>every Collectible Minifigures series since 2010</strong>,
          each figure shown on its own, with a way to mark what you own and what you are still
          hunting.
        </p>
        <p>It is free, it has no ads, and it is built and kept up to date by one person in the evenings.</p>
        <p className="sig">Happy hunting.</p>
        {/* Only real numbers: hidden while the catalog loads or after a load error. */}
        {load.status === 'ready' && load.series.length > 0 && <Stats series={load.series} />}
        <div className="ab-figs" aria-hidden="true">
          {FIGURES.map((f, i) => (
            <img
              key={f.src}
              src={`${BASE}${f.src}`}
              alt=""
              title={f.name}
              style={{ animationDelay: `${300 + i * 120}ms` }}
            />
          ))}
        </div>
      </section>

      <div className="ab-right">
        <div className="ab-top">
          <a className="back" href={HOME_HREF}>
            <span aria-hidden="true">&larr;</span> <span className="back-t">All series</span>
          </a>
          <AccountControl />
        </div>

        <section className="ab-ch" id="support" aria-labelledby="support-title">
          <div className="no">
            <span aria-hidden="true">01</span>
            <h2 id="support-title" tabIndex={-1}>
              Support the site
            </h2>
          </div>
          <p>
            Hosting, the domain and the hours spent adding each new wave are paid out of my own
            pocket. If Minifig Hunt saved you a trip or a duplicate, a coffee helps keep it free for
            everyone.
          </p>
          <Coffee />
          <p className="ab-fine">Payments are handled by Ko-fi, never by this site.</p>
        </section>

        <section className="ab-ch" id="write" aria-labelledby="write-title">
          <div className="no">
            <span aria-hidden="true">02</span>
            <h2 id="write-title" tabIndex={-1}>
              Write to me
            </h2>
          </div>
          <p>
            Found a wrong name or picture, or missing a series? Tell me. I read everything and answer
            by email.
          </p>
          {/* Live only with VITE_CONTACT_ENABLED and a Turnstile key; otherwise no widget script loads. */}
          {contactEnabled() ? <ContactForm siteKey={turnstileSiteKey()} /> : <WriteSoon />}
        </section>
      </div>
    </div>
  )
}
