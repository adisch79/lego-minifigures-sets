# Decisions

- 2026-10-29 — Scope: Collectible Minifigures series only (Rebrickable sub-themes of theme 535). Owner choice.
- 2026-10-29 — Hosting: static site on GitHub Pages, all images downloaded into repo. Owner choice.
- 2026-10-29 — Data source: Rebrickable CSV dumps + cdn.rebrickable.com images. No API key needed; one source has bag, group shot ("Complete - All Sets") and per-figure photos for every series.
- 2026-10-29 — Catalog shipped as `data.js` (window.CATALOG) so the site works from file:// without a server.
- 2026-10-29 — Mockup step skipped: owner asked to build without further questions.
- 2026-10-29 — Promo collections directly under theme 535 (Vintage Collection, gift sets) excluded: not CMF series.
- 2026-10-30 — Originals kept untouched in `originals/` (not deployed); site uses processed WebP in `site/img/`.
- 2026-10-30 — Figure/group background removal: rembg u2net. Tested vs isnet-general-use (white legs turned semi-transparent) and white-threshold flood fill (ate white clothing, left floor shadow). u2net kept white plastic solid and removed shadows.
- 2026-10-30 — Bag tiles: crop the largest flat rectangle inside the bag (artwork only), uniform 3:4 tiles, title overlaid. Owner asked for flat artwork, same size.
- 2026-10-30 — Dark theme only, figures on a soft radial "stage"; figures shown in a horizontal swipe viewer (one at a time) + thumbnail strip, replacing the full-height vertical cards (owner: big gaps).
