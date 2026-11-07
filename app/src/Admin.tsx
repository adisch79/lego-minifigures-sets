// Admin page for story V2-05, approved direction C "Wanted wall" (mockups/V2-05/c.html,
// docs/design/V2-05-admin.md). A ranked wall of what collectors want, plus the allowlist in a
// slide-over. Logic lives in ./admin, network calls in ./adminApi. The gate here is cosmetic:
// the RPCs and the admin-people Edge Function check the admins table again on the server.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import './admin.css'
import {
  ALERT_TEXT,
  PEOPLE_ERROR_TEXT,
  WALL_VIEWS,
  ago,
  buildWall,
  initialOf,
  isTruncated,
  namesLine,
  normaliseEmail,
  personLabel,
  personStatus,
  sortPeople,
  toneMap,
  viewCards,
  viewCounts,
  wantedPerUser,
  type PeopleError,
  type Person,
  type WallView,
  type WantedCard,
} from './admin'
import { changePerson, useAdminData } from './adminApi'
import { AccountControl, LinkErrorStrip, useAccount, useAdminGate } from './Account'
import { DEMO_ADMIN } from './demo'
import { Brand } from './SeriesPage'
import type { Load } from './series'

// Vite base is './', so this stays correct under a Pages sub-path.
const BASE = import.meta.env.BASE_URL

// An empty fragment returns home in place: the query string holding sort and search is untouched.
const HOME_HREF = '#'

// SOURCE: docs/design/V2-05-admin.md "Reads": admin_wanted_list returns at most 5000 rows.
const WANTED_LIMIT = 5000

// Card stagger is capped so a long wall does not keep animating for seconds.
const STAGGER_MS = 40
const STAGGER_MAX = 12

// Avatars shown on a stack before the "+n" bubble.
const STACK_MAX = 3

// A collector with this many wanted marks is shown in red on the allowlist (mockup c, n >= 4).
const HOT_WANTED = 4

// Relative times ("12 min ago") are refreshed once a minute.
const CLOCK_MS = 60_000

// ---------------------------------------------------------------------------------------------
// Small pieces

function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => window.clearInterval(t)
  }, [])
  return now
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ShieldIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8v5M12 16.5v.5" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

function Avatar({ label, tone, ghost = false }: { label: string; tone?: string; ghost?: boolean }) {
  const cls = ghost ? 'aw-av t-ghost' : tone ? `aw-av t-${tone}` : 'aw-av'
  return (
    <span className={cls} aria-hidden="true">
      {initialOf(label)}
    </span>
  )
}

function Stack({ people }: { people: { key: string; label: string; tone?: string }[] }) {
  const extra = people.length - STACK_MAX
  return (
    <span className="aw-stack" aria-hidden="true">
      {people.slice(0, STACK_MAX).map((p) => (
        <Avatar key={p.key} label={p.label} tone={p.tone} />
      ))}
      {extra > 0 && <span className="aw-more">+{extra}</span>}
    </span>
  )
}

