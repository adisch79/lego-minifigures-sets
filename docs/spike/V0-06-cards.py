"""V0-06: approved card v4 generalised to every series.

Usage: python docs/spike/V0-06-cards.py            (writes mockups/cards/<id>.html and renders <id>.png)
       python docs/spike/V0-06-cards.py --no-render

One card per series: bag-front layout, bag-style seal with the figure count, official theme logo
(or the LEGO Minifigures lockup + SERIES N for the numbered series), crowd of BrickLink cut-outs
with the main characters in the front row. Background colours are sampled from each series' bag
image (mockups/assets/bags/<id>.webp) except 71019, which keeps the owner-approved v4 colours.
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CARDS = os.path.join(ROOT, "mockups", "cards")
ASSETS = os.path.join(ROOT, "mockups", "assets")
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"

# Per series. age: printed on the bag (mockups/assets/bags/<id>.webp, top left). SOURCE: bag images.
# count: figures in the series. SOURCE: site/data.json (Rebrickable).
# front: main characters, left to right; the middle one sits on top. Numbers = Rebrickable/BrickLink figure no.
# seal_top: arc text on the seal. "LIMITED EDITION" only where the bag seal says so (71019, 71031).
SERIES = [
    dict(id="71053", name="Shrek", age="6+", count=12, logo="shrek.png", logo_w=400,
         front=[6, 2, 4, 3, 5], seal_top="MINIFIGURES"),          # Fiona+Donkey, Puss, Shrek, Gingy, Dragon
    dict(id="71045", name="Series 25", age="5+", count=12, logo=None, series_no=25,
         front=[1, 3, 6, 8, 5], seal_top="SERIES 25"),            # Detective, Vampire Knight, Mushroom Sprite, Triceratops fan, Goatherd
    dict(id="71038", name="Disney 100", age="5+", count=18, logo="disney-100.png", logo_w=400,
         front=[16, 5, 4, 2, 17], seal_top="MINIFIGURES"),        # Stitch, Tiana, Sorcerer's Apprentice Mickey, Pinocchio, Baymax
    dict(id="71031", name="Marvel Studios", age="5+", count=12, logo="marvel-studios.png", logo_w=420,
         front=[1, 5, 10, 11, 6], seal_top="LIMITED EDITION"),    # Scarlet Witch, Captain America, Captain Carter, Star-Lord, Loki
    dict(id="71019", name="The LEGO Ninjago Movie", age="5+", count=20, logo="ninjago-movie.png", logo_w=430,
         front=[1, 6, 8, 3, 10, 2], seal_top="LIMITED EDITION",   # Kai, Jay, Cole, Lloyd, Zane, Nya (approved v4)
         rows=([15, 12, 16, 9, 13, 17, 14], [11, 18, 5, 19, 4, 20, 7])),
    dict(id="8683", name="Series 1", age="5+", count=16, logo=None, series_no=1,
         front=[1, 12, 13, 3, 7], seal_top="SERIES 1"),           # Tribal Hunter, Ninja, Spaceman, Caveman, Robot
]

# Owner-approved v4 background for 71019. SOURCE: docs/spike/V0-04-cards-gen.py v4_css (approved 2026-10-31).
V4_BG = ("#f6d7b0", "#c99a7a", "#6b4b4a", "#1d1416")


def hexc(rgb):
    return "#%02x%02x%02x" % tuple(int(max(0, min(255, v))) for v in rgb)


def bag_palette(sid):
    """Light / mid / dark / deep colours from the opaque pixels of the bag image.
    SOURCE: mockups/assets/bags/<id>.webp (percentiles of luminance)."""
    im = Image.open(os.path.join(ASSETS, "bags", sid + ".webp")).convert("RGBA")
    a = np.asarray(im).reshape(-1, 4).astype(float)
    a = a[a[:, 3] > 200][:, :3]
    # drop near-white and near-black (text, warning panel, outlines) and grey-ish pixels
    sat = a.max(1) - a.min(1)
    lum = a @ [0.299, 0.587, 0.114]
    keep = (lum > 40) & (lum < 235) & (sat > 25)
    if keep.sum() < 500:  # silver bags (Disney 100): keep grey pixels too
        keep = (lum > 40) & (lum < 245)
    a, lum = a[keep], lum[keep]
    order = np.argsort(lum)
    n = len(order)

    def band(lo, hi):
        return a[order[int(n * lo):int(n * hi)]].mean(0)

    light, mid, dark = band(0.80, 0.95), band(0.45, 0.60), band(0.08, 0.22)
    return hexc(light), hexc(mid), hexc(dark), hexc(dark * 0.3)


def wide(path):
    w, h = Image.open(path).size
    return w / h  # width per unit height


def crowd(sid, rows, cx=300, fit=(10, 590)):
    """rows: (ids, height_px, baseline_px, brightness), back row first. Middle figure of a row on top."""
    out, z = [], 1
    for ids, h, base, bright in rows:
        ar = [wide(os.path.join(ASSETS, "figs", f"{sid}-{i}.webp")) for i in ids]
        widths = [h * r for r in ar]
        step = sum(widths) / len(ids) * 0.62
        if len(ids) > 1:
            room = (fit[1] - fit[0]) - widths[0] / 2 - widths[-1] / 2
            step = min(step, room / (len(ids) - 1))
        total = step * (len(ids) - 1)
        for k, i in enumerate(ids):
            x = cx - total / 2 + k * step - widths[k] / 2
            j = [0, 6, -4, 8, -2, 5, -6, 3][k % 8]  # small jitter so rows do not read as a grid
            zz = z + len(ids) - int(abs(k - (len(ids) - 1) / 2) * 2)
            out.append(
                f'<img class="fig" src="../assets/figs/{sid}-{i}.webp" alt="" style="left:{x:.0f}px;'
                f'bottom:{base + j}px;height:{h}px;z-index:{zz};'
                f'filter:brightness({bright}) drop-shadow(0 6px 8px rgba(0,0,0,.35))">')
        z += 2 * len(ids)
    return "\n".join(out)


def split_rows(s):
    if "rows" in s:
        return s["rows"]
    rest = [i for i in range(1, s["count"] + 1) if i not in s["front"]]
    # back row gets the smaller half; interleave so neighbours in numbering do not cluster
    back, mid = rest[1::2], rest[0::2]
    return back, mid


def seal(count, top, size=150):
    """Round white seal copied from the bag: arc text top and bottom, big red italic count."""
    fs = 17 if len(top) > 10 else 20
    return f"""<svg class="seal" width="{size}" height="{size}" viewBox="0 0 160 160" aria-label="{count} to collect">
