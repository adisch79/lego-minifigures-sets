# Decisions

- 2026-10-29 — Scope: Collectible Minifigures series only (Rebrickable sub-themes of theme 535). Owner choice.
- 2026-10-29 — Hosting: static site on GitHub Pages, all images downloaded into repo. Owner choice.
- 2026-10-29 — Data source: Rebrickable CSV dumps + cdn.rebrickable.com images. No API key needed; one source has bag, group shot ("Complete - All Sets") and per-figure photos for every series.
- 2026-10-29 — Images kept as original JPG (no WebP conversion): owner wants all images downloaded; total size fine for Pages.
- 2026-10-29 — Catalog shipped as `data.js` (window.CATALOG) so the site works from file:// without a server.
- 2026-10-29 — Mockup step skipped: owner asked to build without further questions.
- 2026-10-29 — Promo collections directly under theme 535 (Vintage Collection, gift sets) excluded: not CMF series.
