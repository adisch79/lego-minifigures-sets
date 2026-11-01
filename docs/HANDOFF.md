# HANDOFF

## Current state (2026-11-01)
- **v2 refactor started**: collector app (sort/search, owned/wanted for invited users, Telegram alerts, lowest prices). Plan: [backlog.md](backlog.md). v1 backlog archived: [archive/backlog-v1.md](archive/backlog-v1.md).
- Owner answers (see decisions.md): invite-only users; Telegram alerts; prices later by moderate scraping (no API keys); English first, Hebrew later; prices in original currency + ILS.
- **V0-01 done**: images will come from BrickLink catalog images (`img.bricklink.com/ItemImage/SN/0/coltlnm-<n>.png`). Border flood fill gives clean transparency on 20/20 figures + bag. Proof: `docs/spike/V0-01-bricklink-cutout-71019.webp`; script `docs/spike/V0-01-cutout.py`.
- Live v1 site (unchanged): https://adisch79.github.io/lego-minifigures-sets/
- Branch: `feature/V0-00-refactor-plan` (from `dev`), plan + spike only, no app code yet.

- Backlog approved. **V0-02 done**: 3 directions in `mockups/a` (Toy Shelf), `mockups/b` (Collector Leaflet), `mockups/c` (Unboxing); screenshots in `mockups/<x>/shots/`. Shared assets `mockups/assets` (6 bags + 20 BrickLink figure cut-outs of 71019).

- Owner picked a mix (decisions.md 2026-10-31 V0-03); flat series artwork spike `docs/spike/V0-03-flatten.py`. **Combined mockup D** in `mockups/d` (shots in `mockups/d/shots/`), awaiting owner sign-off.

- Owner rejected cropped flat art: series image must be a NEW composed card (decisions.md). **3 card variants for 71019** in `mockups/cards/` (v1 bag-front, v2 poster, v3 collector; side-by-side `compare.png`); generator `docs/spike/V0-04-cards-gen.py`; logos `mockups/assets/logos/` (Wikimedia, see SOURCES.md).

- **V0-05 done, owner approved v4 (2026-10-31)**: `mockups/cards/v4.png`. Bag-style round seal (LIMITED EDITION / 20 / TO COLLECT, SVG `seal()` in generator), official coloured Ninjago Movie logo with LEGO brick (real alpha, smaller, clear of the seal), HD LEGO Minifigures lockup (1600 px). Crowd raised to fill the gap, clamped inside card, Lloyd centre front.
- Logo rule: only files that already have real alpha; find them with Google Images filter `&udm=2&tbs=ic:trans,isz:l` in Chrome, then read original URLs from the page HTML (`["url",h,w]` triples). Sources in `mockups/assets/logos/SOURCES.md`.

- **V0-06 in progress**: figure cut-outs for all 6 mockup series in `mockups/assets/figs/<set>-<n>.webp` (70 new + 20 of 71019). Script `docs/spike/V0-06-figs.py` (V0-01 flood fill + speck removal). BrickLink CMF codes verified (image n = Rebrickable figure n, next number 404): 71053 `colshr` (12), 71045 `col25` (12), 71038 `coldis100` (18), 71031 `colmar` (12), 71019 `coltlnm` (20), 8683 `col01` (16). URL `img.bricklink.com/ItemImage/SN/0/<code>-<n>.png`.

- **V0-06 done (2026-10-31)**: 6 series cards from the v4 template, `docs/spike/V0-06-cards.py` (renders with headless Chrome) -> `mockups/cards/<id>.png`, overview `mockups/cards/all.png`. Logos `shrek.png`, `disney-100.png`, `marvel-studios.png` (real alpha, SOURCES.md). Numbered series use lockup + red SERIES N badge. Backgrounds sampled from each bag (71019 keeps approved v4). Mockup D home now shows the cards (`mockups/d/shots/home-desktop.png`, `mobile.png`).

## Next step
1. V1-01 merged into dev (PR #8, 2026-11-01); MVP 0 merged (PR #7). Vite/React/TS app in `app/`, CI `app-ci.yml`; Pages deploy of `app/dist` disabled until V1-05. TypeScript pinned ~6.0 (typescript-eslint needs <6.1). `.env` also in `.git/info/exclude`.
2. V1-02 merged into dev (PR #9).
3. **V1-03 in progress** on `feature/V1-03-images` (pushed). Done: (a) BrickLink codes for 51/52 series, visually verified (docs/spike/V1-03-codes-sheet-1..3.png); 71049 F1 has no code and keeps v1 images; 71001-19 -> bricklinkNo 17. (b) `scripts/fetch_figures.py <ids>` (resumable, 1 req/2 s, cut-out via `scripts/cutout.py`) -> `site/img/<id>/<id>-<n>.webp`. Batches 1-6 committed (39 series; batch 6 = 71001 71000 8909 8833 8831, re-run: written 0, failures []).
   Batch 7 done: all 51 series with a code fetched (775 figures). **QA FAILED (2026-11-01)**: `docs/spike/V1-03-qa.py` flags 311/775 in 32 series; 158 have no background removed at all, rest suspect (some false positives). Cause: older SN images are photos on grey/gradient backgrounds with stand, so flood fill fails. Proof: `docs/spike/V1-03-qa-sample.png`, `V1-03-qa-sheet-*.png`.
   NEXT: replace failed series with BrickLink minifig images `img.bricklink.com/ItemImage/MN/0/col<NNN>.png` (pure white corners, no stand; 4 probed, `docs/spike/V1-03-mn-probe.png`). Needs figure -> col number map, verified visually. Then re-run QA; set imgFallback false where a cut-out exists (still read from site/data.json); ages for 46 series from bag images; gap report (haiku); code-reviewer; PR into dev.
4. Agent merges feature PRs into dev after code-reviewer and qa pass (`gh pr merge <n> --merge`; owner OK 2026-11-01, decisions.md). `master` stays owner-only.
5. Later polish (not blocking): series page hero in mockup D still uses the bag image.

## Owner-needed later (MVP 2)
- Supabase: owner added keys to `.env` (2026-10-31, file 191 -> 377 bytes; contents unread, deny rule). Nothing owner-needed left for MVP 2.
- Telegram bot token + chat id: PC: repo-root `.env` (git-ignored; key names unverified, read blocked by deny rule); NAS copy too (owner, 2026-10-31); read from env, never commit.

## Open questions
- Ages for 46 series still to read from bag images; V1-03. BrickLink codes done (51/52).
- "Flatten" bag: current bag image shows slight 3D bag shape; V0-02 shows options (as-is cut-out vs flat artwork crop).

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)
