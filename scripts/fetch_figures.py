"""Fetch BrickLink figure images and write transparent webp cut-outs to site/img.

Usage: python scripts/fetch_figures.py <seriesId> [<seriesId> ...] [--sheet OUT.png]
- source URL: https://img.bricklink.com/ItemImage/SN/0/<code>-<bricklinkNo or no>.png
- cache: docs/spike/V1-03-check/ (git-ignored), each URL fetched once, 1 request / 2 s
- output: site/img/<id>/<id>-<n>.webp (path from the V1-02 design doc)
- series with a null bricklinkCode are skipped
- reuses mockups/assets/figs/<id>-<n>.webp when present (V0-06 series), no fetch
- resumable: manifest docs/spike/V1-03-cutouts-done.json; an output is skipped when listed,
  present and not older than its source
"""
import json, pathlib, shutil, sys, time, urllib.request, urllib.error
from PIL import Image, ImageDraw
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cutout import cutout

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "docs/spike/V1-03-check"
MOCK = ROOT / "mockups/assets/figs"
MANIFEST = ROOT / "docs/spike/V1-03-cutouts-done.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
URL = "https://img.bricklink.com/ItemImage/SN/0/{c}-{n}.png"
last = [0.0]
requests = [0]


def fetch(code, n):
    dest = CACHE / f"{code}-{n}.png"
    if dest.exists():
        return dest
    wait = 2.0 - (time.time() - last[0])
    if wait > 0:
        time.sleep(wait)
    last[0] = time.time()
    requests[0] += 1
    req = urllib.request.Request(URL.format(c=code, n=n), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        dest.write_bytes(r.read())
    return dest


def checker(w, h, s=8):
    im = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=(200, 200, 200))
    return im


def sheet(paths, out, cell=100, cols=12):
    rows = (len(paths) + cols - 1) // cols
    sh = Image.new("RGB", (cols * cell, rows * cell), "white")
    for i, p in enumerate(paths):
        bg = checker(cell, cell).convert("RGBA")
        im = Image.open(p).convert("RGBA")
        im.thumbnail((cell, cell))
        bg.alpha_composite(im, ((cell - im.width) // 2, (cell - im.height) // 2))
        sh.paste(bg.convert("RGB"), ((i % cols) * cell, (i // cols) * cell))
    sh.save(out)


def main(argv):
    out_sheet = None
    if "--sheet" in argv:
        i = argv.index("--sheet")
        out_sheet = pathlib.Path(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    CACHE.mkdir(parents=True, exist_ok=True)
    cat = {s["id"]: s for s in json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]}
    done = set(json.loads(MANIFEST.read_text())) if MANIFEST.exists() else set()
    written, failures, outs = 0, [], []
    for sid in argv:
        s = cat[sid]
        code = s["bricklinkCode"]
        if not code:
            print("skip (no code)", sid)
            continue
        t0 = time.time()
        for f in s["figures"]:
            n = f.get("bricklinkNo", f["no"])
            out = ROOT / "site/img" / sid / f"{f['id']}.webp"
            mock = MOCK / f"{f['id']}.webp"
            src = mock if mock.exists() else CACHE / f"{code}-{n}.png"
            if f["id"] in done and out.exists() and src.exists() and out.stat().st_mtime >= src.stat().st_mtime:
                outs.append(out)
                continue
            try:
                if mock.exists():
                    shutil.copyfile(mock, out)
                else:
                    o = cutout(fetch(code, n))
                    if o.height > 480:
                        o = o.resize((round(o.width * 480 / o.height), 480), Image.LANCZOS)
                    o.save(out, quality=90)
                done.add(f["id"]); written += 1; outs.append(out)
            except Exception as e:
                failures.append((f["id"], str(e)))
        MANIFEST.write_text(json.dumps(sorted(done)))
        print(f"{sid} {code} {time.time() - t0:.1f}s", flush=True)
    if out_sheet and outs:
        sheet(outs, out_sheet)
    print("written", written, "failures", failures, "requests", requests[0])


if __name__ == "__main__":
    main(sys.argv[1:])
