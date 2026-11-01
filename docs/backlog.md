# Backlog v2 — LEGO Minifigures Collector (refactor)

v1 backlog (static gallery, E1–E8): `docs/archive/backlog-v1.md`.

## Product (owner brief, 2026-10-31)
- Home: every CMF series as its **flat bag/box artwork** (series number, name, logo, icons kept). Sort + search.
- Series page: every minifigure as the **real figure photo** (not a posed promo render), with **name + number**.
- Images on a transparent background, or an equivalent visual solution.
- **Invited users** sign in and mark each figure, or a whole series, as **owned** or **wanted**.
- Every **wanted** mark sends the admin (owner) a **Telegram** message.
- **Lowest price** per series/figure: BrickLink stores that ship to Israel, eBay, other online shops. **No API keys**: moderate scraping. Price in the original currency + ILS.
- Look: simple, innovative, lego.com colours (yellow `#FFCF00`, red `#E3000B`, black, white; values to be verified against lego.com in V0-02).
- UI in English first; Hebrew (RTL) toggle later.

## Architecture (default, see decisions.md)
- Frontend: Vite + React + TypeScript, static build on GitHub Pages. i18n-ready strings from day 1.
- Catalog: existing Python pipeline (Rebrickable CSV + images) → `catalog.json` + WebP images.
- Users / marks: Supabase free tier (auth by email magic link, allowlist table, Postgres + RLS).
- Notification: Postgres trigger → Supabase Edge Function → Telegram Bot API.
- Prices: scheduled GitHub Action (daily, ~1 request / 4 s, cached) → `prices.json`. FX: Bank of Israel daily rate.

## Ways of working
- Flow: `feature/<id>-<slug>` → `dev` → release into `master` (deploys).
- Each story: design review (M/L) → coder → code-reviewer → qa (+ security-reviewer for auth, data, scraping).
- Every task is ≤ 5 minutes; bigger work is split. One step per subagent.
- Models: **haiku** for bulk/mechanical work (data checks, image QA lists, doc edits); **sonnet** for coding, QA and S/M reviews; **opus** for design, architecture, security and L reviews. GUI is built by `senior-frontend-dev` after the owner picks a direction.
- Depth before breadth: one series (71019 Ninjago Movie) gets full depth and owner sign-off, then all series.
- Every MVP ends with a demo URL.

Legend: **UI** = needs approved direction first. **Owner** = needs something only the owner can give.

## MVP 0 — Look & images proven on one series (71019) · demo: 3 mockup pages
| ID | Title | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|
| V0-01 | Image spike: transparent bag + figures | 71019 bag: white background removed, artwork intact, edges clean. 20 figures: background removed with an edge flood-fill (no ML) vs CSS `multiply` on a light background; side-by-side sheet for owner; choice logged | S | sonnet | | Done (docs/spike/) |
| V0-02 | 3 design directions, one real example | Each direction = home (6 real series tiles, sort + search bar) + series 71019 page (20 real figures, name + number, owned/wanted controls as static UI). lego.com palette. Screenshots desktop + 375 px | M | opus → senior-frontend-dev | UI | Done (mockups/a,b,c) |
| V0-03 | Owner picks direction | Choice + notes in decisions.md | S | — | Owner | Done (decisions.md 2026-10-31) |
| V0-04 | Series card variants | 3 composed card variants for 71019 | S | opus | UI | Done (mockups/cards) |
| V0-05 | Card v4 | Owner-approved card template | S | opus | UI | Done (mockups/cards/v4.png) |
| V0-06 | Cards for 6 series | Figure cut-outs + cards for 6 mockup series | M | sonnet | UI | Done (mockups/cards/all.png) |

## MVP 1 — New site, read-only catalog, all series · demo: live Pages URL
| ID | Title | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|
| V1-01 | Scaffold app + CI | Vite/React/TS app in `app/`; lint, unit tests (Vitest), build in CI; Pages deploys `app/dist` | S | sonnet | | Done (PR #8) |
| V1-02 | Catalog contract v2 | `catalog.json` per `docs/design/V1-02-catalog-v2.md`: series {id, name, line, seriesNo, year, age, bricklinkCode, figureCount, bag, card}, figure {id, no, name, img, imgFallback}; overrides table; image copy step; schema tests (py + TS guard) | M | sonnet (design review opus) | | Done (PR into dev) |
| V1-03 | Images for all series | Approved V0-01 method on all ~52 bags and ~790 figures; gap report (haiku review list) | M | sonnet + haiku | | Done |
| V1-04 | Home: grid, sort, search | Sort: newest, oldest, A–Z, series number, figure count. Search: series name/number/year and figure name. State in URL | M | senior-frontend-dev | UI | Done (PR #11) |
| V1-06 | Composed cards for all series | v4 template card per series, real-alpha logos for licensed series; tile uses the card | M | sonnet + senior-frontend-dev | UI | In progress (33/52) |
| V1-05 | Series page | All figures with name + number; works on desktop and 375 px; keyboard accessible | M | senior-frontend-dev | UI | Ready |

## MVP 2 — Invited collectors + Telegram alerts · demo: sign in, mark wanted, phone pings
| ID | Title | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|
| V2-01 | Supabase project + schema | Tables: allowlist, profiles, marks (user, figure_id or series_id, owned/wanted); RLS: users see/write only their own marks; migrations in repo | M | opus design + security review | Owner (create free Supabase account) | Ready |
| V2-02 | Invite-only sign-in | Email magic link; addresses not on the allowlist are refused; sign-out | M | sonnet | | Ready |
| V2-03 | Mark owned / wanted | Per figure and per whole series; progress (e.g. 12/20 owned); filter "my wanted" / "missing" | M | sonnet + senior-frontend-dev | UI | Ready |
| V2-04 | Telegram alert on wanted | New wanted mark → one Telegram message (who, what, link) within 1 min; repeat clicks not re-sent; token only in Supabase secrets | S | sonnet + security review | Owner (bot token) | Ready |
| V2-05 | Admin page | Owner manages the allowlist and sees all wanted items | S | sonnet | UI | Ready |

## MVP 3 — Lowest prices · demo: price chip on every series/figure
| ID | Title | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|
| V3-01 | Price source spike | Per source (BrickLink stores shipping to IL, eBay, 2–3 shops): page structure, robots.txt/ToS notes, block risk, rate limit; pick sources | S | opus | | Ready |
| V3-02 | Scheduled price scraper | Daily GitHub Action; ≤ 1 req / 4 s per host; cache; failures logged, last good price kept; `prices.json` with source, URL, date | M | sonnet + security review | | Ready |
| V3-03 | Currency | Original currency + ILS from the Bank of Israel daily rate (`SOURCE:` in code) | S | sonnet | | Ready |
| V3-04 | Show lowest price | Price chip on tile and figure, link to the offer, date of the price | S | senior-frontend-dev | UI | Ready |

## MVP 4 — Hebrew
| ID | Title | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|
| V4-01 | Hebrew + RTL toggle | All UI strings translated; RTL layout correct on both pages | M | sonnet + haiku (string extraction) | UI | Ready |

## Risks
- BrickLink and eBay terms restrict automated access: scraping can be blocked. Mitigation: low rate, daily cache, link-out fallback.
- Rebrickable images have no transparency. V0-01 tests a non-ML cut-out (u2net failed in v1).
