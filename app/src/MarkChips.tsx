// Owned / wanted UI, approved direction A "Twin chips" (mockups/V2-03/a.html).
// Every figure and every series gets two plain toggle chips. One tap sets a mark, a second tap
// clears it, and both are never on at once. All data behaviour lives in ./marks.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useAccount } from './Account'
import type { Series } from './catalog'
import { DEMO, useDemoMarks } from './demo'
import {
  markKey,
  seriesProgress,
  useMarks,
  type MarkKind,
  type MarkState,
  type SeriesFilter,
  type UseMarks,
} from './marks'

// Chosen once per page load: the demo store is a dev-only stand-in for Supabase.
const useMarkStore = DEMO ? () => useDemoMarks() : useMarks

type MarksUi = UseMarks & {
  /** A session exists, so marks belong on the page (chips may still be waiting for data). */
  active: boolean
  /** Marks are loaded and can be shown and changed. */
  ready: boolean
}

const MarksContext = createContext<MarksUi | null>(null)

/** Holds the one marks store for the session. Must sit inside AccountProvider. */
export function MarksProvider({ children }: { children: ReactNode }) {
  const { auth } = useAccount()
  const store = useMarkStore(auth.status)
  const active = auth.status === 'signed-in'
  const ready = active && store.status === 'ready'
  return <MarksContext.Provider value={{ ...store, active, ready }}>{children}</MarksContext.Provider>
}

export function useMarksUi(): MarksUi {
  const ui = useContext(MarksContext)
  if (!ui) throw new Error('Mark components need a MarksProvider')
  return ui
}

/* Icons from the mockup, drawn at 14px and coloured by the chip text. */

export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  )
}

export function HeartIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.3C1 8.4 3 4.8 6.6 4.8c2.2 0 3.6 1.2 4.4 2.5.8-1.3 2.2-2.5 4.4-2.5 3.6 0 5.6 3.6 4.2 6.9C19.5 16.4 12 21 12 21Z" />
    </svg>
  )
}

export function HeartOutlineIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M12 20s-7-4.3-9-8.7C1.7 8.3 3.6 5 6.8 5c2 0 3.3 1.1 4.2 2.4C11.9 6.1 13.2 5 15.2 5c3.2 0 5.1 3.3 3.8 6.3C17 15.7 12 20 12 20Z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6m0 4h.01" />
    </svg>
  )
}

export function TrophyIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4" />
    </svg>
  )
}

/** The current mark of one figure or series, or null. */
export function useMark(kind: MarkKind, id: string): MarkState | null {
  const { marks, ready } = useMarksUi()
  return ready ? (marks.get(markKey(kind, id)) ?? null) : null
}

type ChipLabels = { owned: string; wanted: string }

/**
 * The Owned / Want pair. The chip last tapped carries the spinner while saving and the red
 * flag after a failed save; the store has already rolled the mark back by then.
 */
export function MarkChips({
  kind,
  id,
  group,
  labels,
  className,
  children,
}: {
  kind: MarkKind
  id: string
  group: string
  labels: ChipLabels
  className: string
  children?: ReactNode
}) {
  const { marks, set, pending, failed, retry, ready } = useMarksUi()
  const [tapped, setTapped] = useState<MarkState>('owned')
  const key = markKey(kind, id)
  const state = marks.get(key) ?? null
  const busy = pending.has(key)
  const bad = failed.has(key)

  const tap = (which: MarkState) => {
    setTapped(which)
    set(kind, id, state === which ? null : which)
  }

  const chip = (which: MarkState) => {
    const on = state === which
    const saving = busy && tapped === which
    const flagged = bad && tapped === which
    const icon = flagged ? <WarnIcon /> : which === 'owned' ? on ? <CheckIcon /> : <PlusIcon /> : on ? <HeartIcon /> : <HeartOutlineIcon />
    const cls = ['chip', which === 'owned' ? 'own' : 'want', saving && 'busy', flagged && 'bad'].filter(Boolean).join(' ')
    return (
      <button
        type="button"
        className={cls}
        aria-pressed={on}
        aria-busy={saving || undefined}
        disabled={!ready}
        onClick={() => tap(which)}
      >
        {saving ? <i className="spin" aria-hidden="true" /> : icon}
        <span>{which === 'owned' ? labels.owned : labels.wanted}</span>
      </button>
    )
  }

  return (
    <>
      <div className={className} role="group" aria-label={group}>
        {children}
        {chip('owned')}
        {chip('wanted')}
      </div>
      {bad && (
        <p className="err" role="alert">
          Not saved
          <button type="button" onClick={() => retry(key)}>
            Retry
          </button>
        </p>
      )}
    </>
  )
}

