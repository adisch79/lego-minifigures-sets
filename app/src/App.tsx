import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
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
import { findSeries, parseRoute, type Load } from './series'
import { AccountControl, AccountProvider, LinkErrorStrip, useAccount } from './Account'
import { filterSeries, type SeriesFilter } from './marks'
import { FilterBar, HeartOutlineIcon, MarksProvider, TileBadge, TileProgress, TrophyIcon, useMarksUi } from './MarkChips'
import SeriesPage, { Brand, LoadError } from './SeriesPage'
import Admin from './Admin'

// Vite base is './', so this stays correct under a Pages sub-path.
const BASE = import.meta.env.BASE_URL

// Tile stagger is capped so a long grid does not keep animating for seconds.
const STAGGER_MS = 70
const STAGGER_MAX_TILES = 8

function Tile({ series, index, query }: { series: Series; index: number; query: string }) {
  const art = tileArt(series)
  // A failed image falls back to the first figure, then to the text placeholder.
  const sources = [art?.src, series.figures[0]?.img].filter((s, i, all): s is string => !!s && all.indexOf(s) === i)
  const [failed, setFailed] = useState(0)
  const src = sources[failed]
  const hits = matchedFigures(series, query)
  const href = `#series/${series.id}`
  const delay = `${Math.min(index, STAGGER_MAX_TILES) * STAGGER_MS}ms`
  const figures = `${series.figureCount} ${series.figureCount === 1 ? 'figure' : 'figures'}`
  const label = `${series.name}, set ${series.id}, ${series.year}, ${figures}${hits.length ? `, includes ${hits.join(', ')}` : ''}`
  return (
    <li className="tile" style={{ animationDelay: delay }}>
      <a className="tile-link" href={href} aria-label={label}>
        <div className={art?.kind === 'photo' ? 'art art-photo' : 'art'}>
          {src ? (
            <img src={`${BASE}${src}`} alt="" loading="lazy" onError={() => setFailed((n) => n + 1)} />
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
          <TileBadge series={series} figures={figures} />
        </div>
        <h2>
          <a href={href} tabIndex={-1}>
            {series.name}
          </a>
        </h2>
        <TileProgress series={series} />
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

/** Right side of the section rule: what the signed-out or failed-marks visitor can do. */
function RuleHint() {
  const { auth, openSignIn } = useAccount()
  const { active, status } = useMarksUi()
  if (auth.status === 'signed-out') {
    return (
      <span className="hint">
        <button type="button" className="linkish" onClick={openSignIn}>
          Sign in
        </button>{' '}
        to track what you own
      </span>
    )
  }
  if (active && status === 'error') {
    return (
      <span className="hint hint-bad" role="alert">
        Your marks could not be loaded.{' '}
        <button type="button" className="linkish" onClick={() => window.location.reload()}>
          Reload
        </button>
      </span>
    )
  }
  return null
}

/** Empty grid after a filter: say how to fill it, offer the way back. */
function FilterEmpty({ filter, query, onAll }: { filter: SeriesFilter; query: string; onAll: () => void }) {
  const wanted = filter === 'wanted'
  return (
    <li className="empty">
      <div className={wanted ? 'em-ico' : 'em-ico em-win'} aria-hidden="true">
        {wanted ? <HeartOutlineIcon size={30} /> : <TrophyIcon />}
      </div>
      <strong>
        {query
          ? `No ${wanted ? 'wanted' : 'missing'} series match "${query}"`
          : wanted
            ? 'Your wanted list is empty'
            : 'Nothing missing'}
      </strong>
      <p>
        {wanted ? (
          <>
            Tap <b>Want</b> under any figure and its series shows up here.
          </>
        ) : (
          'Hunt complete. You own every figure of every series shown.'
        )}
      </p>
      <button type="button" className="again" onClick={onAll}>
        Show all series
      </button>
    </li>
  )
}

function Home({
  load,
  state,
  setState,
  filter: chosenFilter,
  setFilter,
  onRetry,
}: {
  load: Load
  state: HomeState
  setState: Dispatch<SetStateAction<HomeState>>
  filter: SeriesFilter
  setFilter: (f: SeriesFilter) => void
  onRetry: () => void
}) {
  const { marks, ready } = useMarksUi()
  // Filters need loaded marks; without them every series is shown.
  const filter: SeriesFilter = ready ? chosenFilter : 'all'

  const searched = useMemo(
    () =>
      load.status === 'ready'
        ? sortSeries(searchSeries(load.series, state.q), state.sort)
        : [],
    [load, state.q, state.sort],
  )

  const counts = useMemo(
    () => ({
      all: searched.length,
      wanted: ready ? filterSeries(searched, marks, 'wanted').length : 0,
      missing: ready ? filterSeries(searched, marks, 'missing').length : 0,
    }),
    [searched, marks, ready],
  )

  const visible = useMemo(() => filterSeries(searched, marks, filter), [searched, marks, filter])

  const query = state.q.trim()

  return (
    <>
      <header className="band">
        <div className="wrap">
          <div className="band-top">
            <Brand href="./" />
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
                  placeholder="Search series, year, figure"
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
            <AccountControl />
          </div>
          <LinkErrorStrip />
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
        <div className={ready && load.status === 'ready' ? 'rule rule-f' : 'rule'}>
          {ready && load.status === 'ready' && (
            <FilterBar value={filter} counts={counts} onChange={setFilter} />
          )}
          <span aria-live="polite">
            {load.status === 'ready' && (
              <>
                <b>{visible.length}</b> of {load.series.length} series
              </>
            )}
            {load.status === 'loading' && 'Loading series'}
          </span>
          {!ready && <RuleHint />}
        </div>

        {load.status === 'error' && <LoadError message={load.message} onRetry={onRetry} />}

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
            {visible.length === 0 && filter !== 'all' ? (
              <FilterEmpty filter={filter} query={query} onAll={() => setFilter('all')} />
            ) : visible.length === 0 && !query.trim() ? (
              <li className="empty">
                <strong>No series in the catalog</strong>
              </li>
            ) : visible.length === 0 ? (
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

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<HomeState>(() => readState(window.location.search))
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  // Kept here, not in Home, so the filter survives a visit to a series page.
  const [filter, setFilter] = useState<SeriesFilter>('all')
  const seriesId = route.page === 'series' ? route.id : null
  // One key per page, so scroll and focus react to any page change (home, admin, a series).
  const pageKey = route.page === 'series' ? `series/${route.id}` : route.page

  // Last committed page key, and how far down home was when it was left.
  const shownKey = useRef(pageKey)
  const homeScroll = useRef(0)

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

  useEffect(() => {
    const onHash = () => {
      // Read before the render: leaving home shortens the page and would clamp the offset.
      if (shownKey.current === 'home') homeScroll.current = window.scrollY
      setRoute(parseRoute(window.location.hash))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Moving between pages replaces the document content, so scroll and focus are set by hand.
  useLayoutEffect(() => {
    const previous = shownKey.current
    if (previous === pageKey) return
    shownKey.current = pageKey
    if (pageKey !== 'home') {
      window.scrollTo(0, 0)
      document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
    } else {
      window.scrollTo(0, homeScroll.current)
      // Back from a series: focus the tile that led there. Series keys match the tile hrefs.
      const tile = [...document.querySelectorAll<HTMLElement>('a.tile-link')].find(
        (a) => a.getAttribute('href') === `#${previous}`,
      )
      tile?.focus({ preventScroll: true })
    }
  }, [pageKey])

  useEffect(() => {
    if (route.page === 'admin') {
      document.title = 'Admin - Minifig Hunt'
    } else if (seriesId === null) {
      document.title = 'Minifig Hunt'
    } else if (load.status === 'ready') {
      const found = findSeries(load.series, seriesId)
      document.title = found
        ? `${found.id} ${found.name} - Minifig Hunt`
        : 'Series not found - Minifig Hunt'
    }
  }, [route.page, seriesId, load])

  const retry = () => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  return (
    <AccountProvider>
      <MarksProvider>
        {route.page === 'admin' ? (
          <Admin load={load} onRetry={retry} />
        ) : seriesId !== null ? (
          <SeriesPage id={seriesId} load={load} onRetry={retry} />
        ) : (
          <Home
            load={load}
            state={state}
            setState={setState}
            filter={filter}
            setFilter={setFilter}
            onRetry={retry}
          />
        )}
      </MarksProvider>
    </AccountProvider>
  )
}
