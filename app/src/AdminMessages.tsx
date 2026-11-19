// Admin "Messages" view for story V2-15, approved direction A "Inbox and reader"
// (mockups/V2-15-messages/a.html, docs/design/V2-15-about-contact.md "Admin page"). A list on the
// left, the open message in a reading pane on the right; on a phone the open message unfolds under
// its row. Logic lives in ./messagesLogic, network calls in ./messagesApi. Message text is rendered
// as React text only, after bidi control characters are stripped.
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import type { MessagesData } from './messagesApi'
import {
  ACTION_ERROR_TEXT,
  MESSAGES_LIMIT,
  cleanText,
  filterMessages,
  firstSelection,
  mailtoHref,
  nextAfterDelete,
  senderLabel,
  shortWhen,
  sinceLast,
  stamp,
  toneOf,
  unreadCount,
  type ContactMessage,
  type MessageFilter,
} from './messagesLogic'
import { ago } from './adminLogic'

// SOURCE: mockups/V2-15-messages/a.html "@media (max-width:640px)": the phone layout breakpoint.
const PHONE_QUERY = '(max-width: 640px)'

// Row stagger, capped so a long list does not keep animating (mockup a.html uses 35ms per row).
const ROW_STAGGER_MS = 35
const ROW_STAGGER_MAX = 12

// Skeleton rows shown while the list loads.
const GHOST_ROWS = 6

// ---------------------------------------------------------------------------------------------
// Small pieces

function subscribePhone(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia(PHONE_QUERY)
  mq.addEventListener?.('change', onChange)
  return () => mq.removeEventListener?.('change', onChange)
}

function isPhone(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches
}

