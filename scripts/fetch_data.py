"""Fetch all LEGO Collectible Minifigures series and download every image.

Source: Rebrickable public CSV dumps (no API key). For each CMF sub-theme
(parent theme 535) it finds:
  - bag    : <base>-0           (random bag/box art, used as tile cover)
  - group  : "Complete"/"All Sets" set (all figures together, used as hero)
  - figures: every other <base>-N set (one per minifigure)

Outputs:
  originals/<base>/<set_num>.jpg   every downloaded set image, untouched
  originals/<base>/<set_num>.fig.jpg   the real Rebrickable minifig photo of a figure (preferred)
  site/img/<base>/<set_num>.webp   web image: bag = flat artwork crop, figure = trimmed/padded photo,
                                   group = resized photo (no background removal)
  site/data.json   catalog (series -> figures, local image paths)
  site/data.js     same catalog as `window.CATALOG = ...` (works from file://)
Re-running skips images that already exist (incremental update); --rebuild reprocesses all web images.
"""

import argparse
import csv
import gzip
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = 50_000_000  # decompression-bomb guard for downloaded images

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"
SITE = ROOT / "site"
ORIG = ROOT / "originals"
IMG = SITE / "img"

CSV_BASE = "https://cdn.rebrickable.com/media/downloads/"
CSV_FILES = ["themes", "sets", "inventories", "inventory_minifigs", "minifigs"]
CMF_THEME_ID = "535"
CSV_MAX_AGE_S = 24 * 3600
RETRY_AFTER_MAX_S = 60
GZIP_MAGIC = bytes([0x1F, 0x8B])
ALLOWED_HOST = "cdn.rebrickable.com"
MAX_IMAGE_BYTES = 20 * 1024 * 1024
MAX_CSV_BYTES = 100 * 1024 * 1024
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
SET_NUM_RE = re.compile(r"[A-Za-z0-9]+-[0-9]+", re.ASCII)
SERIES_ID_RE = re.compile(r"[A-Za-z0-9]+", re.ASCII)
WINDOWS_RESERVED_RE = re.compile(r"(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])", re.I)
USER_AGENT = "minifigures-extractor/1.0 (personal, non-commercial)"

GROUP_RE = re.compile(r"complete|all sets", re.I)
BAG_RE = re.compile(r"random (bag|box)", re.I)
SKIP_RE = re.compile(r"sealed box|tower box|6[ -]pack|^\d+-\d+$", re.I)


def _retry_after(value, attempt):
    """Seconds to wait for a Retry-After header (delta-seconds or HTTP-date); backoff if unusable."""
    try:
        return int(value)
    except (TypeError, ValueError):
        pass
    try:
        when = parsedate_to_datetime(value)
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return int((when - datetime.now(timezone.utc)).total_seconds())
    except (TypeError, ValueError, IndexError):
        return 2 ** attempt


def valid_set_num(value):
    return isinstance(value, str) and SET_NUM_RE.fullmatch(value) is not None


def check_url(url):
    """Raise ValueError unless url is https://cdn.rebrickable.com/... (exact host)."""
    try:
        u = urllib.parse.urlsplit(url)
        host, user = u.hostname, u.username
    except (ValueError, AttributeError):
        raise ValueError(f"URL not allowed: {str(url)[:80]!r}") from None
    if u.scheme != "https" or host != ALLOWED_HOST or user is not None or u.port not in (None, 443):
        raise ValueError(f"URL not allowed: {str(url)[:80]!r}")