/** Count badge for signed-out users; the series mark replaces it once one is set. */
export function TileBadge({ series, figures }: { series: Series; figures: string }) {
  const mark = useMark('series', series.id)
  if (mark === 'owned') {
    return (
      <span className="smark owned">
        <CheckIcon />
        Series owned
      </span>
    )
  }
  if (mark === 'wanted') {
    return (
      <span className="smark wanted">
        <HeartIcon />
        Series wanted
      </span>
    )
  }
  return <span className="count-badge">{figures}</span>
}

/** Progress bar and owned count under a home tile title. */
export function TileProgress({ series }: { series: Series }) {
  const { marks, ready, active } = useMarksUi()
  if (!active) return null
  if (!ready) return <div className="prog prog-wait" aria-hidden="true" />
  const { owned, wanted, total } = seriesProgress(series, marks)
  const pct = total ? Math.round((owned / total) * 100) : 0
  return (
    <>
      <div className="prog">
        <div
          className={owned === total && total > 0 ? 'bar done' : 'bar'}
          role="progressbar"
          aria-label={`${series.name} owned`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={owned}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
        <b>
          {owned}
          <span>/{total} owned</span>
        </b>
      </div>
      {wanted > 0 && (
        <p className="wantn">
          {wanted} {wanted === 1 ? 'figure' : 'figures'} wanted
        </p>
      )}
    </>
  )
}

/** Large count, bar and series chips in the series hero. */
export function SeriesHeroMarks({ series }: { series: Series }) {
  const { marks, ready, active } = useMarksUi()
  if (!active) return null
  const { owned, total } = seriesProgress(series, ready ? marks : new Map())
  const pct = total ? Math.round((owned / total) * 100) : 0
  return (
    <div className={ready ? 'sp' : 'sp sp-wait'} aria-busy={!ready || undefined}>
      <div className="sp-num">
        <strong>
          {ready ? owned : '-'}
          <span>/{total}</span>
        </strong>
        <small>figures owned</small>
      </div>
      <div
        className={owned === total && total > 0 ? 'bar done' : 'bar'}
        role="progressbar"
        aria-label="Figures owned"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={owned}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <MarkChips
        kind="series"
        id={series.id}
        group="Mark the whole series"
        labels={{ owned: 'Own it', wanted: 'Want it' }}
        className="smk"
      >
        <span aria-hidden="true">Series</span>
      </MarkChips>
      <p className="note">A series mark is its own badge. It does not tick the figures.</p>
    </div>
  )
}

export const FILTERS: { value: SeriesFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'wanted', label: 'My wanted' },
  { value: 'missing', label: 'Missing' },
]

/** Segmented control on the home section rule. */
export function FilterBar({
  value,
  counts,
  onChange,
}: {
  value: SeriesFilter
  counts: Record<SeriesFilter, number>
  onChange: (f: SeriesFilter) => void
}) {
  return (
    <div className="seg" role="group" aria-label="Filter series">
      {FILTERS.map((f) => (
        <button key={f.value} type="button" aria-pressed={f.value === value} onClick={() => onChange(f.value)}>
          {f.label}
          <em>{counts[f.value]}</em>
        </button>
      ))}
    </div>
  )
}
