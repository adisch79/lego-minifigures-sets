"""V2-11 mockups: three card layouts with a bigger figure group and a badge about the logo height.

Usage: python mockups/V2-11/build_mockups.py
Output: mockups/V2-11/{a,b,c}-<id>.png for 71053 and 71052, plus mockups/V2-11/sheet.png.
Reuses the live card machinery in scripts/build_cards.py; live output in app/public/cards is not touched.
"""
import json, pathlib, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import build_cards as bc  # noqa: E402

OUT = ROOT / "mockups/V2-11"
TMP = OUT / "tmp"
IDS = ["71053", "71052"]
# Badge svg in build_cards is 240x218 px; drawn content fills about 95 % of its height (measured on 71052.png).
BADGE_W, BADGE_H = 240, 218


def badge(s, height):
    """Live badge, scaled so its drawn height matches the logo height."""
    svg = bc.badge(bc.series_number(s), s["figureCount"])
    h = round(height / 0.95)
    return svg.replace(f'width="{BADGE_W}" height="{BADGE_H}"', f'width="{round(h * BADGE_W / BADGE_H)}" height="{h}"')


def parts(s, logo_h, logo_w):
    """Background, ink, theme logo tag and band content, as in build_cards.page."""
    sid = s["id"]
    bg = bc.BG.get(sid) or bc.flat_colour(sid)
    lum = sum(int(bg[i:i + 2], 16) * w for i, w in zip((1, 3, 5), (.299, .587, .114)))
    ink = "#111" if lum > 150 else "#fff"
    lockup = bc.uri(bc.LOGOS / "lego-minifigures-lockup.png")
    if sid in bc.LOGO:
        halo = bc.DARK_HALO if sid in bc.HALO else ""
        theme = f'<img src="{bc.uri(bc.LOGOS / bc.LOGO[sid])}" style="{halo}max-height:{logo_h}px;max-width:{logo_w}px">'
        band = f'<img class="lockup" src="{lockup}">'
    else:
        theme = f'<img src="{lockup}" style="max-height:{logo_h}px;max-width:{logo_w}px">'
        band = '<div class="word">COLLECTIBLE MINIFIGURES</div>'
    return bg, ink, theme, band


BASE = """*{margin:0;box-sizing:border-box} html,body{width:600px;height:800px;overflow:hidden}
body{font-family:"Segoe UI",Arial,sans-serif}
.card{position:relative;width:600px;height:800px;overflow:hidden}
.badge text{font-family:'Arial Black',Arial,sans-serif;font-weight:900}
.lockup{width:300px} .word{color:#fff;font-family:"Arial Black",Arial,sans-serif;font-size:20px;letter-spacing:.1em}
.age{font-size:40px} .rule{width:72px;height:3px;background:currentColor;margin:6px 0} .num{font-size:22px}
"""


def meta(s):
    age = f'<div class="age">{s["age"]}</div><div class="rule"></div>' if s.get("age") else ""
    return f'{age}<div class="num">{s["id"]}</div>'


def group(s):
    return f'<img class="group" src="{bc.uri(bc.GROUP / (s["id"] + ".png"))}">'


def page_a(s):
    """A, box stack: badge top right, logo right under it (top 126), group full width from y 234."""
    bg, ink, theme, band = parts(s, 104, 470)
    return f"""<!DOCTYPE html><meta charset="utf-8"><style>{BASE}
.card{{background:{bg};color:{ink}}}
.meta{{position:absolute;left:30px;top:24px;line-height:1;font-weight:800}}
.badge{{position:absolute;right:14px;top:10px}}
.theme{{position:absolute;left:0;right:0;top:126px;text-align:center}}
.group{{position:absolute;left:0;top:234px;width:600px;height:476px;object-fit:contain;object-position:center bottom}}
.band{{position:absolute;left:0;right:0;bottom:0;height:80px;background:#0b0b0b;display:flex;align-items:center;padding:0 30px}}
</style><div class="card"><div class="meta">{meta(s)}</div>{badge(s, 104)}
<div class="theme">{theme}</div>{group(s)}
<div class="band">{band}</div></div>"""


