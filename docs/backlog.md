# Backlog — minifigures-extractor

Scope: LEGO Collectible Minifigures (CMF) series only (~50 series, ~800–1,000 figures).
Output: static site on GitHub Pages; images downloaded once, stored as WebP in repo.

Legend: **UI** = starts with 3 mockups. **Install** = delivers a setup script.

## MVP 0 — POC: one series end to end (71019 Ninjago Movie)

### E1 Data + page for one series
| ID | Title | Goal | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|---|
| E1-01 | Data source spike (no API keys) | Pick keyless source for series list, figure list, images | Script prints 71019 figures (name, id, image URL) from Rebrickable CSV dumps; group-shot source found (BrickLink/other); choice + reason in decisions.md | S | sonnet | Install | Done |
| E1-02 | Image pipeline (1 series) | Download + convert images for 71019 | `site/data.json` catalog; group shot + 20 figure images (originals kept, see decisions); re-run skips existing | S | sonnet | Install | Done |
| E1-03 | Series page | Hero banner (group shot) + figures one at a time | Page renders 71019 from manifest; works at 375 px and desktop; no console errors | M | sonnet | UI | Done |

## MVP 1 — Full catalog, local

### E2 All series data
| ID | Title | Goal | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|---|
| E2-01 | List all CMF series | Full series index | `site/data.json` with id, name, year, figure count, cover image for every series | S | sonnet | | Done |
| E2-02 | Batch download | All figures + images | Rate-limited, resumable, retries; log of missing images; total size reported | M | sonnet | | Done |
| E2-03 | Review page for gaps | Human check of missing/wrong images | Local page: image beside fields, dropdown correct/wrong/missing, keyboard shortcuts, JSON export | M | sonnet | UI | Ready |

### E3 Home page
| ID | Title | Goal | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|---|
| E3-01 | Series grid | Home page lists all series | Tile per series (cover, name, year); click opens series page; sorted newest first | M | sonnet | UI | Done |
| E3-02 | Search / filter | Find a series fast | Filter by name/year; works on phone | S | sonnet | | Done |

## MVP 2 — Published on phone

### E4 Publish
| ID | Title | Goal | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|---|
| E4-01 | GitHub Pages deploy | Site reachable from phone | Repo + Pages live; README has URL | S | sonnet | Install | In progress (workflow ready, needs owner repo) |
| E4-02 | Mobile performance | Fast on phone | Lazy-load images; series page LCP < 2.5 s on 4G | S | sonnet | | Ready |

## MVP 3 — Stay current

### E5 Updates
| ID | Title | Goal | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|---|
| E5-01 | Incremental update | Add new series with one command | Re-run fetches only new series/figures; existing files untouched | S | sonnet | | Done |
