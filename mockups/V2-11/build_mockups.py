"""V2-11 mockups: three card layouts with a bigger figure group and a badge about the logo height.

Usage: python mockups/V2-11/build_mockups.py      (all variants)
       python mockups/V2-11/build_mockups.py e    (variant E and sheet_e only)
       python mockups/V2-11/build_mockups.py f    (A and F for IDS_F, sheet_f)
Output: mockups/V2-11/{a,b,c}-<id>.png for 71053 and 71052, plus mockups/V2-11/sheet.png.
        mockups/V2-11/d-<id>.png for 71053, 71052, 71023, 8683, plus mockups/V2-11/sheet_d.png.
        mockups/V2-11/e-<id>.png for 71053, 71052, 71023, 71045, plus mockups/V2-11/sheet_e.png.
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
# D also renders one older grid-style series and one white cut-out series to prove it generalises.
IDS_D = IDS + ["71023", "8683"]
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


def page_a(s, logo_h=104, logo_w=470):
    """A, box stack: badge top right, logo right under it (top 126), group full width from y 234."""
    bg, ink, theme, band = parts(s, logo_h, logo_w)
    return f"""<!DOCTYPE html><meta charset="utf-8"><style>{BASE}
.card{{background:{bg};color:{ink}}}
.meta{{position:absolute;left:30px;top:24px;line-height:1;font-weight:800}}
.badge{{position:absolute;right:14px;top:10px}}
.theme{{position:absolute;left:0;right:0;top:126px;text-align:center;line-height:0;z-index:2}}
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


# D geometry (card 600x800, band 80 px): group sits on the band and reaches up under the logo.
D_LOGO_TOP, D_LOGO_H, D_LOGO_W = 116, 140, 540
D_GROUP_BOTTOM = 720           # top edge of the black band
D_GROUP_TOP = 190              # group top: logo overlaps the crowd by roughly half its height
D_MAX_W = 760                  # widest group allowed: crops at most 80 px per side, as on the retail box


def d_group_box(s):
    """Group height and width for D: fill D_GROUP_TOP..band, unless that crops more than D_MAX_W allows."""
    w, h = Image.open(bc.GROUP / (s["id"] + ".png")).size
    gh = D_GROUP_BOTTOM - D_GROUP_TOP
    gw = gh * w / h
    if gw > D_MAX_W:
        gw, gh = D_MAX_W, D_MAX_W * h / w
    return round(gw), round(gh)


def page_d(s):
    """D, retail box: A's meta, badge and band; big logo on top overlapping a crowd cropped at the sides."""
    bg, ink, theme, band = parts(s, D_LOGO_H, D_LOGO_W)
    gw, gh = d_group_box(s)
    return f"""<!DOCTYPE html><meta charset="utf-8"><style>{BASE}
.card{{background:{bg};color:{ink}}}
.meta{{position:absolute;left:30px;top:24px;line-height:1;font-weight:800;z-index:3}}
.badge{{position:absolute;right:14px;top:10px;z-index:3}}
.group{{position:absolute;left:{(600 - gw) // 2}px;top:{D_GROUP_BOTTOM - gh}px;width:{gw}px;height:{gh}px;z-index:1}}
.theme{{position:absolute;left:0;right:0;top:{D_LOGO_TOP}px;text-align:center;z-index:2}}
.theme img{{filter:drop-shadow(0 4px 6px rgba(0,0,0,.45))}}
.band{{position:absolute;left:0;right:0;bottom:0;height:80px;background:#0b0b0b;display:flex;align-items:center;padding:0 30px;z-index:3}}
</style><div class="card"><div class="meta">{meta(s)}</div>{badge(s, 104)}
{group(s)}<div class="theme">{theme}</div>
<div class="band">{band}</div></div>"""


# E geometry: A's meta, badge, band and group (box 600x476 at top 234, bottom at y 710); B's logo size,
# centred and layered OVER the crowd (z-order), overlapping the top of the figures by E_OVERLAP of its height,
# as on the retail box (logo over the figures' heads). The logo must sit below the age block and badge.
# If A's group leaves an empty band under the top row, the group grows upward (bottom fixed at 710) until the
# logo touches the top-row clearance line; side crop capped at 80 px per side.
IDS_E = IDS + ["71023", "71045"]
A_GROUP_TOP, A_GROUP_W, A_GROUP_H = 234, 600, 476
GROUP_BOTTOM = A_GROUP_TOP + A_GROUP_H   # 710, as A
E_LOGO_W, E_LOGO_H = 540, 124            # B's logo box
E_TALL_RATIO, E_TALL_H = 2.0, 190        # logos narrower than 2:1 (71023 LEGO Movie 2) may grow to 190 px
BADGE_BOTTOM = 10 + round(104 / 0.95)    # 119: badge box bottom (top 10, as A)
META_BOTTOM = 24 + 40 + 6 + 3 + 6 + 22   # 101: age line + rule + set number, as A
E_CLEAR = 10                             # clearance from age block and badge
E_LOGO_MIN_TOP = max(BADGE_BOTTOM, META_BOTTOM) + E_CLEAR   # 129
E_OVERLAP = 0.35                         # share of logo height drawn over the crowd
E_MAX_GW = 760                           # widest group: 80 px crop per side


