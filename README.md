# minifigures-extractor

Static website of every LEGO Collectible Minifigures series (Series 1–29, Disney, Marvel,
Harry Potter, Ninjago Movie, ...). Home page lists all series; each series page shows a hero
banner with all figures, then every minifigure one at a time.

## What it is
- `scripts/fetch_data.py` — downloads the catalog from Rebrickable's public CSV dumps (no API key)
  and every image (bag, group shot, each figure) into `originals/`, then builds web images in `site/img/`.
- `scripts/process_images.py` — figures: real Rebrickable minifig photo, border trimmed, padded to 3:4
  → WebP. Group shots: resized only. Bags: cropped to the flat artwork rectangle. No background removal.
- `site/` — the website (plain HTML/CSS/JS, no build step). Works opened from disk and on GitHub Pages.

## Install
Python 3.10+, then:
```
python -m pip install --user -r requirements.txt -c constraints.txt
```
No model download is needed (rembg was removed in E8-01).

## Use
```
python scripts/fetch_data.py --rebuild   # reprocess every web image from originals
python scripts/fetch_data.py        # first run: download + process all (~30 min); re-run: new series only
start site\index.html               # open the site locally (Windows)
python -m unittest discover tests   # run tests
```

### Live site
**https://adisch79.github.io/lego-minifigures-sets/**

The workflow in `.github/workflows/pages.yml` publishes `site/` on every push to `master`.
Flow: `feature/<story>` → `dev` → release merge into `master` (which deploys).

Repo settings this needs (already done): Pages source = GitHub Actions; default branch = `master`;
environment `github-pages` allows `master` to deploy.

## Data source
Catalog and images: [Rebrickable](https://rebrickable.com) data downloads. Personal, non-commercial use.
LEGO is a trademark of the LEGO Group, which does not sponsor this project.
