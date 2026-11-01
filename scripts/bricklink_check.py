"""Download BrickLink figure 1 and last figure per series, build contact sheets.

Rate 1 request / 2 s, each URL fetched once (files already on disk are skipped).
Output: docs/spike/V1-03-check/*.png, docs/spike/V1-03-codes-sheet-N.png,
docs/spike/V1-03-check-status.json
"""
import json, pathlib, time, urllib.request, urllib.error
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/spike/V1-03-check"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
URL = "https://img.bricklink.com/ItemImage/SN/0/{c}-{n}.png"
CELL = 120
last = [0.0]

def fetch(code, n):
    dest = OUT / f"{code}-{n}.png"
    if dest.exists():
        return 200
    wait = 2.0 - (time.time() - last[0])
    if wait > 0:
        time.sleep(wait)
    last[0] = time.time()
    try:
        req = urllib.request.Request(URL.format(c=code, n=n), headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            dest.write_bytes(r.read())
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return str(e)

def cell(path):
    im = Image.new("RGB", (CELL, CELL), (235, 235, 235))
    if path and path.exists():
        a = Image.open(path).convert("RGBA")
        a.thumbnail((CELL, CELL))
        bg = Image.new("RGBA", a.size, (255, 255, 255, 255))
        bg.alpha_composite(a)
        im.paste(bg.convert("RGB"), ((CELL - a.width) // 2, (CELL - a.height) // 2))
    return im

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cat = json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))
    rows, status = [], {}
    for s in cat["series"]:
        code = s["bricklinkCode"]
        first, lastf = s["figures"][0], max(s["figures"], key=lambda f: f["no"])
        nums = [first.get("bricklinkNo", first["no"]), lastf.get("bricklinkNo", lastf["no"])]
        st = [fetch(code, n) for n in nums]
        status[s["id"]] = {"code": code, "nums": nums, "status": st}
        v1 = [ROOT / "site/img" / s["id"] / f"{s['id']}-{f['no']}.webp" for f in (first, lastf)]
        rows.append((s, nums, v1, code))
    (ROOT / "docs/spike/V1-03-check-status.json").write_text(json.dumps(status, indent=1))
    W = 4 * CELL + 280
    per = 18
    for p in range(0, len(rows), per):
        chunk = rows[p:p + per]
        sheet = Image.new("RGB", (W, CELL * len(chunk)), "white")
        d = ImageDraw.Draw(sheet)
        for i, (s, nums, v1, code) in enumerate(chunk):
            y = i * CELL
            d.text((6, y + 6), f"{s['id']}\n{s['name'][:36]}\n{code}  -{nums[0]} / -{nums[1]}", fill="black")
            x = 280
            for img in (v1[0], OUT / f"{code}-{nums[0]}.png", v1[1], OUT / f"{code}-{nums[1]}.png"):
                sheet.paste(cell(img), (x, y)); x += CELL
            d.line([(0, y + CELL - 1), (W, y + CELL - 1)], fill=(180, 180, 180))
        sheet.save(ROOT / f"docs/spike/V1-03-codes-sheet-{p // per + 1}.png")
    bad = {k: v for k, v in status.items() if any(x != 200 for x in v["status"])}
    print("non-200:", bad)

if __name__ == "__main__":
    main()