def e_layout(s):
    """Logo size and top, group box for E, from the real image sizes."""
    sid = s["id"]
    logo = bc.LOGOS / (bc.LOGO[sid] if sid in bc.LOGO else "lego-minifigures-lockup.png")
    lw0, lh0 = Image.open(logo).size
    gw0, gh0 = Image.open(bc.GROUP / (sid + ".png")).size
    box_h = E_TALL_H if lw0 / lh0 < E_TALL_RATIO else E_LOGO_H
    k = min(box_h / lh0, E_LOGO_W / lw0)
    lw, lh = round(lw0 * k), round(lh0 * k)
    gh = min(A_GROUP_H, A_GROUP_W * gh0 / gw0)            # A's visible group height
    lift = lh * (1 - E_OVERLAP)                            # logo top sits this far above the group top
    if GROUP_BOTTOM - gh - lift > E_LOGO_MIN_TOP:          # empty band under the top row: grow the group upward
        gh = GROUP_BOTTOM - E_LOGO_MIN_TOP - lift
    gw = gh * gw0 / gh0
    if gw > E_MAX_GW:                                       # crop cap reached: keep the bottom, accept a gap
        gw, gh = E_MAX_GW, E_MAX_GW * gh0 / gw0
    group_top = round(GROUP_BOTTOM - gh)
    logo_top = max(E_LOGO_MIN_TOP, round(group_top - lift))
    return dict(box_h=box_h, lw=lw, lh=lh, logo_top=logo_top, gw=round(gw), gh=round(gh),
                group_top=group_top, overlap=logo_top + lh - group_top)


def page_e(s):
    """E: A's meta, badge, band and group; B-size logo centred and layered over the top of the crowd."""
    L = e_layout(s)
    bg, ink, theme, band = parts(s, L["box_h"], E_LOGO_W)
    return f"""<!DOCTYPE html><meta charset="utf-8"><style>{BASE}
.card{{background:{bg};color:{ink}}}
.meta{{position:absolute;left:30px;top:24px;line-height:1;font-weight:800;z-index:3}}
.badge{{position:absolute;right:14px;top:10px;z-index:3}}
.group{{position:absolute;left:{(600 - L["gw"]) // 2}px;top:{L["group_top"]}px;width:{L["gw"]}px;height:{L["gh"]}px;z-index:1}}
.theme{{position:absolute;left:0;right:0;top:{L["logo_top"]}px;text-align:center;line-height:0;z-index:2}}
.theme img{{filter:drop-shadow(0 4px 6px rgba(0,0,0,.45))}}
.band{{position:absolute;left:0;right:0;bottom:0;height:80px;background:#0b0b0b;display:flex;align-items:center;padding:0 30px;z-index:3}}
</style><div class="card"><div class="meta">{meta(s)}</div>{badge(s, 104)}
{group(s)}<div class="theme">{theme}</div>
<div class="band">{band}</div></div>"""


# F (owner 2026-11-09: "leave A + enlarge logo"): A exactly, logo box enlarged from 470x104 to 580x150 (near full width, as on the box).
# Logo top stays at A's 126; it reaches up to y 276 and is drawn over the top of the crowd (A's group starts at 234).
F_LOGO_W, F_LOGO_H = 580, 150
IDS_F = ["71053", "71052", "71045"]


def page_f(s):
    """F: variant A with the series logo enlarged to B's size, layered over the crowd."""
    return page_a(s, F_LOGO_H, F_LOGO_W)