def page_b(s):
    """B, logo crown: logo full width at the top, badge in the bottom right corner on the band edge."""
    bg, ink, theme, band = parts(s, 124, 540)
    return f"""<!DOCTYPE html><meta charset="utf-8"><style>{BASE}
.card{{background:{bg};color:{ink}}}
.theme{{position:absolute;left:0;right:0;top:26px;text-align:center}}
.group{{position:absolute;left:0;top:168px;width:600px;height:488px;object-fit:contain;object-position:center top}}
.band{{position:absolute;left:0;right:0;bottom:0;height:80px;background:#0b0b0b;display:flex;align-items:center;padding:0 30px}}
.meta{{position:absolute;left:30px;bottom:96px;line-height:1;font-weight:800}}
.badge{{position:absolute;right:10px;bottom:14px}}
</style><div class="card"><div class="theme">{theme}</div>
{group(s)}
<div class="band">{band}</div><div class="meta">{meta(s)}</div>{badge(s, 124)}</div>"""


def page_c(s):
    """C, full bleed: logo and badge share the top row, group bleeds past the sides and bottom."""
    bg, ink, theme, band = parts(s, 100, 390)
    return f"""<!DOCTYPE html><meta charset="utf-8"><style>{BASE}
.card{{background:{bg};color:{ink}}}
.theme{{position:absolute;left:26px;top:30px;width:400px;height:100px;display:flex;align-items:center}}
.badge{{position:absolute;right:10px;top:24px}}
.group{{position:absolute;left:-70px;bottom:-24px;width:740px;height:660px;object-fit:contain;object-position:center bottom}}
.band{{position:absolute;left:0;right:0;bottom:0;height:96px;display:flex;align-items:flex-end;padding:0 26px 18px;
background:linear-gradient(transparent,rgba(0,0,0,.85))}}
.meta{{position:absolute;right:26px;bottom:18px;line-height:1;font-weight:800;color:#fff;text-align:right}}
.meta .rule{{margin-left:auto}}
</style><div class="card">{group(s)}
<div class="theme">{theme}</div>{badge(s, 100)}
<div class="band">{band}</div><div class="meta">{meta(s)}</div></div>"""


def render(name, html_text):
    html = TMP / f"{name}.html"
    html.write_text(html_text, encoding="utf-8")
    subprocess.run([bc.CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--user-data-dir={TMP / 'chrome'}", "--window-size=600,800",
                    f"--screenshot={OUT / (name + '.png')}", html.as_uri()], check=True, capture_output=True, timeout=90)
    html.unlink()


def sheet():
    """Rows per series: original box, current card, A, B, C, at 300x400 each with captions."""
    w, h, cap = 300, 400, 28
    cols = ["original", "current", "A", "B", "C"]
    img = Image.new("RGB", (len(cols) * (w + 8) + 8, len(IDS) * (h + cap + 8) + 8), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("arialbd.ttf", 18)
    for r, sid in enumerate(IDS):
        srcs = [ROOT / f"originals/{sid}/{sid}-0.jpg", ROOT / f"app/public/cards/{sid}.png"] + \
               [OUT / f"{v}-{sid}.png" for v in "abc"]
        for c, (label, src) in enumerate(zip(cols, srcs)):
            tile = Image.open(src).convert("RGB")
            tile.thumbnail((w, h))
            x, y = 8 + c * (w + 8), 8 + r * (h + cap + 8)
            img.paste(tile, (x + (w - tile.width) // 2, y + cap + (h - tile.height) // 2))
            draw.text((x, y + 4), f"{sid} {label}", fill=(0, 0, 0), font=font)
    img.save(OUT / "sheet.png")


def main():
    series = {s["id"]: s for s in json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]}
    TMP.mkdir(parents=True, exist_ok=True)
    for sid in IDS:
        for v, fn in (("a", page_a), ("b", page_b), ("c", page_c)):
            render(f"{v}-{sid}", fn(series[sid]))
            print(f"{v}-{sid}", flush=True)
    sheet()


if __name__ == "__main__":
    main()
