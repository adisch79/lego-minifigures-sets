# HANDOFF

## Current state (2026-10-31)
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

## Next step
1. Theme logos (real alpha only, Google Images `&udm=2&tbs=ic:trans,isz:l` in Chrome, URLs from `["url",h,w]` triples in page HTML): Shrek, Disney 100, Marvel Studios. Series 25 and Series 1 use the Minifigures lockup + "SERIES N" badge.
2. Generalise `v4` in `docs/spike/V0-04-cards-gen.py` into a per-series function (id, age, count, logo, front-row main characters) and render 6 cards to `mockups/cards/<id>.png`.
3. Swap the 6 cards into mockup D home (`mockups/d/index.html`), screenshot, owner sign-off, then MVP 1 V1-01 scaffold.

## Owner-needed later (MVP 2)
- Supabase account: owner has it (2026-10-31). Needed in `.env` before MVP 2: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
- Telegram bot token + chat id: PC: repo-root `.env` (git-ignored; key names unverified, read blocked by deny rule); NAS copy too (owner, 2026-10-31); read from env, never commit.

## Open questions
- BrickLink CMF codes for the other ~45 series still to map (6 done above); V1-02.
- "Flatten" bag: current bag image shows slight 3D bag shape; V0-02 shows options (as-is cut-out vs flat artwork crop).

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)
