# HANDOFF

## Current state (2026-10-29)
- MVP 0 + MVP 1 built in one pass (owner asked to proceed without questions):
  - `scripts/fetch_data.py` downloads all CMF series + every image from Rebrickable (no key).
  - `site/index.html` (series grid + search), `site/series.html` (hero group shot, then one figure per screen, ↑/↓ buttons + arrow keys).
  - Tests: `python -m unittest discover tests` (build_catalog logic).
- GitHub Pages workflow ready (`.github/workflows/pages.yml`); not pushed — no remote yet.

## Next step
Owner creates a GitHub repo → `git remote add origin <url>` → `git push -u origin master dev` → Settings → Pages → Source: GitHub Actions.

## Open questions
- None blocking. E2-03 review page skipped for now (missing images are listed by the fetch script).

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [README](../README.md)
