"""Render composed series cards with the owner-approved v4 template (docs/spike/V0-06-cards.py).

Usage: python scripts/build_cards.py [<seriesId> ...]   (default: only series without a card, so name ids to re-render)
Output: app/public/cards/<id>.png. Figures come from site/img, colours from the series bag image.
Front row: five figures evenly spaced through the series.
"""
import importlib.util, json, os, pathlib, sys
import numpy as np
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cutout import cutout

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


# Licensed series: logo file in mockups/assets/logos, width on the card, top offset, optional halo for contrast.
# SOURCE: logo origins in mockups/assets/logos/SOURCES.md; layout tuned by eye against the approved v4 card
# (logo_w 400-430, top 206px). Tall logos sit higher so the crowd does not cover them.
WHITE_HALO = "drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 4px 8px rgba(0,0,0,.5))"
DARK_HALO = "drop-shadow(0 0 3px #000) drop-shadow(0 0 8px rgba(0,0,0,.8))"
LICENSED = {
    "71050": ("spider-verse.png", 370, 165, None), "71049": ("formula-1.png", 340, 170, None),
    "71047": ("dungeons-dragons.png", 350, 165, WHITE_HALO), "71039": ("marvel-studios.png", 420, 170, None),
    "71033": ("muppets.png", 400, 150, None), "71030": ("looney-tunes.png", 210, 40, None),
    "71028": ("harry-potter.png", 420, 130, None), "71026": ("dc.png", 200, 50, None),
    "71024": ("disney.png", 310, 150, DARK_HALO), "71023": ("lego-movie-2.png", 215, 60, None),
    "71022": ("harry-potter.png", 420, 130, None), "71020": ("lego-batman-movie.png", 430, 140, None),
    "71017": ("lego-batman-movie.png", 430, 140, None), "71014": ("dfb.png", 160, 40, DARK_HALO),
    "71012": ("disney.png", 310, 150, DARK_HALO), "71009": ("simpsons.png", 420, 150, None),
    "71005": ("simpsons.png", 420, 150, None), "71004": ("lego-movie.png", 310, 145, None),
    "8909": ("team-gb.png", 170, 40, DARK_HALO),
}
# v1 images on a white background: cut out for the card only. SOURCE: docs/spike/V1-03-gaps.md (71049 has no BrickLink code).
OPAQUE_FIGURES = {"71049"}


def spec_for(s):
    nos = [f["no"] for f in s["figures"]]
    picks = [nos[round(i * (len(nos) - 1) / 4)] for i in range(5)]
    front = [picks[3], picks[1], picks[0], picks[2], picks[4]]
    rest = [n for n in nos if n not in front]
    spec = dict(id=s["id"], name=s["name"], age=s.get("age"), count=len(nos), logo=None, series_no=s.get("seriesNo"),
                front=front, seal_top=f"SERIES {s.get('seriesNo')}", rows=(rest[1::2], rest[0::2]))
    if s["id"] in LICENSED:
        spec["logo"], spec["logo_w"] = LICENSED[s["id"]][:2]
        # Series N in a licensed name goes on the seal, since the theme logo is shared across its series.
        last = s["name"].split()[-1]
        spec["seal_top"] = f"SERIES {last}" if s["name"].split()[-2:-1] == ["Series"] else "MINIFIGURES"
    return spec


def patch(html, old, new):
    """Template edit that fails loudly when the V0-06 template no longer holds the expected text."""
    if old not in html:
        raise ValueError(f"card template changed, not found: {old}")
    return html.replace(old, new)


def main():
    series = json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]
    v4.__dict__["_real_wide"] = v4.wide
    v4.wide = fig_size
    v4.bag_palette = palette
    ids = sys.argv[1:] or [s["id"] for s in series if not (OUT / f"{s['id']}.png").exists()]
    unknown = set(ids) - {s["id"] for s in series}
    if unknown:
        sys.exit(f"unknown series id: {sorted(unknown)}")
    TMP.mkdir(parents=True, exist_ok=True)
    img, logos = (ROOT / "site/img").as_uri(), (ROOT / "mockups/assets/logos").as_uri()
    for s in (x for x in series if x["id"] in ids):
        html = v4.card(spec_for(s))[0].replace(f"../assets/figs/{s['id']}-", f"{img}/{s['id']}/{s['id']}-")
        html = html.replace("../assets/logos/", logos + "/")
        if not s.get("age"):  # bag image unreadable: no age is printed rather than a guess
            html = patch(html, '<div class="lab">Ages</div><div class="age">None</div><div class="rule"></div>', "")
        if s["id"] in LICENSED:
            _, _, top, halo = LICENSED[s["id"]]
            html = patch(html, "--logo-top:206px", f"--logo-top:{top}px")
            if halo:
                html = patch(html, f'alt="{s["name"]}" style="', f'alt="{s["name"]}" style="filter:{halo};')
        if s["id"] in OPAQUE_FIGURES:
            cut = TMP / s["id"]
            cut.mkdir(exist_ok=True)
            for f in s["figures"]:
                name = f"{s['id']}-{f['no']}.webp"
                cutout(ROOT / "site/img" / s["id"] / name).save(cut / name)
            html = html.replace(f"{img}/{s['id']}/{s['id']}-", f"{cut.as_uri()}/{s['id']}-")
        page = TMP / f"{s['id']}.html"
        page.write_text(html, encoding="utf-8")
        v4.render(str(page), str(OUT / f"{s['id']}.png"))
        print(s["id"], flush=True)


if __name__ == "__main__":
    main()