def sheet_f():
    """One row per series: original, A, F."""
    w, h, cap = 300, 400, 28
    rows = [[(f"{sid} {lab}", src) for lab, src in (
        ("original", ROOT / f"originals/{sid}/{sid}-0.jpg"), ("A", OUT / f"a-{sid}.png"),
        ("F", OUT / f"f-{sid}.png"))] for sid in IDS_F]
    img = Image.new("RGB", (3 * (w + 8) + 8, len(rows) * (h + cap + 8) + 8), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("arialbd.ttf", 18)
    for r, row in enumerate(rows):
        for c, (label, src) in enumerate(row):
            if not src.exists():
                continue
            tile = Image.open(src).convert("RGB")
            tile.thumbnail((w, h))
            x, y = 8 + c * (w + 8), 8 + r * (h + cap + 8)
            img.paste(tile, (x + (w - tile.width) // 2, y + cap + (h - tile.height) // 2))
            draw.text((x, y + 4), label, fill=(0, 0, 0), font=font)
    img.save(OUT / "sheet_f.png")


def main_f():
    """Render A and F for IDS_F, then sheet_f."""
    series = {s["id"]: s for s in json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]}
    TMP.mkdir(parents=True, exist_ok=True)
    for sid in IDS_F:
        render(f"a-{sid}", page_a(series[sid]))
        render(f"f-{sid}", page_f(series[sid]))
        print(f"f-{sid}", flush=True)
    sheet_f()


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


def sheet_d():
    """Rows 71053 and 71052: original, current, A, D. Last row: D for 71023 and 8683."""
    w, h, cap = 300, 400, 28
    rows = [[(f"{sid} {lab}", src) for lab, src in (
        ("original", ROOT / f"originals/{sid}/{sid}-0.jpg"), ("current", ROOT / f"app/public/cards/{sid}.png"),
        ("A", OUT / f"a-{sid}.png"), ("D", OUT / f"d-{sid}.png"))] for sid in IDS]
    rows.append([(f"{sid} D", OUT / f"d-{sid}.png") for sid in IDS_D[2:]])
    img = Image.new("RGB", (4 * (w + 8) + 8, len(rows) * (h + cap + 8) + 8), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("arialbd.ttf", 18)
    for r, row in enumerate(rows):
        for c, (label, src) in enumerate(row):
            tile = Image.open(src).convert("RGB")
            tile.thumbnail((w, h))
            x, y = 8 + c * (w + 8), 8 + r * (h + cap + 8)
            img.paste(tile, (x + (w - tile.width) // 2, y + cap + (h - tile.height) // 2))
            draw.text((x, y + 4), label, fill=(0, 0, 0), font=font)
    img.save(OUT / "sheet_d.png")


def sheet_e():
    """Rows 71053 and 71052: original, current, A, B, E. Last row: E for 71023 and 71045."""
    w, h, cap = 300, 400, 28
    rows = [[(f"{sid} {lab}", src) for lab, src in (
        ("original", ROOT / f"originals/{sid}/{sid}-0.jpg"), ("current", ROOT / f"app/public/cards/{sid}.png"),
        ("A", OUT / f"a-{sid}.png"), ("B", OUT / f"b-{sid}.png"), ("E", OUT / f"e-{sid}.png"))] for sid in IDS]
    rows.append([(f"{sid} E", OUT / f"e-{sid}.png") for sid in IDS_E[2:]])
    img = Image.new("RGB", (5 * (w + 8) + 8, len(rows) * (h + cap + 8) + 8), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("arialbd.ttf", 18)
    for r, row in enumerate(rows):
        for c, (label, src) in enumerate(row):
            tile = Image.open(src).convert("RGB")
            tile.thumbnail((w, h))
            x, y = 8 + c * (w + 8), 8 + r * (h + cap + 8)
            img.paste(tile, (x + (w - tile.width) // 2, y + cap + (h - tile.height) // 2))
            draw.text((x, y + 4), label, fill=(0, 0, 0), font=font)
    img.save(OUT / "sheet_e.png")


def main_e():
    """Render only variant E and its sheet (A and B pngs must already exist)."""
    series = {s["id"]: s for s in json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]}
    TMP.mkdir(parents=True, exist_ok=True)
    for sid in IDS_E:
        render(f"e-{sid}", page_e(series[sid]))
        print(f"e-{sid}", e_layout(series[sid]), flush=True)
    sheet_e()


def main():
    series = {s["id"]: s for s in json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]}
    TMP.mkdir(parents=True, exist_ok=True)
    for sid in IDS:
        for v, fn in (("a", page_a), ("b", page_b), ("c", page_c)):
            render(f"{v}-{sid}", fn(series[sid]))
            print(f"{v}-{sid}", flush=True)
    sheet()
    for sid in IDS_D:
        render(f"d-{sid}", page_d(series[sid]))
        print(f"d-{sid}", flush=True)
    sheet_d()
    main_e()


if __name__ == "__main__":
    {"e": main_e, "f": main_f}.get((sys.argv[1:] or [""])[0], main)()