<defs><path id="sealTop" d="M 22,80 A 58,58 0 0 1 138,80"/><path id="sealBot" d="M 14,80 A 66,66 0 0 0 146,80"/></defs>
<circle cx="80" cy="80" r="77" fill="#fff"/>
<text class="arc" style="font-size:{fs}px"><textPath href="#sealTop" startOffset="50%" text-anchor="middle">{top}</textPath></text>
<text class="arc"><textPath href="#sealBot" startOffset="50%" text-anchor="middle">TO COLLECT</textPath></text>
<circle cx="15" cy="101" r="4" fill="var(--lego-red)"/><circle cx="145" cy="101" r="4" fill="var(--lego-red)"/>
<text class="num" x="{72 if count < 100 else 80}" y="107" text-anchor="middle">{count}</text>
</svg>"""


CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:600px;height:800px;overflow:hidden;background:#000}
body{font-family:"Segoe UI","Helvetica Neue",Arial,system-ui,sans-serif}
/* SOURCE: colours sampled from the LEGO logo on the 71019 bag image (originals/71019/71019-0.jpg) */
:root{--lego-red:#DF0012;--lego-yellow:#FDE01B}
.card{position:relative;width:600px;height:800px;overflow:hidden;
  background:radial-gradient(120% 60% at 70% 18%, var(--c1) 0%, var(--c2) 30%, var(--c3) 62%, var(--c4) 100%)}
.fig{position:absolute;width:auto;user-select:none}
.sky{position:absolute;inset:0;background:
  repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 2px, transparent 2px 46px),
  linear-gradient(180deg, transparent 0 40%, rgba(0,0,0,.25) 100%)}
.meta{position:absolute;left:34px;top:30px;color:var(--ink);line-height:1;z-index:5}
.meta .lab{font-size:13px;font-weight:600;letter-spacing:.04em;opacity:.85}
.meta .age{font-size:52px;font-weight:900;letter-spacing:-.02em;margin-top:2px}
.meta .rule{width:118px;height:2px;background:var(--ink);margin:6px 0 6px}
.meta .num{font-size:26px;font-weight:800;letter-spacing:.02em}
.seal{position:absolute;right:30px;top:26px;z-index:6;transform:rotate(-14deg);filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}
.seal .arc{font-family:"Arial Black","Segoe UI Black",Arial,sans-serif;font-weight:900;font-size:17px;fill:#111;letter-spacing:.5px}
.seal .num{font-family:"Arial Black","Segoe UI Black",Arial,sans-serif;font-weight:900;font-style:italic;font-size:74px;
  fill:var(--lego-red);letter-spacing:-4px}
.theme{position:absolute;left:0;right:0;top:var(--logo-top);text-align:center;z-index:5}
.theme img{height:auto;filter:drop-shadow(0 5px 8px rgba(0,0,0,.4))}
.theme .sn{display:inline-block;margin-top:8px;padding:6px 18px 7px;border-radius:8px;background:var(--lego-red);color:#fff;
  font-family:"Arial Black","Segoe UI Black",Arial,sans-serif;font-size:30px;font-style:italic;letter-spacing:.06em;
  box-shadow:0 0 0 3px #fff,0 6px 14px rgba(0,0,0,.35)}
.stage{position:absolute;left:0;right:0;top:0;bottom:96px;overflow:hidden;z-index:4}
.band{position:absolute;left:0;right:0;bottom:0;height:96px;background:linear-gradient(180deg,#151515,#050505);
  border-top:3px solid var(--lego-yellow);display:flex;align-items:center;justify-content:space-between;padding:0 30px;z-index:50}
.band .lockup{display:block;width:250px;height:auto}
.band .word{color:#fff;font-family:"Arial Black","Segoe UI Black",Arial,sans-serif;font-size:20px;letter-spacing:.12em;line-height:1.1}
.band .tag{color:#fff;font-size:13px;font-weight:700;letter-spacing:.16em;text-align:right;line-height:1.5}
.band .tag span{color:var(--lego-yellow)}
"""


