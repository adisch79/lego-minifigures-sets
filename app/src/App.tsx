import { useEffect, useMemo, useState } from 'react'
import { parseCatalog, type Series } from './catalog'
import {
  SORT_OPTIONS,
  matchedFigures,
  readState,
  searchSeries,
  sortSeries,
  tileArt,
  writeState,
  type HomeState,
  type SortMode,
} from './home'

// Vite base is './', so this stays correct under a Pages sub-path.
const BASE = import.meta.env.BASE_URL

// Tile stagger is capped so a long grid does not keep animating for seconds.
const STAGGER_MS = 70
const STAGGER_MAX_TILES = 8

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; series: Series[] }

function Tile({ series, index, query }: { series: Series; index: number; query: string }) {
  const art = tileArt(series)
  const hits = matchedFigures(series, query)
  const href = `#series/${series.id}`
  const delay = `${Math.min(index, STAGGER_MAX_TILES) * STAGGER_MS}ms`
  const label = `${series.name}, set ${series.id}, ${series.year}`
  return (
    <li className="tile" style={{ animationDelay: delay }}>
      <a className="tile-link" href={href} aria-label={label}>
        <div className={art?.kind === 'photo' ? 'art art-photo' : 'art'}>
          {art ? (
            <img src={`${BASE}${art.src}`} alt={`${series.name} series`} loading="lazy" />
          ) : (
            <span className="art-none">No. {series.id}</span>
          )}
        </div>
      </a>
      <div className="meta">
        <div className="meta-row">
          <span className="num">
            No. {series.id} &middot; {series.year}
          </span>
          <span className="count-badge">
            {series.figureCount} {series.figureCount === 1 ? 'figure' : 'figures'}
          </span>
        </div>
        <h2>
          <a href={href} tabIndex={-1}>
            {series.name}
          </a>
        </h2>
        {hits.length > 0 && <p className="hit">Includes {hits.join(', ')}</p>}
      </div>
    </li>
  )
}

function Stats({ series }: { series: Series[] }) {
  const figures = series.reduce((sum, s) => sum + s.figureCount, 0)
  const years = series.map((s) => s.year)
  return (
    <div className="stats">
      <div>
        <strong>{series.length}</strong>Series
      </div>
      <div>
        <strong>{figures}</strong>Figures
      </div>
      <div>
        <strong>
          {Math.min(...years)}
          <span>-{Math.max(...years)}</span>
        </strong>
        Years
      </div>
    </div>
  )
}

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<HomeState>(() => readState(window.location.search))

  useEffect(() => {
    const abort = new AbortController()
    fetch(`${BASE}catalog.json`, { signal: abort.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`catalog.json returned HTTP ${res.status}`)
        return res.json()
      })
      .then((json: unknown) => setLoad({ status: 'ready', series: parseCatalog(json).series }))
      .catch((err: unknown) => {
        if (abort.signal.aborted) return
        setLoad({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => abort.abort()
  }, [attempt])

  // Keep the URL in step with the controls without adding a history entry per keystroke.
  useEffect(() => {
    const { pathname, search, hash } = window.location
    const next = writeState(state, search)
    if (next !== search) window.history.replaceState(null, '', `${pathname}${next}${hash}`)
  }, [state])

  useEffect(() => {
    const onPop = () => setState(readState(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const visible = useMemo(
    () =>
      load.status === 'ready'
        ? sortSeries(searchSeries(load.series, state.q), state.sort)
        : [],
    [load, state.q, state.sort],
  )

  const query = state.q.trim()

  return (
    <>
      <header className="band">
        <div className="wrap">
          <div className="band-top">
            <a className="brand" href="./" aria-label="Minifig Vault home">
              <span className="brand-mark" aria-hidden="true">
                <i />
              </span>
              <span>
                <b>Minifig Vault</b>
                <small>Collectible Minifigures</small>
              </span>
            </a>
            <div className="controls">
              <label className="field">
                <span className="sr">Search series</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  placeholder="Search name, number, year, figure"
                  autoComplete="off"
                  value={state.q}
                  onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
                />
              </label>
              <label>
                <span className="sr">Sort series</span>
                <select
                  value={state.sort}
                  onChange={(e) =>
                    setState((s) => ({ ...s, sort: e.target.value as SortMode }))
                  }
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="band-hero">
            <h1 className="big">
              Every series.
              <br />
              Every <em>figure.</em>
            </h1>
            <div>
              <p className="lede">
                Browse every Collectible Minifigures series, or find one by the name of a single
                figure.
              </p>
              {load.status === 'ready' && load.series.length > 0 && (
                <Stats series={load.series} />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="rule" aria-live="polite">
          <span>
            {load.status === 'ready' && (
              <>
                <b>{visible.length}</b> of {load.series.length} series
              </>
            )}
            {load.status === 'loading' && 'Loading series'}
          </span>
        </div>

        {load.status === 'error' && (
          <div className="empty" role="alert">
            <strong>The catalog could not be loaded</strong>
            {load.message}
            <button
              type="button"
              className="again"
              onClick={() => {
                setLoad({ status: 'loading' })
                setAttempt((n) => n + 1)
              }}
            >
              Try again
            </button>
          </div>
        )}

        {load.status === 'loading' && (
          <ul className="grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="ghost">
                <div className="art" />
                <div className="ghost-line" />
                <div className="ghost-line short" />
              </li>
            ))}
          </ul>
        )}

        {load.status === 'ready' && (
          <ul className="grid">
            {visible.length === 0 ? (
              <li className="empty">
                <strong>No series match "{query}"</strong>
                Try a series name, a set number like 71019, a year, or a figure.
                <button
                  type="button"
                  className="again"
                  onClick={() => setState((s) => ({ ...s, q: '' }))}
                >
                  Clear search
                </button>
              </li>
            ) : (
              visible.map((s, i) => <Tile key={s.id} series={s} index={i} query={query} />)
            )}
          </ul>
        )}
      </main>
    </>
  )
}
