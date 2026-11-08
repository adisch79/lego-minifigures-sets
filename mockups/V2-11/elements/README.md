# V2-11 badge elements

What: every part of the card badge (minifigure head with the count, round series frame) as a separate PNG with a transparent background. Upright (no tilt), 4x the card size. The owner assembles the badge from these by hand; the result becomes the reference for `badge()` in `scripts/build_cards.py`.

Files:
- `head-full.png` (stud + face + neck together), `head-stud.png`, `head-face.png`, `head-neck.png`
- `checkbox.png`, `to-collect.png`, `count-<n>.png` for every figure count in the catalog (9, 12, 16, 17, 18, 20, 22)
- `series-circle.png`, `series-label.png`, `series-<n>.png` for every series number in the catalog

Rebuild: `python mockups/V2-11/build_elements.py` (needs Chrome at the path in `scripts/build_cards.py` and Pillow).
