"""Render composed series cards with the owner-approved v4 template (docs/spike/V0-06-cards.py).

Usage: python scripts/build_cards.py [<seriesId> ...]   (default: every numbered series without a card)
Output: app/public/cards/<id>.png. Figures come from site/img, colours from the series bag image.
Front row: five figures evenly spaced through the series.
"""
import importlib.util, json, os, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "app/public/cards"
TMP = ROOT / "docs/spike/V1-03-check/cards"
spec = importlib.util.spec_from_file_location("v4", ROOT / "docs/spike/V0-06-cards.py")
v4 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v4)
# Fallback colours for an unusable bag image. SOURCE: owner-approved v4 background, V0-06-cards.py V4_BG.
FALLBACK = v4.V4_BG


def fig_size(path):
    """V0-06 asks for <assets>/figs/<sid>-<n>.webp; figures live in site/img/<sid>/."""
    name = os.path.basename(path)
    return v4.__dict__["_real_wide"](ROOT / "site/img" / name.split("-")[0] / name)


def palette(sid):
    bag = ROOT / "site/img" / sid / f"{sid}-0.webp"
    a = np.asarray(Image.open(bag).convert("RGB")).reshape(-1, 3).astype(float)
    sat, lum = a.max(1) - a.min(1), a @ [0.299, 0.587, 0.114]
    a, lum = a[(lum > 40) & (lum < 235) & (sat > 25)], lum[(lum > 40) & (lum < 235) & (sat > 25)]
    if len(a) < 2000:
        return FALLBACK
    order = np.argsort(lum)
    band = lambda lo, hi: a[order[int(len(order) * lo):int(len(order) * hi)]].mean(0)
    dark = band(0.08, 0.22)
    return v4.hexc(band(0.80, 0.95)), v4.hexc(band(0.45, 0.60)), v4.hexc(dark), v4.hexc(dark * 0.3)


def spec_for(s):
    nos = [f["no"] for f in s["figures"]]
    picks = [nos[round(i * (len(nos) - 1) / 4)] for i in range(5)]
    front = [picks[3], picks[1], picks[0], picks[2], picks[4]]
    rest = [n for n in nos if n not in front]
    return dict(id=s["id"], name=s["name"], age=s.get("age"), count=len(nos), logo=None, series_no=s["seriesNo"],
                front=front, seal_top=f"SERIES {s['seriesNo']}", rows=(rest[1::2], rest[0::2]))


def main():
    series = json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]
    v4.__dict__["_real_wide"] = v4.wide
    v4.wide = fig_size
    v4.bag_palette = palette
    ids = sys.argv[1:] or [s["id"] for s in series if s["name"].startswith("Series") and not (OUT / f"{s['id']}.png").exists()]
    TMP.mkdir(parents=True, exist_ok=True)
    img, logos = (ROOT / "site/img").as_uri(), (ROOT / "mockups/assets/logos").as_uri()
    for s in (x for x in series if x["id"] in ids):
        html = v4.card(spec_for(s))[0].replace(f"../assets/figs/{s['id']}-", f"{img}/{s['id']}/{s['id']}-")
        html = html.replace("../assets/logos/", logos + "/")
        if not s.get("age"):  # bag image unreadable: no age is printed rather than a guess
            html = html.replace('<div class="lab">Ages</div><div class="age">None</div><div class="rule"></div>', "")
        page = TMP / f"{s['id']}.html"
        page.write_text(html, encoding="utf-8")
        v4.render(str(page), str(OUT / f"{s['id']}.png"))
        print(s["id"], flush=True)


if __name__ == "__main__":
    main()
