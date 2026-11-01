"""Re-cut figures flagged by docs/spike/V1-03-qa.py from their cached BrickLink set images with GrabCut.

Figures already sourced from minifig images (docs/spike/V1-03-image-sources.json) are skipped.
Usage: python scripts/apply_sn_grabcut.py
"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cutout_photo import cutout_photo

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPIKE = ROOT / "docs/spike"
LOG = SPIKE / "V1-03-image-sources.json"
def main():
    code = {s["id"]: s["bricklinkCode"] for s in json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]}
    log = json.loads(LOG.read_text())
    done, missing = 0, []
    for r in json.loads((SPIKE / "V1-03-qa.json").read_text())["flagged"]:
        fid = r["id"]
        if fid in log:
            continue
        sid, n = fid.split("-")
        src = SPIKE / "V1-03-check" / f"{code[sid]}-{n}.png"
        if not src.exists():
            missing.append(fid)
            continue
        out = ROOT / "site/img" / sid / f"{fid}.webp"
        out.parent.mkdir(parents=True, exist_ok=True)
        cutout_photo(src).save(out, "WEBP", quality=90)
        log[fid] = {"sn": src.name, "method": "grabcut", "needs_review": True}
        done += 1
    LOG.write_text(json.dumps(log, indent=1))
    print("written", done, "missing", missing)


if __name__ == "__main__":
    main()
