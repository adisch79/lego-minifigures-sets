"""Build app/public/catalog.json (contract v2) from site/data.json + scripts/catalog_overrides.json.

Pure, offline, deterministic transform: same input gives byte-identical output.
Design: docs/design/V1-02-catalog-v2.md.

Usage:  python scripts/build_catalog.py [output_path]
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OVERRIDES = Path(__file__).resolve().parent / "catalog_overrides.json"
DEFAULT_OUT = ROOT / "app" / "public" / "catalog.json"

SOURCE = "site/data.json (Rebrickable CSV dumps) + scripts/catalog_overrides.json"
MAIN_RE = re.compile(r"^Series (\d+) Minifigures$")
NUMBERED_RE = re.compile(r"^(.*) Series (\d+)$")
OVERRIDE_KEYS = {"line", "seriesNo", "age", "bricklinkCode", "figures", "source"}


def derive_line(name):
    """Return (line, seriesNo) parsed from a Rebrickable sub-theme name."""
    m = MAIN_RE.match(name)
    if m:
        return "Series", int(m.group(1))
    m = NUMBERED_RE.match(name)
    if m:
        return m.group(1), int(m.group(2))
    if name.endswith(" Minifigures") and len(name) > len(" Minifigures"):
        return name[: -len(" Minifigures")], None
    return name, None


def _check_image(site, path, what):
    if path is not None and not (site / path).is_file():
        raise ValueError(f"{what}: image file missing: {path}")


def build(data, overrides, site=SITE):
    ov_all = overrides.get("series", {})
    ids = {s["id"] for s in data}
    for sid, ov in ov_all.items():
        if sid not in ids:
            raise ValueError(f"override for unknown series {sid}")
        if not ov.get("source"):
            raise ValueError(f"override {sid} has no source")
        if "seriesNo" in ov and ov["seriesNo"] is not None and (
                type(ov["seriesNo"]) is not int):
            raise ValueError(f"override {sid}: seriesNo must be int or null")
        if "age" in ov and not (isinstance(ov["age"], str) and re.fullmatch(r"\d+\+", ov["age"])):
            raise ValueError(f"override {sid}: age must look like '5+'")
        if "bricklinkCode" in ov and not (
                isinstance(ov["bricklinkCode"], str)
                and re.fullmatch(r"[a-z0-9]+", ov["bricklinkCode"])):
            raise ValueError(f"override {sid}: bricklinkCode must be lowercase alphanumeric")
        for fid, fo in ov.get("figures", {}).items():
            if not (isinstance(fo, dict) and set(fo) == {"bricklinkNo"}
                    and type(fo["bricklinkNo"]) is int and fo["bricklinkNo"] >= 1):
                raise ValueError(f"override {sid} figure {fid}: expected {{bricklinkNo: int>=1}}")
            if not any(f["set_num"] == fid for s2 in data if s2["id"] == sid for f in s2["figures"]):
                raise ValueError(f"override {sid}: unknown figure {fid}")
        extra = set(ov) - OVERRIDE_KEYS
        if extra:
            raise ValueError(f"override {sid} has unknown keys {sorted(extra)}")

    series_out, fig_ids = [], set()
    for s in data:
        sid = s["id"]
        if not re.fullmatch(r"\d{4,6}", sid):
            raise ValueError(f"bad series id {sid!r}")
        ov = ov_all.get(sid, {})
        line, no = derive_line(s["name"])
        line = ov.get("line", line)
        no = ov["seriesNo"] if "seriesNo" in ov else no
        bag = s["bag"]["img"] if s.get("bag") else None
        _check_image(site, bag, f"series {sid} bag")
        figures = []
        for f in s["figures"]:
            if not re.fullmatch(r"\d{4,6}-\d+", f["set_num"]):
                raise ValueError(f"bad figure id {f['set_num']!r}")
        for f in sorted(s["figures"], key=lambda f: int(f["set_num"].rsplit("-", 1)[1])):
            fid = f["set_num"]
            if fid in fig_ids or fid in ids:
                raise ValueError(f"duplicate or series-colliding figure id {fid}")
            fig_ids.add(fid)
            if not fid.startswith(sid + "-"):
                raise ValueError(f"figure {fid} does not belong to series {sid}")
            img = f.get("img")
            _check_image(site, img, f"figure {fid}")
            fig = {
                "id": fid,
                "no": int(fid.rsplit("-", 1)[1]),
                "name": f["name"],
                "img": img,
                # A series with a BrickLink code has a cut-out for every figure (V1-03).
                "imgFallback": f.get("src") == "set" and not ov.get("bricklinkCode"),
            }
            bl_no = ov.get("figures", {}).get(fid, {}).get("bricklinkNo")
            if bl_no is not None and bl_no != fig["no"]:
                fig["bricklinkNo"] = bl_no
            figures.append(fig)
        series_out.append({
            "id": sid,
            "name": s["name"],
            "line": line,
            "seriesNo": no,
            "year": int(s["year"]),
            "age": ov.get("age"),
            "bricklinkCode": ov.get("bricklinkCode"),
            "figureCount": len(figures),
            "bag": bag,
            "card": None,
            "figures": figures,
        })
    series_out.sort(key=lambda s: (-s["year"], -int(s["id"])))
    return {"version": 2, "source": SOURCE, "series": series_out}


def main(out=DEFAULT_OUT):
    data = json.loads((SITE / "data.json").read_text(encoding="utf-8"))
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    catalog = build(data, overrides, SITE)
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(catalog, ensure_ascii=False, indent=1) + "\n"
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(payload)
    n = sum(len(s["figures"]) for s in catalog["series"])
    print(f"wrote {out}: {len(catalog['series'])} series, {n} figures")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT)
