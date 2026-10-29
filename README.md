# minifigures-extractor

Static website of every LEGO Collectible Minifigures series (Series 1–29, Disney, Marvel,
Harry Potter, Ninjago Movie, ...). Home page lists all series; each series page shows a hero
banner with all figures, then every minifigure one at a time.

## What it is
- `scripts/fetch_data.py` — downloads the catalog from Rebrickable's public CSV dumps (no API key)
  and every image (bag, group shot, each figure) into `site/img/`.
- `site/` — the website (plain HTML/CSS/JS, no build step). Works opened from disk and on GitHub Pages.

## Install
Python 3.10+ only. No packages needed.

## Use
```
python scripts/fetch_data.py        # first run downloads everything; re-run adds new series only
start site\index.html               # open the site locally (Windows)
python -m unittest discover tests   # run tests
```

### Publish to phone (GitHub Pages)
1. Create an empty GitHub repo, then: `git remote add origin <url>` and `git push -u origin master`.
2. Repo Settings → Pages → Source: GitHub Actions. The workflow in `.github/workflows/pages.yml`
   publishes `site/` on every push to `master`.
3. Open `https://<user>.github.io/<repo>/` on the phone.

## Data source
Catalog and images: [Rebrickable](https://rebrickable.com) data downloads. Personal, non-commercial use.
LEGO is a trademark of the LEGO Group, which does not sponsor this project.