def lum(hexs):
    r, g, b = (int(hexs[i:i + 2], 16) for i in (1, 3, 5))
    return 0.299 * r + 0.587 * g + 0.114 * b


def card(s):
    sid = s["id"]
    pal = V4_BG if sid == "71019" else bag_palette(sid)
    ink = "#111" if lum(pal[0]) > 150 else "#fff"
    back, mid = split_rows(s)
    n = s["count"]
    # fewer figures -> bigger figures so the stage stays full
    if n <= 12:
        # two rows: a thin third row leaves a gap on one side, so all non-front figures stand at the back
        rows = [(sorted(back + mid), 215, 150, 0.82), (s["front"], 270, -10, 1.0)]
    else:
        hb, hm, hf = (160, 200, 250) if n >= 18 else (175, 220, 265)
        rows = [(back, hb, 232, 0.70), (mid, hm, 128, 0.86), (s["front"], hf, -10, 1.0)]
    if s["logo"]:
        theme = f'<img src="../assets/logos/{s["logo"]}" alt="{s["name"]}" style="width:{s["logo_w"]}px">'
        logo_top = "206px"
        band_left = '<img class="lockup" src="../assets/logos/lego-minifigures-lockup.png" alt="LEGO Minifigures">'
    else:
        theme = ('<img src="../assets/logos/lego-minifigures-lockup.png" alt="LEGO Minifigures" style="width:380px"><br>'
                 f'<span class="sn">SERIES {s["series_no"]}</span>')
        logo_top = "170px"
        band_left = '<div class="word">COLLECTIBLE<br>MINIFIGURES</div>'
    body = f"""<div class="card" style="--c1:{pal[0]};--c2:{pal[1]};--c3:{pal[2]};--c4:{pal[3]};--ink:{ink};--logo-top:{logo_top}">
<div class="sky"></div>
<div class="meta"><div class="lab">Ages</div><div class="age">{s["age"]}</div><div class="rule"></div><div class="num">{sid}</div></div>
{seal(n, s["seal_top"])}
<div class="theme">{theme}</div>
<div class="stage">
{crowd(sid, rows)}
</div>
<div class="band">{band_left}
<div class="tag">SERIES <span>{sid}</span><br>1 MINIFIGURE PER BAG</div></div>
</div>"""
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>{sid} {s["name"]} card</title>
<style>{CSS}</style></head>
<body>{body}</body></html>
""", pal


def render(html_path, png_path):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--allow-file-access-from-files", "--window-size=600,800", "--default-background-color=00000000",
                    f"--screenshot={png_path}", "file:///" + html_path.replace("\\", "/")],
                   check=True, capture_output=True, timeout=60)


def main():
    do_render = "--no-render" not in sys.argv
    for s in SERIES:
        html, pal = card(s)
        hp = os.path.join(CARDS, s["id"] + ".html")
        with open(hp, "w", encoding="utf-8") as f:
            f.write(html)
        if do_render:
            render(hp, os.path.join(CARDS, s["id"] + ".png"))
        print(s["id"], "palette", pal)
    figs = "".join(f'<img src="{s["id"]}.png" alt="{s["name"]}">' for s in SERIES)
    with open(os.path.join(CARDS, "all.html"), "w", encoding="utf-8") as f:
        f.write('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Series cards</title><style>'
                'body{margin:0;background:#1b1b1d;display:grid;grid-template-columns:repeat(3,600px);gap:24px;padding:24px}'
                'img{width:600px;height:800px;border-radius:12px}</style></head><body>' + figs + "</body></html>")
    if do_render:
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--allow-file-access-from-files", "--window-size=1896,1672",
                        f"--screenshot={os.path.join(CARDS, 'all.png')}",
                        "file:///" + os.path.join(CARDS, "all.html").replace("\\", "/")],
                       check=True, capture_output=True, timeout=60)


if __name__ == "__main__":
    main()
