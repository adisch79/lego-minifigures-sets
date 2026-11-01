"""QA of all figure cut-outs: alpha metrics per image, flag list, contact sheets.

Output: docs/spike/V1-03-qa.json, docs/spike/V1-03-qa-sheet-<n>.png (magenta background shows halos/holes).
Run: python docs/spike/V1-03-qa.py
"""
import json, math, pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/spike"
CELL, COLS, ROWS = 96, 16, 11


def metrics(path):
    a = np.asarray(Image.open(path).convert("RGBA"))[:, :, 3]
    h, w = a.shape
    solid = a > 128
    edge = np.r_[solid[0], solid[-1], solid[:, 0], solid[:, -1]].mean()
    return {"w": w, "h": h, "opaque": round(float(solid.mean()), 3), "edge": round(float(edge), 3)}


cat = json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))
rows, missing = [], []
for s in cat["series"]:
    if not s.get("bricklinkCode"):
        continue
    for f in s["figures"]:
        p = ROOT / "site/img" / s["id"] / f"{f['id']}.webp"
        if not p.exists():
            missing.append(f["id"])
            continue
        rows.append({"id": f["id"], "series": s["id"], "path": p, **metrics(p)})

ops = np.array([r["opaque"] for r in rows])
lo, hi = np.percentile(ops, 1), np.percentile(ops, 99)
for r in rows:
    why = []
    if r["opaque"] > 0.75: why.append("no background removed")
    if r["opaque"] < 0.12: why.append("too little left")
    if r["edge"] > 0.15: why.append("touches edge")
    r["flags"] = why
flagged = [r for r in rows if r["flags"]]

for i in range(math.ceil(len(rows) / (COLS * ROWS))):
    sheet = Image.new("RGB", (COLS * CELL, ROWS * CELL), (255, 0, 255))
    for j, r in enumerate(rows[i * COLS * ROWS:(i + 1) * COLS * ROWS]):
        im = Image.open(r["path"]).convert("RGBA")
        im.thumbnail((CELL - 4, CELL - 4))
        sheet.paste(im, (j % COLS * CELL + 2, j // COLS * CELL + 2), im)
    sheet.save(OUT / f"V1-03-qa-sheet-{i + 1}.png")

clean = [{k: v for k, v in r.items() if k != "path"} for r in flagged]
(OUT / "V1-03-qa.json").write_text(json.dumps({"checked": len(rows), "missing": missing, "flagged": clean}, indent=1))
print("checked", len(rows), "missing", len(missing), "flagged", len(flagged), "opaque p1/p99", lo, hi)
for r in clean: print(r["id"], r["opaque"], r["edge"], r["flags"])
