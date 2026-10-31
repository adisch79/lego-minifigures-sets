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

## Next step
1. Owner picks card variant, then swap it into mockup D home and sign off D.
(old) Owner signs off mockup D (or lists tweaks). Known: flat-art left edge clipped on 71053/71045, grey seal band on 71038, mobile search placeholder cut.
2. MVP 1: V1-01 scaffold (Vite/React/TS in `app/`), then V1-02 catalog contract with BrickLink image ids.

## Owner-needed later (MVP 2)
- Free Supabase account (project for auth + database).
- Telegram bot token from @BotFather + your chat id.

## Open questions
- BrickLink CMF ids per series (e.g. `coltlnm` = 71019) need a mapping table; V1-02.
- "Flatten" bag: current bag image shows slight 3D bag shape; V0-02 shows options (as-is cut-out vs flat artwork crop).

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)
