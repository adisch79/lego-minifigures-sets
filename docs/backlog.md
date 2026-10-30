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
| E4-01 | GitHub Pages deploy | Site reachable from phone | Repo + Pages live; README has URL | S | sonnet | Install | In progress (Pages enabled, no Actions run starts; NOT live) |
| E4-02 | Mobile performance | Fast on phone | Lazy-load images; series page LCP < 2.5 s on 4G | S | sonnet | | Ready |

## MVP 3 — Stay current

### E5 Updates
| ID | Title | Goal | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|---|
| E5-01 | Incremental update | Add new series with one command | Re-run fetches only new series/figures; existing files untouched | S | sonnet | | Done |

## Round 2 — owner feedback on MVP 1 (shipped in 3b525d1 without review; retro review in P-01)

Items reconstructed from commit 3b525d1 and decisions.md (owner to confirm wording).

### E6 Visual redesign
| ID | Title | Goal | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|---|
| E6-01 | Figure cut-outs | Figures without photo background | Transparent WebP per figure; white plastic stays solid; no floor shadow | M | sonnet | | Done (golden set pending, P-07) |
| E6-02 | Group-shot hero cut-out | Clean transparent hero | Group shot transparent; no white haze around figures | S | sonnet | | Done |
| E6-03 | Flat bag artwork tiles | Tiles show bag art, not crumpled bag | Crop to flat artwork rectangle on every series | S | sonnet | UI | Done (no mockups, see P-06) |
| E6-04 | Uniform tiles + title overlay | Same-size home tiles | All tiles 3:4; title overlaid; no layout jumps | S | sonnet | UI | Done |
| E6-05 | Big set number | Series number readable at a glance | Large set-number badge on every tile | S | sonnet | UI | Done |
| E6-06 | Dark stage + swipe viewer | No big gaps; one figure at a time | Dark theme; horizontal swipe viewer + thumbnail strip + ←/→ keys; works at 375 px | M | sonnet | UI | Done |

### E7 Retro-review fixes (P-01 findings, 2026-10-31)
| ID | Title | Goal | Acceptance criteria | Size | Model | Flags | Status |
|---|---|---|---|---|---|---|---|
| E7-01 | Robust download + processing | One bad file never breaks or poisons a run | CSV 404 raises clear error; CSV/image/WebP writes atomic (tmp + `os.replace`); downloaded image verified with PIL; per-file errors in download + process caught, logged, run continues; `import urllib.error`; 429 honours Retry-After; `suffix()` tolerates non-numeric; tests for each | M | sonnet | | Ready |
| E7-02 | Input validation (security S1/S2) | Untrusted CSV can't write outside repo or fetch other hosts | Only `https://cdn.rebrickable.com` URLs fetched; read size capped (20 MB image, 100 MB CSV); `set_num` must match `[A-Za-z0-9]+-\d+`; ext allowlist; tests | S | sonnet | | Ready |
| E7-03 | Supply-chain pins (security S3/S4) | Reproducible, tamper-resistant builds | requirements.txt exact versions; workflow actions pinned to commit SHA | S | sonnet | | Ready |
| E7-04 | Site robustness + a11y | Site correct on edge data, usable by keyboard | null year hidden; empty cover guarded; reduced-motion respected; ←/→ ignores modifier keys; off-screen slides `inert`; `aria-current` on thumb; `:focus-visible` styles; favicon (no console 404); resize re-aligns viewer | M | sonnet | | Ready |
| E7-05 | Catalog logic edge cases | Correct bag/series picking | Deterministic series-id tie break; bag/group classification tests | S | sonnet | | Ready |
| E7-06 | Repo hygiene decision | Owner decides | `originals/` kept; site public (see decisions) | S | — | | Done |

E4-02 also gets: 160 px thumbnails, hero `fetchpriority=high` + width/height.

## Process fixes (from HANDOFF)
| ID | Title | Status |
|---|---|---|
| P-01 | security-reviewer agent; retro code/QA/security review of 0088846~1..3b525d1 | Done (QA pass; 0 blocking security; 5 blocking code → E7-01, E4-01) |
| P-06 | 3 mockups before next UI story | Rule — applies from now |
| P-07 | Golden set for u2net cut-outs (via E2-03 review page, ~50 labelled) | Ready |
