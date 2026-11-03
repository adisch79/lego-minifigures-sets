"""Render the series cards: official group image on the flat bag colour (V1-07, owner rules 2026-11-02).

Usage: python scripts/build_cards.py [<seriesId> ...]   (default: every series)
Output: app/public/cards/<id>.png and docs/spike/V1-07-cards-all.png (overview).
Inputs: mockups/assets/group/<id>.png, mockups/assets/logos, site/img/<id>/<id>-0.webp (bag colour).
"""
import base64, concurrent.futures, json, math, pathlib, re, subprocess, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "app/public/cards"
TMP = ROOT / "docs/spike/V1-07-tmp"
OVERVIEW = ROOT / "docs/spike/V1-07-cards-all.png"
LOGOS = ROOT / "mockups/assets/logos"
GROUP = ROOT / "mockups/assets/group"
# SOURCE: same Chrome path as docs/spike/V0-06-cards.py
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
# SOURCE: OWNER-SUPPLIED badge screenshot, 2026-11-02 (sampled pixels).
RED = "#D80008"
# SOURCE: OWNER-SUPPLIED badge screenshot, 2026-11-02 (sampled pixels).
HEAD, HEAD_DARK, FRAME, NAVY = "#F8C800", "#F0B800", "#38B8E8", "#002050"
# Colour where sampling the bag image fails. 71051 SOURCE: OWNER-SUPPLIED badge screenshot, 2026-11-02.
# 71019 SOURCE: owner-approved v4 background, docs/spike/V0-06-cards.py V4_BG.
# 8909 SOURCE: bag photo https://img.bricklink.com/ItemImage/SN/0/8909-1.png (white bag); site/img has only a banner.
BG = {"71051": "#70b0d8", "71019": "#f6d7b0", "8909": "#f0f0f0"}
# Bags whose main colour is black, grey or white: the saturated sampler would pick a logo or a face instead.
NEUTRAL_BAG = {"71049", "71047", "71038", "71033", "71030", "71027", "71026", "71014", "71010", "71000", "8833", "8827"}
# Theme logo per licensed series: file in mockups/assets/logos. SOURCE: mockups/assets/logos/SOURCES.md.
LOGO = {
    "71053": "shrek-dreamworks.png", "71050": "spider-verse.png", "71049": "formula-1.png",
    "71047": "dungeons-dragons.png", "71039": "marvel-studios.png", "71038": "disney-100.png",
    "71033": "muppets.png", "71031": "marvel-studios.png", "71030": "looney-tunes.png",
    "71028": "harry-potter.png", "71026": "dc.png", "71024": "disney.png", "71023": "lego-movie-2.png",
    "71022": "harry-potter.png", "71020": "lego-batman-movie.png", "71019": "ninjago-movie.png",
    "71017": "lego-batman-movie.png", "71014": "dfb.png", "71012": "disney.png", "71009": "simpsons.png",
    "71005": "simpsons.png", "71004": "lego-movie.png", "8909": "team-gb.png",
}
# Dark bags photographed on white: the white surround must not win the count.
DARK_BAG = {"71010", "71000"}
# Tall logos sit higher and larger than wide ones: id -> (width, top). Layout by eye against the overview sheet.
TALL_LOGO = {"71030": (210, 100), "71026": (200, 110), "71014": (160, 110), "8909": (170, 110), "71023": (215, 100)}
DARK_HALO = "filter:drop-shadow(0 0 3px #000) drop-shadow(0 0 8px rgba(0,0,0,.8));"
# Logos with white parts that vanish on their bag colour.
HALO = {"71033", "71038", "8909"}


