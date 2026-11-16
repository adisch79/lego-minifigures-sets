// Story V2-15 PR 1: the About page, approved direction C "The collector's story" (mockups/V2-15/c.html).
// Dark story column on the left, two numbered chapters on the right: 01 Support the site, 02 Write to me.
import type { Load } from './series'
import { AccountControl } from './Account'
import { Brand } from './SeriesPage'
import Stats from './Stats'
import { KOFI_URL } from './kofi'

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
          <WriteSoon />
        </section>
      </div>
    </div>
  )
}
