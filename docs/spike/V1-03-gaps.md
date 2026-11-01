# V1-03 image gap report (2026-11-01)

Totals: 52 series, 787 figures. 775 cut-outs from BrickLink, 12 v1 images (71049).
Tests: `python -m pytest tests -q`. Metrics and flags: `docs/spike/V1-03-qa.py`, `V1-03-qa.json`.

## Sources
- Clean flood fill on BrickLink set images: figures not listed in `docs/spike/V1-03-image-sources.json`.
- BrickLink minifig images for series 2-11, 13-17: `scripts/mn_map.json`, `scripts/apply_mn.py`.
- GrabCut on set images for the other flagged figures: `scripts/cutout_photo.py`, `scripts/apply_sn_grabcut.py`; white leftovers: `scripts/strip_white.py`.

## Known gaps
- 71049 Formula 1: no BrickLink code, 12 figures keep v1 images (`imgFallback` true).
- Bag images unusable: 8805 (sliver), 8684 (cropped), 8909 (banner). Their ages stay null (not readable).
- Mixed look: minifig images have no stand, set images do. Series 2-11 and 13-17 differ from the rest.
- White parts may be damaged by strip_white: 71024-1, 71027-11. Minor halos remain on some GrabCut images, for example 71000-16, 71000-3.
- Series 12 (71007), 71012 onward: not re-sourced unless flagged. QA still flags 42 by edge/opacity metric; most are large figures on stands, false positives on the review sheet.

## Review list
GrabCut images, 189, checked by eye only as a contact sheet (`docs/spike/V1-03-review-sheet.png`), not one by one:
71000-16, 71000-3, 71000-6, 71000-8, 71001-13, 71004-1, 71004-10, 71004-11, 71004-12, 71004-13, 71004-14, 71004-15, 71004-16, 71004-2, 71004-3, 71004-4, 71004-5, 71004-6, 71004-7, 71004-8, 71004-9, 71012-1, 71012-10, 71012-11, 71012-12, 71012-13, 71012-14, 71012-16, 71012-17, 71012-18, 71012-2, 71012-3, 71012-4, 71012-5, 71012-6, 71012-8, 71012-9, 71014-1, 71014-14, 71014-2, 71014-4, 71014-5, 71017-12, 71017-15, 71017-17, 71017-18, 71017-19, 71017-20, 71017-8, 71021-10, 71021-2, 71021-3, 71021-5, 71021-8, 71022-10, 71022-11, 71022-12, 71022-13, 71022-14, 71022-15, 71022-16, 71022-17, 71022-18, 71022-19, 71022-2, 71022-20, 71022-21, 71022-22, 71022-3, 71022-4, 71022-5, 71022-7, 71022-8, 71022-9, 71023-1, 71023-10, 71023-11, 71023-12, 71023-13, 71023-14, 71023-15, 71023-16, 71023-17, 71023-18, 71023-2, 71023-20, 71023-3, 71023-4, 71023-5, 71023-6, 71023-7, 71023-8, 71023-9, 71024-1, 71024-10, 71024-11, 71024-12, 71024-13, 71024-14, 71024-15, 71024-16, 71024-17, 71024-18, 71024-2, 71024-3, 71024-4, 71024-5, 71024-6, 71024-7, 71024-8, 71024-9, 71025-1, 71025-10, 71025-11, 71025-12, 71025-13, 71025-14, 71025-15, 71025-2, 71025-3, 71025-4, 71025-5, 71025-6, 71025-7, 71025-8, 71025-9, 71026-1, 71026-11, 71026-12, 71026-13, 71026-15, 71026-16, 71026-2, 71026-3, 71026-4, 71026-5, 71026-6, 71026-7, 71026-8, 71026-9, 71027-1, 71027-10, 71027-11, 71027-12, 71027-13, 71027-14, 71027-15, 71027-16, 71027-2, 71027-3, 71027-4, 71027-5, 71027-6, 71027-7, 71027-8, 71027-9, 71028-1, 71028-10, 71028-11, 71028-13, 71028-14, 71028-15, 71028-16, 71028-2, 71028-3, 71028-4, 71028-5, 71028-6, 71028-7, 71028-8, 71028-9, 71029-4, 71029-6, 71034-6, 71037-2, 8684-5, 8803-11, 8831-4, 8831-7, 8833-4, 8909-1, 8909-2, 8909-3, 8909-4, 8909-5, 8909-6, 8909-7, 8909-8, 8909-9