def flat_colour(sid):
    """Most common saturated colour of the bag, so highlights and figures do not dull it."""
    a = np.asarray(Image.open(ROOT / f"site/img/{sid}/{sid}-0.webp").convert("RGB")).reshape(-1, 3).astype(int)
    sat, lum = a.max(1) - a.min(1), a.sum(1) / 3
    keep = a[(sat > 40) & (lum > 40) & (lum < 240)]
    if sid in NEUTRAL_BAG or len(keep) < 500:
        keep = a
    if sid in DARK_BAG:
        keep = a[lum < 200]
    bins, counts = np.unique(keep // 16, axis=0, return_counts=True)
    top = keep[(keep // 16 == bins[counts.argmax()]).all(axis=1)]
    return "#%02x%02x%02x" % tuple(int(v) for v in top.mean(axis=0))


def uri(path):
    return f"data:image/png;base64,{base64.b64encode(path.read_bytes()).decode()}"


def label(x, y, size, value, squeeze, fill, stroke=0, skew=0, spacing=0):
    """Arial Black, squeezed: closest installed match to the bag lettering (docs/spike/V1-07-badge-fonts.png)."""
    style = f"font-size:{size}px;fill:{fill};stroke:{fill};stroke-width:{stroke}px;paint-order:stroke;letter-spacing:{spacing}px"
    move = f"translate({x} {y}) skewX({skew}) scale({squeeze} 1)"
    return f'<text transform="{move}" text-anchor="middle" style="{style}">{value}</text>'


def badge(number, count):
    """Bag badge per the owner's example: SERIES and number in a round frame, count in a tilted head."""
    frame = ""
    if number:
        frame = f"""<circle cx="58" cy="60" r="53" fill="{FRAME}" stroke="#fff" stroke-width="6"/>
{label(58, 49, 23, "SERIES", 0.66, NAVY, 0.5)}
{label(58, 95, 52, number, 0.72, NAVY, 2)}"""
    # Geometry measured from the owner's screenshot, 2026-11-02.
    return f"""<svg class="badge" width="240" height="218" viewBox="0 0 270 245">{frame}
<g transform="rotate(12 172 130)">
<rect x="132" y="26" width="80" height="38" rx="4" fill="{HEAD_DARK}"/>
<rect x="116" y="196" width="112" height="32" rx="4" fill="{HEAD_DARK}"/>
<rect x="92" y="55" width="160" height="150" rx="34" fill="{HEAD}"/>
<rect x="99" y="112" width="24" height="24" rx="7" fill="#fff" stroke="{RED}" stroke-width="4"/>
<path d="M104 124 l6 7 l20 -19" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
{label(183, 158, 112, count, 0.66, RED, 5, -8, -7)}
{label(172, 190, 27, "TO COLLECT", 0.62, RED, 1, -6)}
</g></svg>"""


def series_number(s):
    """Number on the frame: catalog seriesNo, or Series N at the end of a licensed name."""
    if s.get("seriesNo"):
        return s["seriesNo"]
    m = re.search(r"Series (\d+)$", s["name"])
    return int(m.group(1)) if m else None


def page(s):
    sid = s["id"]
    bg = BG.get(sid) or flat_colour(sid)
    lum = sum(int(bg[i:i + 2], 16) * w for i, w in zip((1, 3, 5), (.299, .587, .114)))
    ink = "#111" if lum > 150 else "#fff"
    lockup = uri(LOGOS / "lego-minifigures-lockup.png")
    if sid in LOGO:
        width, top = TALL_LOGO.get(sid, (None, None))
        size = f"width:{width}px" if width else "max-width:430px;max-height:120px"
        halo = DARK_HALO if sid in HALO else ""
        theme = f'<img src="{uri(LOGOS / LOGO[sid])}" style="{halo}{size}">'
        theme_top = top or 232
        band = f'<img class="lockup" src="{lockup}">'
    else:
        theme = f'<img src="{lockup}" style="width:490px">'
        theme_top = 232
        band = '<div class="word">COLLECTIBLE MINIFIGURES</div>'
    age = f'<div class="age">{s["age"]}</div><div class="rule"></div>' if s.get("age") else ""
    return f"""<!DOCTYPE html><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}} html,body{{width:600px;height:800px;overflow:hidden}}
body{{font-family:"Segoe UI",Arial,sans-serif}}
.card{{position:relative;width:600px;height:800px;background:{bg};color:{ink}}}
.meta{{position:absolute;left:34px;top:30px;line-height:1;font-weight:800}}
.age{{font-size:50px}} .rule{{width:90px;height:3px;background:currentColor;margin:8px 0}} .num{{font-size:26px}}
.badge{{position:absolute;right:12px;top:14px}}
.badge text{{font-family:'Arial Black',Arial,sans-serif;font-weight:900}}
.theme{{position:absolute;left:0;right:0;top:{theme_top}px;text-align:center}}
.group{{position:absolute;left:18px;bottom:96px;height:335px;width:564px;object-fit:contain;object-position:center}}
.band{{position:absolute;left:0;right:0;bottom:0;height:88px;background:#0b0b0b;display:flex;align-items:center;padding:0 30px}}
.lockup{{width:340px}} .word{{color:#fff;font-family:"Arial Black",Arial,sans-serif;font-size:20px;letter-spacing:.1em}}
</style><div class="card">
<div class="meta">{age}<div class="num">{sid}</div></div>
{badge(series_number(s), s["figureCount"])}
<div class="theme">{theme}</div>
<img class="group" src="{uri(GROUP / (sid + '.png'))}">
<div class="band">{band}</div></div>"""


def render(s):
    html = TMP / f"{s['id']}.html"
    html.write_text(page(s), encoding="utf-8")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--user-data-dir={TMP / ('chrome-' + s['id'])}", "--window-size=600,800",
                    f"--screenshot={OUT / (s['id'] + '.png')}", html.as_uri()], check=True, capture_output=True, timeout=90)
    html.unlink()
    return s["id"]


def overview(series):
    cols, w, h = 9, 200, 267
    sheet = Image.new("RGB", (cols * w, math.ceil(len(series) / cols) * h), (255, 255, 255))
    for i, s in enumerate(series):
        card = Image.open(OUT / f"{s['id']}.png").convert("RGB").resize((w - 4, h - 4))
        sheet.paste(card, ((i % cols) * w + 2, (i // cols) * h + 2))
    sheet.save(OVERVIEW)


def main():
    series = json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]
    ids = sys.argv[1:] or [s["id"] for s in series]
    unknown = set(ids) - {s["id"] for s in series}
    if unknown:
        sys.exit(f"unknown series id: {sorted(unknown)}")
    TMP.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for sid in pool.map(render, [s for s in series if s["id"] in ids]):
            print(sid, flush=True)
    overview(series)


if __name__ == "__main__":
    main()
