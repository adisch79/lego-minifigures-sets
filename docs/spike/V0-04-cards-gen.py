# Generates the four 71019 series card variants as standalone HTML files.
import os
OUT = r"E:/Dev/lego-minifigures-sets/lego-minifigures-sets/mockups/cards"
F = "../assets/figs/71019-%d.webp"
WIDE = {1, 3, 4, 8, 12, 14, 19}  # source images that are ~square instead of 3:4


def crowd(rows, cx=300, bottom=0, spread=1.0, fit=None, center_top=False):
    """rows: list of (fig_ids, height_px, baseline_offset_px, brightness). Back row first.
    fit=(left_px, right_px): shrink the step so no figure crosses those x limits.
    center_top: inside each row the middle figure is stacked on top, edges underneath."""
    out = []
    z = 1
    for ids, h, base, bright in rows:
        widths = [h * (1.0 if i in WIDE else 0.75) for i in ids]
        step = sum(widths) / len(ids) * 0.62 * spread
        if fit and len(ids) > 1:
            room = (fit[1] - fit[0]) - widths[0] / 2 - widths[-1] / 2
            step = min(step, room / (len(ids) - 1))
        total = step * (len(ids) - 1)
        for k, i in enumerate(ids):
            x = cx - total / 2 + k * step - widths[k] / 2
            # slight vertical jitter so rows do not read as a grid
            j = [0, 6, -4, 8, -2, 5, -6, 3][k % 8]
            zz = z + len(ids) - int(abs(k - (len(ids) - 1) / 2) * 2) if center_top else z
            out.append(
                f'<img class="fig" src="{F % i}" alt="" style="left:{x:.0f}px;bottom:{bottom + base + j}px;'
                f'height:{h}px;z-index:{zz};filter:brightness({bright}) drop-shadow(0 6px 8px rgba(0,0,0,.35))">')
            z += 1
        z += len(ids)
    return "\n".join(out)


BACK = [15, 5, 9, 12, 16, 6, 18]
MID = [11, 7, 19, 13, 4, 17, 10]
FRONT = [20, 1, 2, 3, 8, 14]

