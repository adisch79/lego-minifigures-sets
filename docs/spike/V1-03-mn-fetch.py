"""Download BrickLink minifig images for building the figure -> col number map.

Usage: python docs/spike/V1-03-mn-fetch.py <first> <last>
Cache: docs/spike/V1-03-check/mn/col<NNN>.png (git-ignored). 1 request / 2 s, cached files are not refetched.
"""
import pathlib, sys, time, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / "docs/spike/V1-03-check/mn"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
URL = "https://img.bricklink.com/ItemImage/MN/0/col{n:03d}.png"

CACHE.mkdir(parents=True, exist_ok=True)
got, missing = 0, []
for n in range(int(sys.argv[1]), int(sys.argv[2]) + 1):
    dest = CACHE / f"col{n:03d}.png"
    if dest.exists():
        continue
    try:
        req = urllib.request.Request(URL.format(n=n), headers={"User-Agent": UA})
        dest.write_bytes(urllib.request.urlopen(req, timeout=30).read())
        got += 1
    except urllib.error.HTTPError as e:
        missing.append((n, e.code))
    time.sleep(2)
print("fetched", got, "missing", missing)
