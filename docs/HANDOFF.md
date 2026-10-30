# HANDOFF

## Current state (2026-10-31)
- 52 CMF series, 787 figures, 891 images. Originals in `originals/`, web images (48 MB WebP) in `site/img/`.
- `scripts/fetch_data.py` downloads + processes (`scripts/process_images.py`: u2net cut-outs, flat bag crops).
- Site (dark theme): home grid with flat bag artwork tiles + big set number; series page with transparent
  group-shot hero and a swipe viewer (one figure at a time, thumbnails, ←/→ keys).
- Repo: https://github.com/adisch79/lego-minifigures-sets — Pages workflow deploys `site/` on push to `master`.
- Tests: `python -m unittest discover tests`.

## Next step
Owner feedback on round 2 (tiles, dark stage, viewer).

## Open questions
- None blocking. Known nit: u2net may clip thin accessories (sticks, feathers) on a few figures.

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [README](../README.md)