BASE_CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:600px;height:800px;overflow:hidden;background:#000}
body{font-family:"Segoe UI","Helvetica Neue",Arial,system-ui,sans-serif}
.card{position:relative;width:600px;height:800px;overflow:hidden}
.fig{position:absolute;width:auto;user-select:none}
.lockup{display:block;width:300px;height:auto}
/* SOURCE: colours sampled from the LEGO logo on the 71019 bag image (originals/71019/71019-0.jpg) */
:root{--lego-red:#DF0012;--lego-yellow:#FDE01B}
"""


def page(title, css, body):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<style>{BASE_CSS}{css}</style></head>
<body>{body}</body></html>
"""


# ---------- V1: faithful bag-front layout, re-set cleanly ----------
v1_css = """
.card{background:
  radial-gradient(120% 60% at 70% 18%, #f6d7b0 0%, #c99a7a 30%, #6b4b4a 62%, #1d1416 100%)}
.sky{position:absolute;inset:0;background:
  repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 2px, transparent 2px 46px),
  linear-gradient(180deg, transparent 0 40%, rgba(0,0,0,.25) 100%)}
.meta{position:absolute;left:34px;top:30px;color:#111;line-height:1}
.meta .lab{font-size:13px;font-weight:600;letter-spacing:.04em;color:#2a1d1c}
.meta .age{font-size:52px;font-weight:900;letter-spacing:-.02em;margin-top:2px}
.meta .rule{width:118px;height:2px;background:#111;margin:6px 0 6px}
.meta .num{font-size:26px;font-weight:800;letter-spacing:.02em}
.logo{position:absolute;left:34px;top:170px;width:96px;height:96px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}
.title{position:absolute;left:150px;top:160px;right:30px;text-align:left}
.title .the{font-size:16px;font-weight:800;letter-spacing:.35em;color:#fde01b;text-shadow:0 2px 0 #5a0a0a}
.title .name{font-size:58px;font-weight:900;font-style:italic;letter-spacing:-.01em;line-height:.9;
  -webkit-text-stroke:2px #3a0306;
  background:linear-gradient(180deg,#fff 0%,#ffd9a0 45%,#e2542c 55%,#9e0f12 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 4px 0 #1a0a0a)}
.title .movie{font-size:18px;font-weight:800;letter-spacing:.6em;color:#fff;margin-top:6px;text-shadow:0 2px 4px rgba(0,0,0,.6)}
.badge{position:absolute;right:30px;top:26px;width:118px;height:118px;border-radius:50%;
  background:#fff;box-shadow:0 0 0 4px var(--lego-red) inset,0 8px 18px rgba(0,0,0,.3);
  display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-8deg)}
.badge small{font-size:9px;font-weight:800;letter-spacing:.1em;color:var(--lego-red)}
.badge b{font-size:40px;font-weight:900;line-height:1;color:#fff;background:var(--lego-red);
  border-radius:50%;width:54px;height:54px;display:flex;align-items:center;justify-content:center;margin:2px 0}
.stage{position:absolute;left:0;right:0;top:0;bottom:96px;overflow:hidden}
.band{position:absolute;left:0;right:0;bottom:0;height:96px;background:linear-gradient(180deg,#151515,#050505);
  border-top:3px solid var(--lego-yellow);display:flex;align-items:center;justify-content:space-between;padding:0 30px;z-index:50}
.band .tag{color:#fff;font-size:13px;font-weight:700;letter-spacing:.16em;text-align:right;line-height:1.5}
.band .tag span{color:var(--lego-yellow)}
"""
v1_body = f"""<div class="card">
<div class="sky"></div>
<div class="meta"><div class="lab">Ages</div><div class="age">5+</div><div class="rule"></div><div class="num">71019</div></div>
<div class="badge"><small>LIMITED</small><b>20</b><small>TO COLLECT</small></div>
<img class="logo" src="../assets/logos/lego.svg" alt="LEGO">
<div class="title"><div class="the">THE LEGO</div><div class="name">NINJAGO</div><div class="movie">MOVIE</div></div>
<div class="stage">
{crowd([(BACK, 170, 190, 0.72), (MID, 205, 95, 0.88), (FRONT, 250, -20, 1.0)])}
</div>
<div class="band"><img class="lockup" src="../assets/logos/lego-minifigures-lockup.png" alt="LEGO Minifigures" style="width:260px">
<div class="tag">SERIES <span>71019</span><br>1 MINIFIGURE PER BAG</div></div>
</div>"""

# ---------- V2: bold poster, huge number, crowd bursting from bottom ----------
v2_css = """
.card{background:radial-gradient(90% 70% at 50% 75%, #6d0a10 0%, #2a0507 55%, #0b0203 100%)}
.rays{position:absolute;inset:-200px;background:repeating-conic-gradient(from 0deg at 50% 62%, rgba(255,255,255,.035) 0 6deg, transparent 6deg 14deg)}
.huge{position:absolute;left:0;right:0;top:74px;text-align:center;font-size:400px;font-weight:900;line-height:.8;
  letter-spacing:-.06em;color:transparent;-webkit-text-stroke:3px var(--lego-yellow);opacity:.95}
.top{position:absolute;left:28px;right:28px;top:26px;display:flex;justify-content:space-between;align-items:center;z-index:60}
.chips{display:flex;gap:8px}
.chip{font-weight:900;font-size:20px;padding:6px 12px;border-radius:6px;line-height:1}
.chip.age{background:#fff;color:#111}
.chip.num{background:transparent;color:#fff;border:2px solid rgba(255,255,255,.7)}
.label{position:absolute;left:0;right:0;text-align:center;top:404px;color:var(--lego-yellow);font-weight:900;font-size:15px;letter-spacing:.35em;z-index:1}
.series{position:absolute;left:0;right:0;top:432px;text-align:center;z-index:1}
.series .the{font-size:14px;font-weight:700;letter-spacing:.5em;color:rgba(255,255,255,.75)}
.series .name{font-size:44px;font-weight:900;font-style:italic;letter-spacing:.02em;color:#fff;text-transform:uppercase;
  text-shadow:0 3px 0 var(--lego-red),0 10px 24px rgba(0,0,0,.6)}
.stage{position:absolute;inset:0}
.fade{position:absolute;left:0;right:0;bottom:0;height:90px;background:linear-gradient(180deg,transparent,rgba(11,2,3,.9));z-index:40}
.foot{position:absolute;left:0;right:0;bottom:16px;text-align:center;z-index:45;color:#fff;font-size:12px;font-weight:700;letter-spacing:.4em;opacity:.8}
"""
v2_body = f"""<div class="card">
<div class="rays"></div>
<div class="huge">20</div>
<div class="label">TO COLLECT</div>
<div class="top"><img class="lockup" src="../assets/logos/lego-minifigures-lockup.png" alt="LEGO Minifigures" style="width:250px">
<div class="chips"><span class="chip age">5+</span><span class="chip num">71019</span></div></div>
<div class="series"><div class="the">THE LEGO</div><div class="name">Ninjago Movie</div></div>
<div class="stage">
{crowd([(BACK, 150, 150, 0.62), (MID, 190, 60, 0.82), (FRONT, 250, -60, 1.0)], spread=1.05)}
</div>
<div class="fade"></div>
<div class="foot">COLLECTIBLE MINIFIGURES</div>
</div>"""


# ---------- V3: minimal collector card on light background ----------
def grid():
    out = []
    for r in range(2):
        y = 312 + r * 150
        for k in range(10):
            i = r * 10 + k + 1
            x = 34 + k * 53.2
            out.append(f'<div class="cell" style="left:{x:.0f}px;top:{y}px"><img src="{F % i}" alt=""><span>{i:02d}</span></div>')
    return "\n".join(out)


v3_css = """
.card{background:#f4f1ea;color:#141414}
.card::before{content:"";position:absolute;inset:18px;border:1px solid rgba(20,20,20,.12);border-radius:14px;pointer-events:none}
.head{position:absolute;left:34px;right:34px;top:40px;display:flex;justify-content:space-between;align-items:flex-start}
.kicker{font-size:11px;font-weight:700;letter-spacing:.3em;color:#8a8478}
.title{position:absolute;left:34px;top:118px;right:34px}
.title .the{font-size:15px;font-weight:600;letter-spacing:.24em;color:var(--lego-red)}
.title .name{font-family:Georgia,"Times New Roman",serif;font-size:56px;line-height:1;font-weight:400;letter-spacing:-.02em;margin-top:6px}
.title .rule{margin-top:18px;height:3px;width:64px;background:var(--lego-red)}
.cell{position:absolute;width:54px;height:150px}
.cell img{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);height:118px;width:auto;
  filter:drop-shadow(0 6px 6px rgba(0,0,0,.18))}
.cell span{position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:10px;font-weight:700;letter-spacing:.1em;color:#a39d90}
.shelf{position:absolute;left:34px;right:34px;height:1px;background:rgba(20,20,20,.14)}
.foot{position:absolute;left:34px;right:34px;bottom:44px;display:flex;align-items:flex-end;justify-content:space-between}
.cluster{display:flex;gap:10px;align-items:center}
.pill{height:54px;min-width:54px;padding:0 14px;border-radius:12px;display:flex;align-items:center;justify-content:center;
  font-weight:900;font-size:22px;line-height:1}
.pill.age{background:#141414;color:#fff}
.pill.num{background:#fff;color:#141414;border:1.5px solid #141414;font-size:20px;letter-spacing:.04em}
.count{width:84px;height:84px;border-radius:50%;background:var(--lego-red);color:#fff;display:flex;flex-direction:column;
  align-items:center;justify-content:center;box-shadow:0 0 0 4px #f4f1ea,0 0 0 6px var(--lego-yellow)}
.count b{font-size:36px;font-weight:900;line-height:.9}
.count small{font-size:9px;font-weight:800;letter-spacing:.14em}
.legal{font-size:10px;letter-spacing:.2em;color:#8a8478;margin-top:8px}
"""
v3_body = f"""<div class="card">
<div class="head"><img class="lockup" src="../assets/logos/lego-minifigures-lockup.png" alt="LEGO Minifigures" style="width:236px">
<div class="kicker">COLLECTOR CARD</div></div>
<div class="title"><div class="the">THE LEGO</div><div class="name"><em>Ninjago</em> Movie</div><div class="rule"></div></div>
{grid()}
<div class="shelf" style="top:462px"></div>
<div class="shelf" style="top:612px"></div>
<div class="foot"><div><div class="cluster"><span class="pill age">5+</span><span class="pill num">71019</span></div>
<div class="legal">AGES &middot; SET NUMBER</div></div>
<div class="count"><b>20</b><small>TO COLLECT</small></div></div>
</div>"""

# ---------- V4: V1 bag-front layout + bag-style count badge, official theme logo ----------
# Owner 2026-10-31: keep V1 layout, main characters in front, no figure cut at the card edge,
# real series logo, count badge styled like the "LIMITED EDITION / 20 / TO COLLECT" seal on the bag
# (reference: originals/71019/71019-0.jpg, top right). Logos: mockups/assets/logos/SOURCES.md.
V4_BACK = [15, 12, 16, 9, 13, 17, 14]
V4_MID = [11, 18, 5, 19, 4, 20, 7]
V4_FRONT = [1, 6, 8, 3, 10, 2]  # Kai, Jay, Cole, Lloyd (centre, on top), Zane, Nya


def seal(count, size=150):
    """Round white seal: arc text top and bottom, big red italic count in the middle."""
    return f"""<svg class="seal" width="{size}" height="{size}" viewBox="0 0 160 160" aria-label="Limited edition, {count} to collect">
<defs>
<path id="sealTop" d="M 22,80 A 58,58 0 0 1 138,80"/>
<path id="sealBot" d="M 14,80 A 66,66 0 0 0 146,80"/>
</defs>
<circle cx="80" cy="80" r="77" fill="#fff"/>
<text class="arc"><textPath href="#sealTop" startOffset="50%" text-anchor="middle">LIMITED EDITION</textPath></text>
<text class="arc"><textPath href="#sealBot" startOffset="50%" text-anchor="middle">TO COLLECT</textPath></text>
<circle cx="24" cy="104" r="4" fill="var(--lego-red)"/><circle cx="136" cy="104" r="4" fill="var(--lego-red)"/>
<text class="num" x="78" y="107" text-anchor="middle">{count}</text>
</svg>"""


v4_css = """
.card{background:
  radial-gradient(120% 60% at 70% 18%, #f6d7b0 0%, #c99a7a 30%, #6b4b4a 62%, #1d1416 100%)}
.sky{position:absolute;inset:0;background:
  repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 2px, transparent 2px 46px),
  linear-gradient(180deg, transparent 0 40%, rgba(0,0,0,.25) 100%)}
.meta{position:absolute;left:34px;top:30px;color:#111;line-height:1;z-index:5}
.meta .lab{font-size:13px;font-weight:600;letter-spacing:.04em;color:#2a1d1c}
.meta .age{font-size:52px;font-weight:900;letter-spacing:-.02em;margin-top:2px}
.meta .rule{width:118px;height:2px;background:#111;margin:6px 0 6px}
.meta .num{font-size:26px;font-weight:800;letter-spacing:.02em}
.seal{position:absolute;right:30px;top:26px;z-index:6;transform:rotate(-14deg);
  filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}
.seal .arc{font-family:"Arial Black","Segoe UI Black",Arial,sans-serif;font-weight:900;font-size:17px;fill:#111;letter-spacing:.5px}
.seal .num{font-family:"Arial Black","Segoe UI Black",Arial,sans-serif;font-weight:900;font-style:italic;font-size:74px;
  fill:var(--lego-red);letter-spacing:-4px}
.theme{position:absolute;left:0;right:0;top:206px;text-align:center;z-index:5}
.theme img{width:430px;height:auto;filter:drop-shadow(0 5px 8px rgba(0,0,0,.4))}
.stage{position:absolute;left:0;right:0;top:0;bottom:96px;overflow:hidden;z-index:4}
.band{position:absolute;left:0;right:0;bottom:0;height:96px;background:linear-gradient(180deg,#151515,#050505);
  border-top:3px solid var(--lego-yellow);display:flex;align-items:center;justify-content:space-between;padding:0 30px;z-index:50}
.band .tag{color:#fff;font-size:13px;font-weight:700;letter-spacing:.16em;text-align:right;line-height:1.5}
.band .tag span{color:var(--lego-yellow)}
"""
v4_body = f"""<div class="card">
<div class="sky"></div>
<div class="meta"><div class="lab">Ages</div><div class="age">5+</div><div class="rule"></div><div class="num">71019</div></div>
{seal(20)}
<div class="theme"><img src="../assets/logos/ninjago-movie.png" alt="LEGO The Ninjago Movie"></div>
<div class="stage">
{crowd([(V4_BACK, 160, 232, 0.70), (V4_MID, 200, 128, 0.86), (V4_FRONT, 250, -10, 1.0)], fit=(10, 590), center_top=True)}
</div>
<div class="band"><img class="lockup" src="../assets/logos/lego-minifigures-lockup.png" alt="LEGO Minifigures" style="width:250px">
<div class="tag">SERIES <span>71019</span><br>1 MINIFIGURE PER BAG</div></div>
</div>"""

for name, css, body in [("v1", v1_css, v1_body), ("v2", v2_css, v2_body), ("v3", v3_css, v3_body), ("v4", v4_css, v4_body)]:
    with open(os.path.join(OUT, name + ".html"), "w", encoding="utf-8") as f:
        f.write(page(f"71019 card {name}", css, body))

with open(os.path.join(OUT, "compare.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>71019 card variants</title>
<style>body{margin:0;background:#1b1b1d;font-family:"Segoe UI",Arial,sans-serif;color:#ddd;display:flex;gap:30px;justify-content:center;padding:20px}
figure{margin:0;text-align:center}img{width:560px;height:747px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
figcaption{margin-top:10px;font-size:15px;font-weight:600;letter-spacing:.1em}</style></head><body>
<figure><img src="v1.png" alt=""><figcaption>V1 BAG FRONT</figcaption></figure>
<figure><img src="v2.png" alt=""><figcaption>V2 POSTER</figcaption></figure>
<figure><img src="v3.png" alt=""><figcaption>V3 COLLECTOR</figcaption></figure>
<figure><img src="v4.png" alt=""><figcaption>V4 BAG FRONT + COUNT</figcaption></figure>
</body></html>""")
