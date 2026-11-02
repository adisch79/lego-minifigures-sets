"""V1-07 card example for owner sign-off: official group image on a flat bag colour.

Usage: python docs/spike/V1-07-card.py
Output: mockups/cards-v5/<id>.png and compare.png. Uses mockups/assets/group/<id>.png.
"""
import base64, pathlib, subprocess
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "mockups/cards-v5"
LOGOS = ROOT / "mockups/assets/logos"
GROUP = ROOT / "mockups/assets/group"
# SOURCE: same Chrome path as docs/spike/V0-06-cards.py
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
# SOURCE: colours sampled from the LEGO logo on the 71019 bag image, as in docs/spike/V0-06-cards.py
RED, YELLOW = "#DF0012", "#FDE01B"

# box: plain background area of the bag image (left, top, right, bottom) in bag pixels.
# ring: series-number frame colour. SOURCE: read from the bag image of each series.
SERIES = [
    dict(id="71053", age="6+", count=12, logo="shrek.png", logo_w=430, series=None, box=(0, 250, 25, 450)),
    dict(id="71051", age="5+", count=12, logo=None, series=28, ring="#1F6FB2", box=(270, 58, 345, 72)),
]


def flat_colour(sid, box):
    """Most common colour of a plain bag area, so highlights and pattern do not dull it."""
    a = np.asarray(Image.open(ROOT / f"site/img/{sid}/{sid}-0.webp").convert("RGB").crop(box)).reshape(-1, 3)
    bins, counts = np.unique(a // 16, axis=0, return_counts=True)
    top = a[(a // 16 == bins[counts.argmax()]).all(axis=1)]
    return "#%02x%02x%02x" % tuple(int(v) for v in top.mean(axis=0))


def uri(path):
    return f"data:image/png;base64,{base64.b64encode(path.read_bytes()).decode()}"


def badge(s):
    """Bag badge: count in a yellow minifigure head, series number in a round frame behind it."""
    frame = ""
    if s["series"]:
        frame = f"""<circle cx="38" cy="44" r="35" fill="{s['ring']}" stroke="#fff" stroke-width="6"/>
<text x="36" y="57" text-anchor="middle" class="sn">{s['series']}</text>"""
    return f"""<svg class="badge" width="230" height="190" viewBox="0 0 230 190">{frame}
<path d="M72 34 Q72 18 88 18 H100 V8 H172 V18 H186 Q202 18 202 34 V122 Q202 138 186 138 H178 V154 H96 V138 H88 Q72 138 72 122 Z"
 fill="{YELLOW}" stroke="#111" stroke-width="5" stroke-linejoin="round"/>
<rect x="82" y="58" width="24" height="24" rx="12" fill="#fff" stroke="{RED}" stroke-width="4"/>
<path d="M87 69 l6 7 l14 -19" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/>
<text x="150" y="94" text-anchor="middle" class="cnt">{s['count']}</text>
<text x="137" y="124" text-anchor="middle" class="tc">TO COLLECT</text></svg>"""


def page(s):
    bg = flat_colour(s["id"], s["box"])
    lum = sum(int(bg[i:i + 2], 16) * w for i, w in zip((1, 3, 5), (.299, .587, .114)))
    ink = "#111" if lum > 150 else "#fff"
    lockup = uri(LOGOS / "lego-minifigures-lockup.png")
    if s["logo"]:
        theme = f'<img src="{uri(LOGOS / s["logo"])}" style="width:{s["logo_w"]}px">'
        band = f'<img class="lockup" src="{lockup}">'
    else:
        theme = f'<img src="{lockup}" style="width:400px">'
        band = '<div class="word">COLLECTIBLE MINIFIGURES</div>'
    return f"""<!DOCTYPE html><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}} html,body{{width:600px;height:800px;overflow:hidden}}
body{{font-family:"Segoe UI",Arial,sans-serif}}
.card{{position:relative;width:600px;height:800px;background:{bg};color:{ink}}}
.meta{{position:absolute;left:34px;top:30px;line-height:1;font-weight:800}}
.age{{font-size:50px}} .rule{{width:90px;height:3px;background:currentColor;margin:8px 0}} .num{{font-size:26px}}
.badge{{position:absolute;right:12px;top:14px}}
.badge text{{font-family:"Arial Black",Arial,sans-serif;font-weight:900}}
.sn{{font-size:34px;fill:#fff}} .cnt{{font-size:62px;font-style:italic;fill:{RED};letter-spacing:-4px}} .tc{{font-size:16px;font-style:italic;fill:{RED}}}
.theme{{position:absolute;left:0;right:0;top:190px;text-align:center}}
.group{{position:absolute;left:18px;right:18px;bottom:100px;height:375px;object-fit:contain;object-position:bottom;width:564px}}
.band{{position:absolute;left:0;right:0;bottom:0;height:88px;background:#0b0b0b;display:flex;align-items:center;padding:0 30px}}
.lockup{{width:250px}} .word{{color:#fff;font-family:"Arial Black",Arial,sans-serif;font-size:20px;letter-spacing:.1em}}
</style><div class="card">
<div class="meta"><div class="age">{s['age']}</div><div class="rule"></div><div class="num">{s['id']}</div></div>
{badge(s)}
<div class="theme">{theme}</div>
<img class="group" src="{uri(GROUP / (s['id'] + '.png'))}">
<div class="band">{band}</div></div>"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for s in SERIES:
        html = OUT / f"{s['id']}.html"
        html.write_text(page(s), encoding="utf-8")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--window-size=600,800", f"--screenshot={OUT / (s['id'] + '.png')}", html.as_uri()],
                       check=True, capture_output=True, timeout=60)
        html.unlink()
        print(s["id"], flat_colour(s["id"], s["box"]))
    sheet = Image.new("RGB", (1210, 800), (255, 255, 255))
    for i, s in enumerate(SERIES):
        sheet.paste(Image.open(OUT / f"{s['id']}.png").convert("RGB"), (i * 610, 0))
    sheet.save(OUT / "compare.png")


if __name__ == "__main__":
    main()