/** Header row shared by every state of the page. */
function Band({ children, full = false }: { children?: ReactNode; full?: boolean }) {
  return (
    <header className={full ? 'band band-full' : 'band'}>
      <div className="wrap">
        <div className="band-top">
          <Brand href={HOME_HREF} />
          <span className="aw-tag">Admin</span>
          <a className="back" href={HOME_HREF}>
            <span aria-hidden="true">&larr;</span> <span className="back-t">Back to the vault</span>
          </a>
          <AccountControl />
        </div>
        <LinkErrorStrip />
        {children}
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------------------------
// Gate screens

type GateKind = 'disabled' | 'signed-out' | 'checking' | 'not-admin' | 'error'

function Gate({ kind, onSignIn, onRecheck }: { kind: GateKind; onSignIn: () => void; onRecheck: () => void }) {
  if (kind === 'checking') {
    return (
      <Band full>
        <section className="aw-gate" aria-busy="true">
          <div className="aw-gate-i wait" aria-hidden="true" />
          <h1 tabIndex={-1}>Checking your access</h1>
          <p role="status">One moment while the vault confirms this account is an admin.</p>
        </section>
      </Band>
    )
  }
  const screens: Record<Exclude<GateKind, 'checking'>, { icon: ReactNode; bad?: boolean; title: ReactNode; text: string; action?: ReactNode }> = {
    disabled: {
      icon: <LockIcon />,
      title: 'Admin is off on this build',
      text: 'Sign-in is not configured here, so there is no admin page. Open the published vault to manage collectors.',
    },
    'signed-out': {
      icon: <LockIcon />,
      title: (
        <>
          Sign in to <em>continue</em>
        </>
      ),
      text: 'The admin page is for the owner of this vault. Sign in with the admin address to see what collectors want.',
      action: (
        <button type="button" className="aw-btn" onClick={onSignIn}>
          Sign in
        </button>
      ),
    },
    'not-admin': {
      icon: <ShieldIcon />,
      title: 'Not available',
      text: 'This account is not an admin of the vault. Your own owned and wanted marks are on the series pages.',
    },
    error: {
      icon: <AlertIcon />,
      bad: true,
      title: 'Could not check your access',
      text: 'The server did not answer the admin check. Check your connection and try again.',
      action: (
        <button type="button" className="aw-btn" onClick={onRecheck}>
          Try again
        </button>
      ),
    },
  }
  const s = screens[kind]
  return (
    <Band full>
      <section className="aw-gate">
        <div className={s.bad ? 'aw-gate-i bad' : 'aw-gate-i'}>{s.icon}</div>
        <h1 tabIndex={-1}>{s.title}</h1>
        <p>{s.text}</p>
        <div className="aw-acts">
          {s.action}
          <a className="aw-btn light" href={HOME_HREF}>
            Back to the vault
          </a>
        </div>
      </section>
    </Band>
  )
}

// ---------------------------------------------------------------------------------------------
// The wall

function CardArt({ card }: { card: WantedCard }) {
  const [failed, setFailed] = useState(false)
  const kind = card.artKind ?? 'none'
  const shown = card.art && !failed
  return (
    <div className={`aw-stage k-${shown ? kind : 'none'}`}>
      {shown ? (
        <img src={`${BASE}${card.art}`} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="aw-none">{card.known ? card.name : `No. ${card.targetId}`}</span>
      )}
      <span className="aw-rank" aria-hidden="true">
        {String(card.rank).padStart(2, '0')}
      </span>
      <span
        className={`aw-dot a-${card.worst}`}
        title={`${card.sent} of ${card.collectors.length} ${card.collectors.length === 1 ? 'alert' : 'alerts'} sent`}
      >
        <span>
          <span className="sr">Alert: </span>
          {ALERT_TEXT[card.worst]}
        </span>
      </span>
      {card.kind === 'series' && <span className="aw-whole">Whole series</span>}
    </div>
  )
}

function Card({ card, index, tones, now }: { card: WantedCard; index: number; tones: Map<string, string>; now: number }) {
  const n = card.collectors.length
  return (
    <li
      className={`aw-card a-${card.worst}`}
      style={{ animationDelay: `${Math.min(index, STAGGER_MAX) * STAGGER_MS}ms` }}
    >
      <CardArt card={card} />
      <div className="aw-body">
        <span className="aw-id">
          <span className="sr">Rank {card.rank}, </span>
          {card.targetId}
        </span>
        <h3>{card.name}</h3>
        <span className="aw-ser">{card.sub}</span>
        <div className="aw-foot">
          <Stack
            people={card.collectors.map((c) => ({ key: c.userId, label: c.label, tone: tones.get(c.userId) }))}
          />
          <span className="aw-who">
            <b>
              {n} {n === 1 ? 'collector' : 'collectors'}
            </b>
            <span title={card.collectors.map((c) => c.label).join(', ')}>
              {namesLine(card.collectors.map((c) => c.label))} &middot; {ago(card.latest, now)}
            </span>
          </span>
        </div>
      </div>
    </li>
  )
}

function GhostWall() {
  return (
    <ul className="aw-grid" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="aw-card aw-ghost">
          <div className="aw-stage" />
          <div className="aw-body">
            <div className="ghost-line short" />
            <div className="ghost-line" />
            <div className="ghost-line short" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function WallEmpty({ view }: { view: WallView }) {
  if (view === 'unsent') {
    return (
      <li className="aw-empty">
        <div className="aw-empty-i" aria-hidden="true">
          <CheckIcon />
        </div>
        <b>Every alert went out</b>
        <p>Nothing is pending, failed or held back by the hourly cap right now.</p>
      </li>
    )
  }
  return (
    <li className="aw-empty">
      <div className="aw-empty-i" aria-hidden="true">
        <HeartIcon />
      </div>
      <b>Nobody wants anything yet</b>
      <p>When a collector taps Want on a figure or a whole series, it lands on this wall, ranked by how many ask for it.</p>
    </li>
  )
}

function WallError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="aw-grid">
      <div className="aw-empty bad" role="alert">
        <div className="aw-empty-i" aria-hidden="true">
          <AlertIcon />
        </div>
        <b>{title}</b>
        <p>{message}</p>
        <button type="button" className="again" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Allowlist slide-over

type RowState = { email: string; busy: boolean; error: PeopleError | null }

function PersonRow({
  person,
  index,
  tone,
  wanted,
  isYou,
  now,
  ask,
  onAsk,
  onCancel,
  onRemove,
}: {
  person: Person
  index: number
  tone: string | undefined
  wanted: number
  isYou: boolean
  now: number
  ask: RowState | null
  onAsk: () => void
  onCancel: () => void
  onRemove: () => void
}) {
  const label = personLabel(person)
  const keepRef = useRef<HTMLButtonElement>(null)
  const askId = useId()
  const asking = ask !== null
  useEffect(() => {
    if (asking) keepRef.current?.focus()
  }, [asking])
  return (
    <li className={asking ? 'ap-p ask' : 'ap-p'} style={{ animationDelay: `${Math.min(index, STAGGER_MAX) * 30}ms` }}>
      <div className="ap-line">
        <Avatar label={label} tone={tone} ghost={!person.signedInAt} />
        <span className="ap-t">
          <b>
            {label}
            {person.isAdmin && <em>{isYou ? 'You' : 'Admin'}</em>}
          </b>
          <small title={person.email}>
            <span className="sr">{person.email}, </span>
            {personStatus(person, now)}
          </small>
        </span>
        {wanted > 0 && <span className={wanted >= HOT_WANTED ? 'ap-n hot' : 'ap-n'}>{wanted} wanted</span>}
        {!person.isAdmin && !asking && (
          <button type="button" className="ap-rm" aria-label={`Remove ${person.email}`} data-email={person.email} onClick={onAsk}>
            <XIcon />
          </button>
        )}
      </div>
      {asking && (
        <div className="ap-ask" role="group" aria-labelledby={askId}>
          <p id={askId}>
            Remove <b>{person.email}</b>? Their account and every mark they made
            {wanted > 0 ? `, including ${wanted} wanted,` : ''} are deleted. This cannot be undone.
          </p>
          <div className="ap-ask-b">
            <button ref={keepRef} type="button" className="ap-keep" onClick={onCancel} disabled={ask.busy}>
              Keep
            </button>
            <button type="button" className="ap-del" onClick={onRemove} disabled={ask.busy} aria-busy={ask.busy}>
              {ask.busy && <span className="aw-spin" aria-hidden="true" />}
              {ask.busy ? 'Removing' : 'Remove'}
            </button>
          </div>
          {ask.error && (
            <p className="ap-err" role="alert">
              {PEOPLE_ERROR_TEXT[ask.error]}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function Allowlist({
  open,
  onClose,
  people,
  perUser,
  tones,
  me,
  now,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  people: Person[]
  perUser: Map<string, number>
  tones: Map<string, string>
  me: string | undefined
  now: number
  onChanged: () => Promise<void>
}) {
  const panelRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const msgId = useId()
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [ask, setAsk] = useState<RowState | null>(null)
  const [announce, setAnnounce] = useState('')

  const sorted = useMemo(() => sortPeople(people), [people])
  const signed = sorted.filter((p) => p.signedInAt).length

  // Focus the invite field on open; Escape closes; Tab stays inside the panel.
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = [
        ...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'),
      ]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  // A closed panel forgets a half-made confirm.
  useEffect(() => {
    if (!open) setAsk(null)
  }, [open])

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    if (adding) return
    const clean = normaliseEmail(email)
    if (!clean) {
      setAddMsg({ ok: false, text: PEOPLE_ERROR_TEXT.bad_email })
      inputRef.current?.focus()
      return
    }
    if (people.some((p) => p.email.toLowerCase() === clean)) {
      setAddMsg({ ok: false, text: PEOPLE_ERROR_TEXT.duplicate })
      inputRef.current?.focus()
      return
    }
    setAdding(true)
    setAddMsg(null)
    const res = await changePerson('add', clean)
    if (res.ok) {
      await onChanged()
      setEmail('')
      setAddMsg({ ok: true, text: `Invited ${clean}. They can now ask for a sign-in link.` })
    } else {
      setAddMsg({ ok: false, text: PEOPLE_ERROR_TEXT[res.error] })
    }
    setAdding(false)
    inputRef.current?.focus()
  }

  const cancel = (who: string) => {
    setAsk(null)
    // Back to the X of the same row, which renders again once the confirm is gone.
    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(`button.ap-rm[data-email="${CSS.escape(who)}"]`)?.focus()
    })
  }

  const remove = async (who: string) => {
    setAsk({ email: who, busy: true, error: null })
    const res = await changePerson('remove', who)
    if (res.ok) {
      await onChanged()
      setAsk(null)
      setAnnounce(`Removed ${who}.`)
      inputRef.current?.focus()
    } else {
      setAsk({ email: who, busy: false, error: res.error })
    }
  }

  const badAdd = addMsg !== null && !addMsg.ok

  return (
    <>
      <div className={open ? 'ap-scrim on' : 'ap-scrim'} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        id="ap-panel"
        className={open ? 'ap-panel on' : 'ap-panel'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
      >
        <div className="ap-top">
          <div className="ap-row">
            <div>
              <p className="ap-eyebrow">Allowlist</p>
              <h2 id={titleId}>Invited collectors</h2>
            </div>
            <button type="button" className="ap-x" aria-label="Close allowlist" onClick={onClose}>
              <XIcon />
            </button>
          </div>
          <p>Only these addresses can get a sign-in link. Removing one deletes that collector and their marks.</p>
          <form className="ap-add" onSubmit={invite} noValidate>
            <label className="sr" htmlFor="ap-mail">
              Email to invite
            </label>
            <input
              ref={inputRef}
              id="ap-mail"
              className={badAdd ? 'ap-mail bad' : 'ap-mail'}
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              placeholder="name@example.com"
              value={email}
              aria-invalid={badAdd}
              aria-describedby={addMsg ? msgId : undefined}
              onChange={(e) => {
                setEmail(e.target.value)
                if (badAdd) setAddMsg(null)
              }}
            />
            <button type="submit" className="ap-go" disabled={adding} aria-busy={adding}>
              {adding ? <span className="aw-spin" aria-hidden="true" /> : <PlusIcon />}
              {adding ? 'Inviting' : 'Invite'}
            </button>
          </form>
          {addMsg && (
            <p className={addMsg.ok ? 'ap-msg ok' : 'ap-msg'} id={msgId} role={addMsg.ok ? 'status' : 'alert'}>
              {addMsg.text}
            </p>
          )}
        </div>
        <div className="ap-split">
          <span>
            <b>{signed}</b> signed in
          </span>
          <span>
            <b>{sorted.length - signed}</b> not yet
          </span>
        </div>
        <p className="sr" role="status" aria-live="polite">
          {announce}
        </p>
        {sorted.length === 0 ? (
          <p className="ap-empty">Nobody is invited yet. Add the first address above.</p>
        ) : (
          <ul className="ap-list" aria-label="Invited addresses">
            {sorted.map((p, i) => (
              <PersonRow
                key={p.email}
                person={p}
                index={i}
                tone={p.userId ? tones.get(p.userId) : undefined}
                wanted={p.userId ? (perUser.get(p.userId) ?? 0) : 0}
                isYou={!!me && p.email.toLowerCase() === me.toLowerCase()}
                now={now}
                ask={ask && ask.email === p.email ? ask : null}
                onAsk={() => setAsk({ email: p.email, busy: false, error: null })}
                onCancel={() => cancel(p.email)}
                onRemove={() => void remove(p.email)}
              />
            ))}
          </ul>
        )}
      </aside>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// The page for an admin

function Wall({ load, onRetryCatalog }: { load: Load; onRetryCatalog: () => void }) {
  const { auth } = useAccount()
  const { data, refresh, retry } = useAdminData(true)
  const now = useNow()
  const [view, setView] = useState<WallView>('popular')
  // ?demo=admin&allow opens the panel on load, for screenshots (dev only).
  const [open, setOpen] = useState(() => DEMO_ADMIN && new URLSearchParams(window.location.search).has('allow'))
  const openRef = useRef<HTMLButtonElement>(null)

  const ready = data.status === 'ready' && load.status === 'ready'
  const cards = useMemo(
    () => (data.status === 'ready' && load.status === 'ready' ? buildWall(data.wanted, load.series) : []),
    [data, load],
  )
  const people = useMemo(() => (data.status === 'ready' ? data.people : []), [data])
  const tones = useMemo(() => toneMap(people), [people])
  const perUser = useMemo(() => (data.status === 'ready' ? wantedPerUser(data.wanted) : new Map<string, number>()), [data])
  const counts = viewCounts(cards)
  const shown = viewCards(cards, view)
  const marks = data.status === 'ready' ? data.wanted.length : 0
  const signedIn = sortPeople(people).filter((p) => p.signedInAt)
  const hint = WALL_VIEWS.find((v) => v.value === view)?.hint ?? ''

  const close = useCallback(() => {
    setOpen(false)
    openRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="aw-page">
      <Band>
        <div className="aw-hero">
          <div>
            <p className="aw-eyebrow">Admin &middot; Wanted wall</p>
            <h1 tabIndex={-1}>
              What they <em>want</em>
            </h1>
            {ready ? (
              <ul className="aw-sum" aria-label="Summary">
                <li>
                  <b>{cards.length}</b>wanted
                </li>
                <li>
                  <b>{marks}</b>
                  {marks === 1 ? 'mark' : 'marks'}
                </li>
                <li>
                  <b>{counts.unsent}</b>to check
                </li>
              </ul>
            ) : (
              <p className="aw-sum">
                <span className="aw-sum-wait" aria-hidden="true" />
              </p>
            )}
          </div>
          <button
            ref={openRef}
            type="button"
            className="aw-open"
            aria-controls="ap-panel"
            aria-expanded={open}
            aria-haspopup="dialog"
            disabled={data.status !== 'ready'}
            onClick={() => setOpen(true)}
          >
            <span className="aw-open-l">
              <b>Allowlist</b>
              <small>
                {data.status === 'ready' ? `${people.length} invited · ${signedIn.length} signed in` : 'Loading'}
              </small>
            </span>
            <Stack
              people={signedIn.map((p) => ({
                key: p.email,
                label: personLabel(p),
                tone: p.userId ? tones.get(p.userId) : undefined,
              }))}
            />
          </button>
        </div>
      </Band>

      <main className="wrap">
        {load.status === 'error' ? (
          <div className="aw-bar" />
        ) : (
          <div className="aw-bar" role="group" aria-label="Sort and filter the wall">
            {WALL_VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                className={v.value === 'unsent' ? 'aw-chip warn' : 'aw-chip'}
                aria-pressed={view === v.value}
                disabled={!ready}
                onClick={() => setView(v.value)}
              >
                {v.label} <i>{ready ? counts[v.value] : '–'}</i>
              </button>
            ))}
            <span className="aw-hint" aria-live="polite">
              {hint}
            </span>
          </div>
        )}

        {data.status === 'ready' && isTruncated(data.wanted) && (
          <p className="aw-note" role="note">
            <span className="aw-note-i" aria-hidden="true">
              !
            </span>
            Only the newest {WANTED_LIMIT.toLocaleString('en-GB')} wanted marks are on the wall. Older ones still count for
            their collectors but are not ranked here.
          </p>
        )}

        {load.status === 'error' ? (
          <WallError title="The catalog could not be loaded" message={load.message} onRetry={onRetryCatalog} />
        ) : data.status === 'error' ? (
          <WallError title="The admin lists could not be loaded" message={data.message} onRetry={retry} />
        ) : !ready ? (
          <GhostWall />
        ) : (
          <ul className="aw-grid" aria-label={WALL_VIEWS.find((v) => v.value === view)?.label}>
            {shown.length === 0 ? (
              <WallEmpty view={view} />
            ) : (
              shown.map((c, i) => <Card key={`${view}:${c.key}`} card={c} index={i} tones={tones} now={now} />)
            )}
          </ul>
        )}
      </main>

      {data.status === 'ready' && (
        <Allowlist
          open={open}
          onClose={close}
          people={people}
          perUser={perUser}
          tones={tones}
          me={auth.email}
          now={now}
          onChanged={refresh}
        />
      )}
    </div>
  )
}

/** The #admin page: a gate screen until the account is a confirmed admin, then the wall. */
export default function Admin({ load, onRetry }: { load: Load; onRetry: () => void }) {
  const { auth, openSignIn } = useAccount()
  const { gate, recheck } = useAdminGate()

  let kind: GateKind | null = null
  if (auth.status === 'disabled') kind = 'disabled'
  else if (auth.status === 'signed-out') kind = 'signed-out'
  else if (gate === 'checking') kind = 'checking'
  else if (gate === 'error') kind = 'error'
  else if (gate === 'not-admin') kind = 'not-admin'

  if (kind !== null) {
    return (
      <div className="aw-page">
        <Gate kind={kind} onSignIn={openSignIn} onRecheck={recheck} />
      </div>
    )
  }
  return <Wall load={load} onRetryCatalog={onRetry} />
}
