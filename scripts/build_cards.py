"""Render the series cards: official group image on the flat bag colour (V1-07, owner rules 2026-11-02).

Usage: python scripts/build_cards.py [<seriesId> ...]   (default: every series)
Output: app/public/cards/<id>.png and docs/spike/V1-07-cards-all.png (overview).
Inputs: mockups/assets/group/<id>.png, mockups/assets/logos, site/img/<id>/<id>-0.webp (bag colour).
"""
import base64, concurrent.futures, json, math, pathlib, re, subprocess, sys
import numpy as np
from PIL import Image, ImageFont

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
# V2-11 layout F (owner OK 2026-11-09, mockups/V2-11/build_mockups.py page_f): layout A with the logo box
# enlarged to 580x150, layered over the crowd. SOURCE: OWNER-SUPPLIED (sheet_f.png sign-off).
LOGO_W, LOGO_H, LOGO_TOP = 580, 150, 126
# Logos narrower than 2:1 (DC, Looney Tunes, DFB, Team GB, LEGO Movie 2) would shrink below their v4 size in a
# 150 px box: they get 190 px, as in mockup E (TALL ratio and height from build_mockups.py E_TALL_*).
TALL_RATIO, TALL_H = 2.0, 190
# Badge drawn height matches A's 104 px logo row; drawn content fills about 95 % of the svg (measured on 71052.png).
BADGE_H = round(104 / 0.95)
GROUP_TOP, GROUP_H = 234, 476
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


# Count mark geometry in badge units. SOURCE: OWNER-SUPPLIED assembly mockups/V2-11/elements/mine.png (2026-11-09).
COUNT_SIZE, COUNT_X, COUNT_BASE = 128, 170, 168
CHECK_X, CHECK_Y = 107, 145
COLLECT_X, COLLECT_BASE = 171.5, 194.5
BADGE_TILT = 13


def count_fit(count):
    """Squeeze and centre x for the count. The owner laid out 12, whose "1" foot sits right of the checkbox. A count
    that starts with another digit (9, 20, 22) has its foot at the bottom left, under the checkbox: keep the right
    edge where 12 ends, narrow the count until its left edge clears the checkbox (CHECK_X + 24 + 4 px gap) and centre
    it in that space."""
    if str(count)[0] == "1":
        return 0.66, COUNT_X
    font = ImageFont.truetype("ariblk.ttf", COUNT_SIZE)
    l, _, r, _ = font.getbbox("12")
    right = COUNT_X + 0.66 * (r - l) / 2                      # right edge of 12, badge units
    left = CHECK_X + 24 + 4
    l2, _, r2, _ = font.getbbox(str(count))
    squeeze = min(0.66, (right - left) / (r2 - l2))
    return round(squeeze, 3), round((left + right) / 2, 1)   # centred in the space right of the checkbox


def count_mark(count):
    """Checkbox, count and TO COLLECT inside the head (head box x 92-252, y 55-205).
    Layout copied from the owner's own assembly, mockups/V2-11/elements/mine.png (2026-11-09): big count filling the
    face, checkbox at the bottom left touching the count's foot, TO COLLECT under both. Positions below are badge
    units measured on that image (un-tilted, 4x) and calibrated by re-rendering."""
    size = COUNT_SIZE if len(str(count)) < 3 else round(COUNT_SIZE * 0.7)
    squeeze, cx = count_fit(count)
    return f"""<rect x="{CHECK_X}" y="{CHECK_Y}" width="24" height="24" rx="6" fill="#fff" stroke="{RED}" stroke-width="4"/>
<path d="M{CHECK_X + 5} {CHECK_Y + 12} l6 7 l18 -18" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
{label(cx, COUNT_BASE, size, count, squeeze, RED, 4, -8, -5)}
{label(COLLECT_X, COLLECT_BASE, 25, "TO COLLECT", 0.6, RED, 1, -6)}"""


def badge(number, count):
    """Bag badge per the owner's example: SERIES and number in a round frame, count in a tilted head."""
    frame = ""
    if number:
        frame = f"""<circle cx="58" cy="60" r="53" fill="{FRAME}" stroke="#fff" stroke-width="6"/>
{label(58, 49, 23, "SERIES", 0.66, NAVY, 0.5)}
{label(58, 95, 52, number, 0.72, NAVY, 2)}"""
    # Geometry measured from the owner's screenshot, 2026-11-02.
    return f"""<svg class="badge" width="240" height="218" viewBox="0 0 270 245">{frame}
<g transform="rotate({BADGE_TILT} 172 130)">
<rect x="132" y="26" width="80" height="38" rx="4" fill="{HEAD_DARK}"/>
<rect x="116" y="196" width="112" height="32" rx="4" fill="{HEAD_DARK}"/>
<rect x="92" y="55" width="160" height="150" rx="34" fill="{HEAD}"/>
{count_mark(count)}
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
    logo = LOGOS / (LOGO[sid] if sid in LOGO else "lego-minifigures-lockup.png")
    lw, lh = Image.open(logo).size
    size = f"max-height:{TALL_H if lw / lh < TALL_RATIO else LOGO_H}px;max-width:{LOGO_W}px"
    if sid in LOGO:
        halo = DARK_HALO if sid in HALO else ""
        theme = f'<img src="{uri(LOGOS / LOGO[sid])}" style="{halo}{size}">'
        band = f'<img class="lockup" src="{lockup}">'
    else:
        theme = f'<img src="{lockup}" style="{size}">'
        band = '<div class="word">COLLECTIBLE MINIFIGURES</div>'
    age = f'<div class="age">{s["age"]}</div><div class="rule"></div>' if s.get("age") else ""
    svg = badge(series_number(s), s["figureCount"])
    svg = svg.replace('width="240" height="218"', f'width="{round(BADGE_H * 240 / 218)}" height="{BADGE_H}"')
    return f"""<!DOCTYPE html><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}} html,body{{width:600px;height:800px;overflow:hidden}}
body{{font-family:"Segoe UI",Arial,sans-serif}}
.card{{position:relative;width:600px;height:800px;overflow:hidden;background:{bg};color:{ink}}}
.meta{{position:absolute;left:30px;top:24px;line-height:1;font-weight:800}}
.age{{font-size:40px}} .rule{{width:72px;height:3px;background:currentColor;margin:6px 0}} .num{{font-size:22px}}
.badge{{position:absolute;right:14px;top:10px}}
.badge text{{font-family:'Arial Black',Arial,sans-serif;font-weight:900}}
.theme{{position:absolute;left:0;right:0;top:{LOGO_TOP}px;text-align:center;line-height:0;z-index:2}}
.group{{position:absolute;left:0;top:{GROUP_TOP}px;width:600px;height:{GROUP_H}px;object-fit:contain;object-position:center bottom}}
.band{{position:absolute;left:0;right:0;bottom:0;height:80px;background:#0b0b0b;display:flex;align-items:center;padding:0 30px}}
.lockup{{width:300px}} .word{{color:#fff;font-family:"Arial Black",Arial,sans-serif;font-size:20px;letter-spacing:.1em}}
</style><div class="card">
<div class="meta">{age}<div class="num">{sid}</div></div>
{svg}
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
