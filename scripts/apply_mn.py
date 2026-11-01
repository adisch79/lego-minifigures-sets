"""Write site/img cut-outs from cached BrickLink minifig images, using scripts/mn_map.json.

Usage: python scripts/apply_mn.py [<seriesId> ...]   (default: every mapped series)
- white background: flood fill (scripts/cutout.py)
- photo background (under 90% of border pixels near white): GrabCut (scripts/cutout_photo.py),
  listed as needs_review in docs/spike/V1-03-image-sources.json
"""
import json, pathlib, sys
import numpy as np
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cutout import cutout
from cutout_photo import cutout_photo

ROOT = pathlib.Path(__file__).resolve().parent.parent
MN = ROOT / "docs/spike/V1-03-check/mn"
LOG = ROOT / "docs/spike/V1-03-image-sources.json"


def white_border(path):
    a = np.asarray(Image.open(path).convert("RGB"))
    b = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    return float((b.min(axis=1) >= 238).mean())


cat = json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))
counts = {s["id"]: len(s["figures"]) for s in cat["series"]}
smap = json.loads((ROOT / "scripts/mn_map.json").read_text())
log = json.loads(LOG.read_text()) if LOG.exists() else {}
for sid in sys.argv[1:] or smap:
    v = smap[sid]
    cols = v.get("list") or [v["first"] + i for i in range(counts[sid])]
    assert len(cols) == counts[sid], sid
    for no, c in enumerate(cols, 1):
        src = MN / f"col{c:03d}.png"
        photo = white_border(src) < 0.9
        im = cutout_photo(src) if photo else cutout(src)
        im.save(ROOT / "site/img" / sid / f"{sid}-{no}.webp", "WEBP", quality=90, method=6)
        log[f"{sid}-{no}"] = {"mn": f"col{c:03d}", "method": "grabcut" if photo else "flood", "needs_review": photo}
LOG.write_text(json.dumps(log, indent=1))
print("written", len(log), "needs_review", sorted(k for k, r in log.items() if r["needs_review"]))
