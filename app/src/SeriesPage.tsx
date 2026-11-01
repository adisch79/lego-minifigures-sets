// Series page from approved mockup D (mockups/d/series.html), without the sign-in features of MVP 2.
import { useState } from 'react'
import type { Figure, Series } from './catalog'
import { tileArt } from './home'
import { figuresInOrder, findSeries, spillFigures, type Load, type SpillFigure } from './series'

// Vite base is './', so this stays correct under a Pages sub-path.
const BASE = import.meta.env.BASE_URL

// An empty fragment returns home in place: the query string holding sort and search is untouched.
const HOME_HREF = '#'

// Tile stagger is capped so a long grid does not keep animating for seconds.
const STAGGER_START_MS = 200
const STAGGER_MS = 35
const STAGGER_MAX_TILES = 12

export function Brand({ href }: { href: string }) {
  return (
    <a className="brand" href={href} aria-label="Minifig Vault home">
      <span className="brand-mark" aria-hidden="true">
        <i />
      </span>
      <span>
        <b>Minifig Vault</b>
        <small>Collectible Minifigures</small>
      </span>
    </a>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="empty" role="alert">
      <strong>The catalog could not be loaded</strong>
      {message}
      <button type="button" className="again" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

function BandTop() {
  return (
    <div className="band-top">
      <Brand href={HOME_HREF} />
      <a className="back" href={HOME_HREF}>
        <span aria-hidden="true">&larr;</span> All series
      </a>
    </div>
  )
}

/** The composed card, then the first figure, then a text plate. The bag photo is never used. */
function HeroArt({ series }: { series: Series }) {
  const art = tileArt(series)
  const card = art?.kind === 'card' ? art.src : null
  const figure = series.figures.find((f) => f.img)?.img ?? null
  const sources = [card, figure].filter((s): s is string => !!s)
  const [failed, setFailed] = useState(0)
  const src = sources[failed]
  if (!src) return <span className="flat flat-none">No. {series.id}</span>
  return (
    <img
      className={src === card ? 'flat' : 'flat flat-figure'}
      src={`${BASE}${src}`}
      alt={src === card ? `${series.name} series card` : `${series.name} series`}
      onError={() => setFailed((n) => n + 1)}
    />
  )
}

function SpillImage({ spill }: { spill: SpillFigure }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      // Set renders have an opaque white background: on yellow they are shown as white stickers.
      className={spill.figure.imgFallback ? 'spill-render' : undefined}
      src={`${BASE}${spill.figure.img}`}
      alt=""
      style={{
        left: spill.x,
        top: spill.y,
        transform: `rotate(${spill.rotate}deg)`,
        animationDelay: `${spill.delay}ms`,
      }}
      onError={() => setFailed(true)}
    />
  )
}

function FigureTile({ figure, index }: { figure: Figure; index: number }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : figure.img
  const delay = STAGGER_START_MS + Math.min(index, STAGGER_MAX_TILES) * STAGGER_MS
  return (
    <li className="fig" style={{ animationDelay: `${delay}ms` }}>
      <span className="fig-no" aria-hidden="true">
        {figure.no}
      </span>
      <div className={figure.imgFallback ? 'pic pic-render' : 'pic'}>
        {src ? (
          <img
            src={`${BASE}${src}`}
            alt={figure.imgFallback ? `${figure.name} set picture` : `${figure.name} minifigure`}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="pic-none">No picture yet</span>
        )}
      </div>
      <h3>
        <span className="sr">Figure {figure.no}: </span>
        {figure.name}
      </h3>
    </li>
  )
}

function SeriesView({ series }: { series: Series }) {
  return (
    <>
      <header className="band">
        <div className="wrap">
          <BandTop />
          <section className="hero" aria-labelledby="series-title">
            <div className="art-stage">
              <HeroArt series={series} />
            </div>
            <div className="spill" aria-hidden="true">
              {spillFigures(series).map((spill) => (
                <SpillImage key={spill.figure.id} spill={spill} />
              ))}
            </div>
            <div className="hero-copy">
              <p className="eyebrow">Collectible Minifigures</p>
              <h1 id="series-title" tabIndex={-1}>
                {series.name}
              </h1>
              <div className="facts">
                <span className="fact dark">No. {series.id}</span>
                <span className="fact">{series.year}</span>
                <span className="fact">{series.figureCount} to collect</span>
              </div>
            </div>
          </section>
        </div>
      </header>

      <main className="wrap">
        <div className="rule rule-series">
          <h2>Inside the series</h2>
        </div>
        <ul className="figs">
          {figuresInOrder(series).map((figure, i) => (
            <FigureTile key={figure.id} figure={figure} index={i} />
          ))}
        </ul>
      </main>
    </>
  )
}

function NotFound({ id }: { id: string }) {
  return (
    <header className="band band-full">
      <div className="wrap">
        <BandTop />
        <div className="lost">
          <p className="eyebrow">Collectible Minifigures</p>
          <h1 tabIndex={-1}>Series not found</h1>
          <p className="lede">
            {id ? (
              <>
                There is no series with the number <b>{id}</b> in the catalog.
              </>
            ) : (
              'This link does not name a series.'
            )}
          </p>
          <a className="back-home" href={HOME_HREF}>
            Back to all series
          </a>
        </div>
      </div>
    </header>
  )
}

function Loading() {
  return (
    <>
      <header className="band">
        <div className="wrap">
          <BandTop />
          <div className="hero hero-ghost" aria-hidden="true">
            <div className="art-stage">
              <div className="flat flat-ghost" />
            </div>
          </div>
        </div>
      </header>
      <main className="wrap">
        <div className="rule rule-series" role="status">
          <h2>Loading series</h2>
        </div>
        <ul className="figs" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="ghost">
              <div className="pic" />
              <div className="ghost-line" />
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}

export default function SeriesPage({
  id,
  load,
  onRetry,
}: {
  id: string
  load: Load
  onRetry: () => void
}) {
  if (load.status === 'loading') return <Loading />
  if (load.status === 'error') {
    return (
      <>
        <header className="band">
          <div className="wrap">
            <BandTop />
          </div>
        </header>
        <main className="wrap wrap-pad">
          <LoadError message={load.message} onRetry={onRetry} />
        </main>
      </>
    )
  }
  const series = findSeries(load.series, id)
  // The key gives each series fresh image-failure state.
  return series ? <SeriesView key={series.id} series={series} /> : <NotFound id={id} />
}