/** True on a phone-width screen; follows resizes. */
export function usePhone(): boolean {
  return useSyncExternalStore(subscribePhone, isPhone, () => false)
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

function BinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 6 6v5" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

function BigCheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
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

function Av({ m, big = false }: { m: ContactMessage; big?: boolean }) {
  const tone = toneOf(m.email)
  const label = senderLabel(m)
  return (
    <span className={`aw-av${tone ? ` ${tone}` : ''}${big ? ' big' : ''}`} aria-hidden="true">
      {(label.charAt(0) || '?').toUpperCase()}
    </span>
  )
}

// ---------------------------------------------------------------------------------------------
// View switch in the hero, shared by the wall and the inbox

export type AdminView = 'wall' | 'messages'

/** Two-way pill: Wanted wall / Messages, with the unread count as a red badge. */
export function ViewSwitch({ view, unread, onChange }: { view: AdminView; unread: number; onChange: (v: AdminView) => void }) {
  return (
    <div className="ma-switch" role="group" aria-label="Admin view">
      <button type="button" aria-pressed={view === 'wall'} onClick={() => onChange('wall')}>
        Wanted wall
      </button>
      <button
        type="button"
        aria-pressed={view === 'messages'}
        aria-label={unread > 0 ? `Messages, ${unread} unread` : undefined}
        onClick={() => onChange('messages')}
      >
        Messages
        {unread > 0 && <i aria-hidden="true">{unread}</i>}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Hero

/** The yellow hero of the Messages view: title, counts and the view switch. */
export function MessagesHero({ data, now, switcher }: { data: MessagesData; now: number; switcher: ReactNode }) {
  const list = data.status === 'ready' ? data.messages : []
  const last = list[0]
  return (
    <div className="aw-hero">
      <div>
        <p className="aw-eyebrow">Admin &middot; Messages</p>
        <h1 tabIndex={-1}>
          What they <em>say</em>
        </h1>
        {data.status === 'ready' ? (
          <ul className="aw-sum" aria-label="Summary">
            <li>
              <b>{list.length}</b>
              {list.length === 1 ? 'message' : 'messages'}
            </li>
            <li>
              <b>{unreadCount(list)}</b>unread
            </li>
            {last && (
              <li>
                <b>{sinceLast(last.createdAt, now)}</b>since the last one
              </li>
            )}
          </ul>
        ) : (
          <p className="aw-sum">
            <span className="aw-sum-wait" aria-hidden="true" />
          </p>
        )}
      </div>
      <div className="ma-hero-r">{switcher}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Reader: the open message, in the side pane (desktop) or folded under its row (phone)

type Ask = { busy: boolean; error: boolean }

function Actions({
  m,
  pos,
  total,
  onMarkRead,
  onDelete,
}: {
  m: ContactMessage
  pos: number
  total: number
  onMarkRead: (id: number) => Promise<boolean>
  onDelete: (id: number) => Promise<boolean>
}) {
  const [ask, setAsk] = useState<Ask | null>(null)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState(false)
  const keepRef = useRef<HTMLButtonElement>(null)
  const delRef = useRef<HTMLButtonElement>(null)
  const askId = useId()
  const asking = ask !== null

  useEffect(() => {
    if (asking) keepRef.current?.focus()
  }, [asking])

  const markRead = async () => {
    setReading(true)
    setReadError(false)
    const ok = await onMarkRead(m.id)
    setReading(false)
    if (!ok) setReadError(true)
  }

  const keep = () => {
    setAsk(null)
    window.requestAnimationFrame(() => delRef.current?.focus())
  }

  const remove = async () => {
    setAsk({ busy: true, error: false })
    const ok = await onDelete(m.id)
    // On success the parent drops this message and this component unmounts.
    if (!ok) setAsk({ busy: false, error: true })
  }

  if (ask) {
    return (
      <div className="ma-acts">
        <div className="ma-ask" role="group" aria-labelledby={askId}>
          <p id={askId}>
            Delete this message from <b>{senderLabel(m)}</b>? It cannot be brought back.
          </p>
          <div className="ap-ask-b">
            <button ref={keepRef} type="button" className="ap-keep" onClick={keep} disabled={ask.busy}>
              Keep
            </button>
            <button type="button" className="ap-del" onClick={() => void remove()} disabled={ask.busy} aria-busy={ask.busy}>
              {ask.busy ? <span className="aw-spin" aria-hidden="true" /> : <BinIcon />}
              {ask.busy ? 'Deleting' : 'Delete message'}
            </button>
          </div>
          {ask.error && (
            <p className="ma-err" role="alert">
              {ACTION_ERROR_TEXT.delete}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ma-acts">
      {m.readAt !== null ? (
        <span className="ma-done">
          <CheckIcon />
          Read
        </span>
      ) : (
        <button type="button" className="aw-btn" onClick={() => void markRead()} disabled={reading} aria-busy={reading}>
          {reading ? <span className="aw-spin" aria-hidden="true" /> : <CheckIcon />}
          Mark read
        </button>
      )}
      <button ref={delRef} type="button" className="aw-btn ma-del" onClick={() => setAsk({ busy: false, error: false })}>
        <BinIcon />
        Delete
      </button>
      <span className="sp" />
      <span className="ma-pos">
        {pos} of {total}
      </span>
      {readError && (
        <p className="ma-err" role="alert">
          {ACTION_ERROR_TEXT.read}
        </p>
      )}
    </div>
  )
}

function Reader({
  m,
  pos,
  total,
  now,
  fold,
  onMarkRead,
  onDelete,
}: {
  m: ContactMessage
  pos: number
  total: number
  now: number
  fold: boolean
  onMarkRead: (id: number) => Promise<boolean>
  onDelete: (id: number) => Promise<boolean>
}) {
  const email = cleanText(m.email)
  // On a phone the row of an unnamed sender already shows the address, so the fold says
  // "Reply by email" instead of repeating it; the link name still carries the address.
  const short = fold && !m.name
  const mail = (
    <a className="ma-mail" href={mailtoHref(m.email)} aria-label={short ? `Reply to ${email}` : undefined}>
      <ReplyIcon />
      {short ? (
        'Reply by email'
      ) : (
        <>
          <span className="sr">Reply to </span>
          {email}
        </>
      )}
    </a>
  )
  // key on the id: a half-made confirm or an error never carries over to another message.
  const acts = <Actions key={m.id} m={m} pos={pos} total={total} onMarkRead={onMarkRead} onDelete={onDelete} />
  if (fold) {
    return (
      <div className="ma-fold">
        {mail}
        <p className="ma-body">{cleanText(m.message)}</p>
        {acts}
      </div>
    )
  }
  return (
    <article className="ma-read desk" aria-labelledby={`ma-h-${m.id}`}>
      <div className="ma-read-h">
        <Av m={m} big />
        <div className="ma-read-t">
          <h2 id={`ma-h-${m.id}`} className={m.name ? undefined : 'anon'}>
            {m.name ? cleanText(m.name) : 'No name given'}
          </h2>
          {mail}
        </div>
        <span className="ma-stamp">
          <b>{ago(m.createdAt, now)}</b>
          {stamp(m.createdAt)}
        </span>
      </div>
      <p className="ma-body">{cleanText(m.message)}</p>
      {acts}
    </article>
  )
}

// ---------------------------------------------------------------------------------------------
// States

function GhostRows() {
  return (
    <ul className="ma-list" aria-hidden="true">
      {Array.from({ length: GHOST_ROWS }, (_, i) => (
        <li key={i} className="ma-row ma-ghost">
          <span className="aw-av t-ghost" />
          <span className="ghost-line" />
          <span className="ghost-line short" />
        </li>
      ))}
    </ul>
  )
}

function Empty({ icon, title, text, bad = false, children }: { icon: ReactNode; title: string; text: string; bad?: boolean; children?: ReactNode }) {
  return (
    <div className={bad ? 'ma-state bad' : 'ma-state'} role={bad ? 'alert' : undefined}>
      <div className="aw-empty-i" aria-hidden="true">
        {icon}
      </div>
      <b>{title}</b>
      <p>{text}</p>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The inbox

/** List and reader of the Messages view. Selection, filter and keyboard moves live here. */
export function MessagesInbox({
  data,
  now,
  onRetry,
  onMarkRead,
  onDelete,
}: {
  data: MessagesData
  now: number
  onRetry: () => void
  onMarkRead: (id: number) => Promise<boolean>
  onDelete: (id: number) => Promise<boolean>
}) {
  const phone = usePhone()
  const listRef = useRef<HTMLUListElement>(null)
  const [filter, setFilter] = useState<MessageFilter>('all')
  // null: nothing picked yet, the newest unread opens. 'none': a phone row was folded away.
  const [picked, setPicked] = useState<number | 'none' | null>(null)
  const [announce, setAnnounce] = useState('')

  const all = useMemo(() => (data.status === 'ready' ? data.messages : []), [data])

  // Pin the first selection once the list arrives, so marking it read does not move the selection.
  // Adjusted during render, not in an effect.
  if (picked === null && data.status === 'ready' && all.length > 0) {
    setPicked(firstSelection(all))
  }

  const keepId = typeof picked === 'number' ? picked : null
  const shown = useMemo(() => filterMessages(all, filter, keepId), [all, filter, keepId])
  const selId = picked === 'none' ? null : shown.some((m) => m.id === picked) ? (picked as number) : firstSelection(shown)
  const selIndex = shown.findIndex((m) => m.id === selId)
  const sel = selIndex >= 0 ? shown[selIndex] : null
  const unread = unreadCount(all)

  // A new filter keeps the open message when it is in the new list, else opens that list's first.
  const changeFilter = (f: MessageFilter) => {
    const next = filterMessages(all, f, null)
    setFilter(f)
    setPicked(next.some((m) => m.id === picked) ? picked : (firstSelection(next) ?? 'none'))
  }

  const select = (id: number) => {
    if (phone && id === selId) setPicked('none')
    else setPicked(id)
  }

  const onRowKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let to = -1
    if (e.key === 'ArrowDown') to = Math.min(index + 1, shown.length - 1)
    else if (e.key === 'ArrowUp') to = Math.max(index - 1, 0)
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = shown.length - 1
    if (to < 0) return
    e.preventDefault()
    setPicked(shown[to].id)
    listRef.current?.querySelectorAll<HTMLButtonElement>('button.ma-row')[to]?.focus()
  }

  const remove = async (id: number) => {
    const next = nextAfterDelete(shown, id)
    const who = shown.find((m) => m.id === id)
    const ok = await onDelete(id)
    if (ok) {
      setPicked(next ?? 'none')
      setAnnounce(who ? `Deleted the message from ${senderLabel(who)}.` : 'Deleted the message.')
      if (next !== null) {
        window.requestAnimationFrame(() => {
          listRef.current?.querySelector<HTMLButtonElement>('button.ma-row[aria-current="true"]')?.focus()
        })
      }
    }
    return ok
  }

  let body: ReactNode
  if (data.status === 'loading') {
    body = <GhostRows />
  } else if (data.status === 'error') {
    body = (
      <Empty icon={<AlertIcon />} title="Messages could not be loaded" text={data.message} bad>
        <button type="button" className="aw-btn" onClick={onRetry}>
          Try again
        </button>
      </Empty>
    )
  } else if (all.length === 0) {
    body = (
      <Empty
        icon={<MailIcon />}
        title="No messages yet"
        text="When someone writes through the contact form on the About page, it lands here, newest first."
      />
    )
  } else if (shown.length === 0) {
    body = <Empty icon={<BigCheckIcon />} title="All caught up" text="Every message has been read. Switch to All to see them again." />
  } else {
    body = (
      <ul className="ma-list" aria-label="Messages" ref={listRef}>
        {shown.map((m, i) => {
          const cur = m.id === selId
          const isNew = m.readAt === null
          return (
            <li key={m.id}>
              <button
                type="button"
                className={isNew ? 'ma-row new' : 'ma-row'}
                aria-current={cur ? 'true' : undefined}
                aria-expanded={phone ? cur : undefined}
                style={{ animationDelay: `${Math.min(i, ROW_STAGGER_MAX) * ROW_STAGGER_MS}ms` }}
                onClick={() => select(m.id)}
                onKeyDown={(e) => onRowKey(e, i)}
              >
                <Av m={m} />
                <span className={m.name ? 'ma-who' : 'ma-who anon'}>{senderLabel(m)}</span>
                <span className="ma-when">
                  {isNew && (
                    <>
                      <span className="ma-dot" aria-hidden="true" />
                      <span className="sr">Unread</span>
                    </>
                  )}
                  {shortWhen(m.createdAt, now)}
                </span>
                <span className="ma-pre">{cleanText(m.message)}</span>
              </button>
              {phone && cur && (
                <Reader m={m} pos={i + 1} total={shown.length} now={now} fold onMarkRead={onMarkRead} onDelete={remove} />
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  const ready = data.status === 'ready'
  return (
    <section className="ma-box" aria-label="Messages" aria-busy={data.status === 'loading'}>
      <div className="ma-side">
        <div className="ma-side-h" role="group" aria-label="Filter messages">
          <button type="button" className="aw-chip" aria-pressed={filter === 'all'} disabled={!ready} onClick={() => changeFilter('all')}>
            All <i>{ready ? all.length : '–'}</i>
          </button>
          <button
            type="button"
            className="aw-chip warn"
            aria-pressed={filter === 'unread'}
            disabled={!ready}
            onClick={() => changeFilter('unread')}
          >
            Unread <i>{ready ? unread : '–'}</i>
          </button>
          <span className="ma-cap">Newest first &middot; last {MESSAGES_LIMIT}</span>
        </div>
        {body}
      </div>
      {!phone && sel && (
        <Reader m={sel} pos={selIndex + 1} total={shown.length} now={now} fold={false} onMarkRead={onMarkRead} onDelete={remove} />
      )}
      {!phone && ready && !sel && all.length > 0 && <div className="ma-read ma-blank" aria-hidden="true" />}
      <p className="sr" role="status" aria-live="polite">
        {announce}
      </p>
    </section>
  )
}