class _CheckedRedirect(urllib.request.HTTPRedirectHandler):
    """Validate every redirect target before it is requested."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


OPENER = urllib.request.build_opener(_CheckedRedirect)


def http_get(url, retries=3, max_bytes=MAX_IMAGE_BYTES):
    """GET with retries and backoff. Returns bytes or None on 404.

    Only https://cdn.rebrickable.com URLs (also after redirects) are fetched, and the
    body may not exceed max_bytes; violations raise ValueError (never retried).
    """
    check_url(url)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with OPENER.open(req, timeout=60) as resp:
                check_url(resp.geturl())
                data = resp.read(max_bytes + 1)
                if len(data) > max_bytes:
                    raise ValueError(f"Response larger than {max_bytes} bytes")
                expected = resp.headers.get("Content-Length") if resp.headers else None
                if expected is not None and expected.isdigit() and len(data) != int(expected):
                    raise urllib.error.URLError(
                        f"truncated download ({len(data)} of {expected} bytes)")  # retried
                return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429:
                if attempt == retries - 1:
                    raise
                wait = _retry_after(e.headers.get("Retry-After") if e.headers else None, attempt)
                time.sleep(min(max(wait, 0), RETRY_AFTER_MAX_S))
                continue
            if 400 <= e.code < 500 or attempt == retries - 1:
                raise  # other client errors will not succeed on retry
        except (urllib.error.URLError, TimeoutError):
            if attempt == retries - 1:
                raise
        time.sleep(2 ** attempt)
    return None


def load_csv(name):
    """Download (cached for a day) and parse one Rebrickable CSV dump."""
    CACHE.mkdir(exist_ok=True)
    path = CACHE / f"{name}.csv.gz"
    if not path.exists() or time.time() - path.stat().st_mtime > CSV_MAX_AGE_S:
        print(f"Downloading {name}.csv.gz")
        data = http_get(CSV_BASE + f"{name}.csv.gz", max_bytes=MAX_CSV_BYTES)
        if data is None:
            raise RuntimeError(f"Could not download {name}.csv.gz (404 Not Found)")
        tmp = path.with_name(path.name + ".tmp")
        try:
            if data[:2] != GZIP_MAGIC:
                raise RuntimeError(f"{name}.csv.gz is not a gzip file (got {len(data)} bytes)")
            tmp.write_bytes(data)
            os.replace(tmp, path)
        finally:
            if tmp.exists():
                tmp.unlink()
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def suffix(set_num):
    try:
        return int(set_num.rsplit("-", 1)[1])
    except (IndexError, ValueError):
        return 10 ** 9  # non-numeric suffix sorts last and is never the bag (0)


def build_catalog(themes, sets):
    """Pure function: themes + sets rows -> list of series dicts (no images yet)."""
    by_theme = defaultdict(list)
    for s in sets:
        if not valid_set_num(s["set_num"]):
            print(f"  skipping set with invalid set_num {str(s.get('set_num'))[:40]!r}")
            continue
        by_theme[s["theme_id"]].append(s)

    catalog = []
    for t in themes:
        if t["parent_id"] != CMF_THEME_ID:
            continue
        rows = by_theme[t["id"]]
        if not rows:
            continue
        # The series code is the most common set-number prefix in the sub-theme.
        base = Counter(r["set_num"].split("-")[0] for r in rows).most_common(1)[0][0]
        own = sorted((r for r in rows if r["set_num"].split("-")[0] == base),
                     key=lambda r: suffix(r["set_num"]))

        bag = group = None
        figures = []
        for r in own:
            name = r["name"]
            if suffix(r["set_num"]) == 0 or BAG_RE.search(name):
                bag = bag or r
            elif GROUP_RE.search(name):
                group = group or r
            elif SKIP_RE.search(name):
                continue
            else:
                figures.append(r)
        if not figures:
            continue

        years = [int(r["year"]) for r in figures if r["year"].isdigit()]
        catalog.append({
            "id": base,
            "name": t["name"],
            "year": min(years) if years else None,
            "bag": bag and {"set_num": bag["set_num"], "src": bag["img_url"]},
            "group": group and {"set_num": group["set_num"], "src": group["img_url"]},
            "figures": [
                {"set_num": r["set_num"], "name": r["name"], "src": r["img_url"]}
                for r in figures
            ],
        })
    catalog.sort(key=lambda s: (s["year"] or 0, int(s["id"]) if s["id"].isdigit() else 0),
                 reverse=True)
    return catalog


def minifig_images(inventories, inventory_minifigs, minifigs):
    """set_num -> image URL of the first minifig in that set (fallback when the set photo is missing)."""
    inv_set = {r["id"]: r["set_num"] for r in inventories}
    fig_img = {r["fig_num"]: r["img_url"] for r in minifigs}
    out = {}
    for r in inventory_minifigs:
        set_num = inv_set.get(r["inventory_id"])
        img = fig_img.get(r["fig_num"])
        if set_num and img and set_num not in out:
            out[set_num] = img
    return out


def plan_figure_source(item, fig_url):
    """Choose the image for a figure: the minifig photo when its URL is allowed, else the set image.

    Sets item["source"] ("fig" | "set"), item["src"] (URL to fetch) and item["alt"] (set image URL).
    """
    set_url = item.get("src") or None
    item["alt"] = set_url
    if fig_url:
        try:
            check_url(fig_url)
        except ValueError as e:
            print(f"  ignoring minifig photo of {item['set_num']!r}: {e}")
            fig_url = None
    if fig_url:
        item["source"], item["src"] = "fig", fig_url
    else:
        item["source"], item["src"] = "set", set_url or ""


def local_path(series_id, set_num, src, fig=False):
    if (not SERIES_ID_RE.fullmatch(series_id or "") or WINDOWS_RESERVED_RE.fullmatch(series_id)
            or not valid_set_num(set_num)):
        raise ValueError(f"invalid id: {series_id!r} / {set_num!r}")
    ext = Path(urllib.parse.urlsplit(src).path).suffix.lower()
    if ext not in ALLOWED_EXTS:
        ext = ".jpg"
    dest = ORIG / series_id / (f"{set_num}.fig{ext}" if fig else f"{set_num}{ext}")
    if not dest.resolve().is_relative_to(ORIG.resolve()):
        raise ValueError(f"path escapes repo: {dest}")
    return dest


def download_one(job):
    """Download one image if missing. Returns (status, job)."""
    item, dest = job
    if dest.exists() and dest.stat().st_size > 0:
        return "skip", job
    tmp = dest.with_name(dest.name + ".tmp")
    try:
        got_data = False
        last_err = None
        for src in (item["src"], item.get("alt")):
            if not src:
                continue
            data = http_get(src)
            if not data:
                continue
            got_data = True
            try:
                dest.parent.mkdir(parents=True, exist_ok=True)
                tmp.write_bytes(data)
                with Image.open(tmp) as im:  # reject HTML / truncated downloads
                    im.verify()
            except Exception as e:  # bad bytes: try the next source
                last_err = e
                print(f"  invalid image from {src!r}: {type(e).__name__}", flush=True)
                continue
            os.replace(tmp, dest)
            return "ok", job
        if not got_data:
            return "missing", job
        raise last_err
    except Exception as e:  # one bad image must not abort the run
        print(f"  ERROR {item.get('src')!r}: {type(e).__name__}: {e}", flush=True)
        return "error", job
    finally:
        if tmp.exists():
            tmp.unlink()


def process_all(catalog, rebuild=False):
    """Make the web image for every downloaded original that has none yet, or whose original
    is newer than it (source changed), or all of them with rebuild=True."""
    from process_images import color_hex, safe_process_file

    todo = []
    for s in catalog:
        for kind, items in (("bag", [s["bag"]]), ("group", [s["group"]]), ("figure", s["figures"])):
            for item in items:
                if item and item.get("orig"):
                    dest = IMG / s["id"] / f"{item['set_num']}.webp"
                    item["img"] = dest.relative_to(SITE).as_posix()
                    if rebuild or not dest.exists() or dest.stat().st_mtime < Path(item["orig"]).stat().st_mtime:
                        todo.append((item["orig"], dest, kind, item))
    print(f"Processing {len(todo)} images")
    errors = 0
    for i, (src, dest, kind, item) in enumerate(todo, 1):
        if not safe_process_file(src, dest, kind):
            item["img"] = None
            errors += 1
        if i % 25 == 0:
            print(f"  {i}/{len(todo)}", flush=True)
    if errors:
        print(f"Processing errors: {errors}")

    # Tile color: average color of the flat bag artwork.
    from PIL import Image
    import numpy as np
    for s in catalog:
        s["color"] = None
        if s["bag"] and s["bag"].get("img"):
            with Image.open(SITE / s["bag"]["img"]) as im:
                s["color"] = color_hex(np.asarray(im.convert("RGB").resize((32, 32))))


def parse_args(argv=None):
    ap = argparse.ArgumentParser(description="Fetch LEGO CMF data and images, build the site data.")
    ap.add_argument("--rebuild", action="store_true",
                    help="reprocess all web images from the originals")
    return ap.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    themes, sets, inventories, inventory_minifigs, minifigs = (load_csv(n) for n in CSV_FILES)
    catalog = build_catalog(themes, sets)
    fig_photos = minifig_images(inventories, inventory_minifigs, minifigs)

    jobs = []  # (download item, dest, real catalog item)
    for s in catalog:
        for f in s["figures"]:
            plan_figure_source(f, fig_photos.get(f["set_num"]))
        for item in [s["bag"], s["group"], *s["figures"]]:
            if item:
                item["img"] = item["orig"] = None
                if item["src"]:
                    fig = item.get("source") == "fig"
                    try:
                        dest = local_path(s["id"], item["set_num"], item["src"], fig=fig)
                    except ValueError as e:
                        print(f"  skipping {item['set_num']!r}: {e}")
                        continue
                    # Figure photos are fetched alone (no alt): a failure falls back to the set image below.
                    job_item = {"src": item["src"], "set_num": item["set_num"]} if fig else item
                    jobs.append((job_item, dest, item))

    print(f"{len(catalog)} series, {sum(len(s['figures']) for s in catalog)} figures, "
          f"{len(jobs)} images")
    counts = Counter()
    missing = []
    series_of = {id(f): s["id"] for s in catalog for f in s["figures"]}

    def run(batch):
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = pool.map(download_one, [(ji, d) for ji, d, _ in batch])
            for i, (status, _) in enumerate(results, 1):
                _, dest, item = batch[i - 1]
                counts[status] += 1
                if status in ("ok", "skip"):
                    item["orig"] = dest
                if i % 100 == 0:
                    print(f"  {i}/{len(batch)} {dict(counts)}")
                yield status, dest, item

    fallback = []
    for status, dest, item in run(jobs):
        if item.get("source") == "fig" and status not in ("ok", "skip"):
            if item.get("alt"):
                item["source"], item["src"] = "set", item["alt"]
                try:
                    fallback.append((item, local_path(series_of[id(item)], item["set_num"], item["src"]), item))
                except ValueError as e:
                    print(f"  skipping {item['set_num']!r}: {e}")
            else:
                missing.append(item["set_num"])
        elif status == "missing":
            missing.append(item["set_num"])
    if fallback:
        print(f"Falling back to set image for {len(fallback)} figures")
        for status, dest, item in run(fallback):
            if status == "missing":
                missing.append(item["set_num"])
    print(f"Download: {dict(counts)}")
    if missing:
        print("Missing images:", ", ".join(missing))

    process_all(catalog, rebuild=args.rebuild)

    for s in catalog:
        for item in [s["bag"], s["group"], *s["figures"]]:
            if item:
                source = item.pop("source", None)
                for k in ("src", "alt", "orig"):
                    item.pop(k, None)
                if source:
                    item["src"] = source  # "fig" | "set": which image the figure uses

    payload = json.dumps(catalog, ensure_ascii=False, indent=1)
    (SITE / "data.json").write_text(payload, encoding="utf-8")
    (SITE / "data.js").write_text(f"window.CATALOG = {payload};\n", encoding="utf-8")

    size_mb = sum(p.stat().st_size for p in IMG.rglob("*") if p.is_file()) / 1e6
    print(f"Done. Web images: {size_mb:.0f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
