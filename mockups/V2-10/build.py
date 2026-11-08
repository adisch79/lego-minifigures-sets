"""Generate the three V2-10 admin-link mockups (a.html, b.html, c.html).

Each page is the real home header (linked to app/src/index.css, so the popover,
chip and band are the shipped styles) with the signed-in popover open and the
Admin row styled by one variant. The markup of the Admin row is exactly what
app/src/Account.tsx renders (a.adm-link > svg + span > b + small), so the chosen
variant ships as CSS only. Below the header a "states" strip shows the row at
rest, on hover and with keyboard focus.

Usage: python mockups/V2-10/build.py
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent

# SOURCE: app/src/Account.tsx AdminIcon (same paths, same stroke)
ICON = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>')

# SOURCE: git config user.email of the site owner (the only admin account)
EMAIL = "adisch79@gmail.com"

# SOURCE: app/public/catalog.json (52 series, 787 figures, 2010-2026); cards from app/public/cards/
TILES = [("71053", "Shrek", 2026, 12), ("71052", "Series 29 Minifigures", 2026, 12),
         ("71051", "Series 28 Minifigures", 2026, 12)]

VARIANTS = {
    "a": {
        "name": "A - Ink tile",
        "note": "Grey tile row like a settings entry. Ink icon square with the yellow shield, arrow that slides on hover.",
        "css": """
.adm-link { position:relative; display:flex; align-items:center; gap:14px; margin:0 0 14px; padding:12px 44px 12px 12px;
  border-radius:16px; background:var(--grey-50); color:var(--ink); text-decoration:none; transition:background .2s var(--ease); }
.adm-link svg { flex:none; box-sizing:border-box; width:42px; height:42px; padding:11px; border-radius:12px;
  background:var(--ink); color:var(--lego-yellow); transition:transform .3s var(--ease); }
.adm-link span { min-width:0; }
.adm-link b { display:block; font-size:15.5px; font-weight:800; letter-spacing:-.01em; line-height:1.2; }
.adm-link small { display:block; font-size:13px; font-weight:600; color:var(--grey-500); margin-top:2px; }
.adm-link::after { content:""; position:absolute; right:18px; top:50%; width:9px; height:9px; margin-top:-5px;
  border-top:2.6px solid var(--ink); border-right:2.6px solid var(--ink); transform:rotate(45deg); transition:transform .25s var(--ease); }
.adm-link:hover, .adm-link.is-hover { background:var(--grey-100); }
.adm-link:hover svg, .adm-link.is-hover svg { transform:rotate(-6deg) scale(1.05); }
.adm-link:hover::after, .adm-link.is-hover::after { transform:translateX(4px) rotate(45deg); }
.adm-link:focus-visible, .adm-link.is-focus { outline:3px solid var(--ink); outline-offset:3px; border-radius:16px; }
""",
    },
    "b": {
        "name": "B - Yellow brick",
        "note": "Yellow card with a solid ink under-edge like a brick; hover lifts it, press seats it. Red shield disc, ink arrow button.",
        "css": """
.adm-link { position:relative; display:flex; align-items:center; gap:14px; margin:0 0 18px; padding:14px 58px 14px 14px;
  border-radius:16px; background:var(--lego-yellow); color:var(--ink); text-decoration:none;
  box-shadow:0 4px 0 var(--ink); transform:translateY(0); transition:transform .18s var(--ease), box-shadow .18s var(--ease); }
.adm-link svg { flex:none; box-sizing:border-box; width:42px; height:42px; padding:11px; border-radius:50%;
  background:var(--lego-red); color:var(--white); }
.adm-link span { min-width:0; }
.adm-link b { display:block; font-size:16px; font-weight:800; letter-spacing:-.01em; line-height:1.2; }
.adm-link small { display:block; font-size:13px; font-weight:600; color:rgba(26,26,26,.72); margin-top:2px; }
.adm-link::before { content:""; position:absolute; right:14px; top:50%; width:32px; height:32px; margin-top:-16px; border-radius:50%; background:var(--ink); }
.adm-link::after { content:""; position:absolute; right:27px; top:50%; width:7px; height:7px; margin-top:-4px;
  border-top:2.4px solid var(--lego-yellow); border-right:2.4px solid var(--lego-yellow); transform:rotate(45deg); }
.adm-link:hover, .adm-link.is-hover { transform:translateY(-2px); box-shadow:0 6px 0 var(--ink); }
.adm-link:active { transform:translateY(3px); box-shadow:0 1px 0 var(--ink); }
.adm-link:focus-visible, .adm-link.is-focus { outline:3px solid var(--ink); outline-offset:4px; border-radius:16px; box-shadow:0 4px 0 var(--ink), 0 0 0 7px var(--white); }
""",
    },
    "c": {
        "name": "C - Staff section",
        "note": "Quiet menu entry between hairlines, with a red STAFF tag. Hover tints the row and draws a red bar on the left.",
        "css": """
.adm-link { position:relative; display:flex; align-items:center; gap:12px; margin:0 -22px 16px; padding:14px 22px;
  border-top:1px solid var(--grey-100); border-bottom:1px solid var(--grey-100); color:var(--ink); text-decoration:none;
  box-shadow:inset 0 0 0 var(--lego-red); transition:background .2s, box-shadow .25s var(--ease); }
.adm-link svg { flex:none; box-sizing:border-box; width:36px; height:36px; padding:8px; border-radius:50%;
  border:2px solid var(--lego-red); color:var(--lego-red); background:var(--white); transition:background .2s, color .2s; }
.adm-link span { flex:1; min-width:0; }
.adm-link b { display:block; font-size:15px; font-weight:800; line-height:1.2; }
.adm-link small { display:block; font-size:13px; font-weight:600; color:var(--grey-500); margin-top:1px; }
.adm-link::after { content:"Staff"; flex:none; font-size:10.5px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
  color:#B3000E; background:#FFF0F0; border-radius:999px; padding:5px 9px; }
.adm-link:hover, .adm-link.is-hover { background:var(--grey-50); box-shadow:inset 4px 0 0 var(--lego-red); }
.adm-link:hover svg, .adm-link.is-hover svg { background:var(--lego-red); color:var(--white); }
.adm-link:focus-visible, .adm-link.is-focus { outline:3px solid var(--ink); outline-offset:-5px; border-radius:12px; }
""",
    },
}

CHEV = ('<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="3" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>')


def panel(state=""):
    """Signed-in popover body, same element order as SignedInPanel."""
    cls = f"adm-link {state}".strip()
    return (f'<p class="who">Signed in as</p><p class="full">{EMAIL}</p>'
            f'<a class="{cls}" href="#admin">{ICON}<span><b>Admin</b><small>Wanted wall and allowlist</small></span></a>'
            '<button type="button" class="out">Sign out</button>')


def tile(sid, name, year, n):
    return (f'<li class="tile"><a class="tile-link" href="#series/{sid}"><div class="art">'
            f'<img src="../../app/public/cards/{sid}.png" alt=""></div></a>'
            f'<div class="meta"><div class="meta-row"><span class="num">No. {sid} &middot; {year}</span>'
            f'<span class="count-badge">{n} figures</span></div><h2><a href="#series/{sid}">{name}</a></h2></div></li>')


PAGE = """<!doctype html>
<!-- V2-10 mockup {key}: {name}. Generated by build.py; edit there. -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>V2-10 {name}</title>
<link rel="stylesheet" href="../../app/src/index.css">
<style>
/* Mockup-only: keep the popover still for the screenshot */
.pop {{ animation:none; }}
.tile {{ animation:none; }}
/* Variant CSS: this block is what would ship in app/src/index.css */
{css}
/* Mockup-only: states strip */
.states {{ background:var(--grey-50); padding:36px 0 44px; border-bottom:1px solid var(--grey-100); }}
.states h2 {{ font-size:13px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; margin:0 0 4px; }}
.states p.n {{ font-size:15px; color:var(--grey-500); margin:0 0 22px; max-width:70ch; line-height:1.45; }}
.states .row {{ display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }}
.states figure {{ margin:0; }}
.states figcaption {{ font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--grey-500); margin:0 0 10px; }}
.states .pop {{ position:relative; inset:auto; width:auto; }}
.states .pop::before {{ display:none; }}
@media (max-width:640px) {{ .states .row {{ grid-template-columns:1fr; }} }}
</style></head>
<body>
<header class="band"><div class="wrap">
  <div class="band-top">
    <a class="brand" href="./"><span class="brand-mark" aria-hidden="true"><i></i></span>
      <span><b>Minifig Hunt</b><small>Collectible Minifigures</small></span></a>
    <div class="controls">
      <label class="field"><span class="sr">Search series</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" placeholder="Search series, year, figure"></label>
      <label><span class="sr">Sort series</span><select><option>Newest first</option></select></label>
    </div>
    <div class="acct">
      <button type="button" class="me open" aria-expanded="true" aria-controls="pop" aria-label="Account, signed in as {email}">
        <span class="av" aria-hidden="true">A</span><span class="addr" aria-hidden="true">{email}</span>{chev}</button>
      <div class="pop pop-me" id="pop" role="dialog" aria-label="Account">{panel}</div>
    </div>
  </div>
  <div class="band-hero">
    <h1 class="big">Every series.<br>Every <em>figure.</em></h1>
    <div><p class="lede">Browse every Collectible Minifigures series, or find one by the name of a single figure.</p>
      <div class="stats"><div><strong>52</strong>Series</div><div><strong>787</strong>Figures</div><div><strong>2010<span>-2026</span></strong>Years</div></div></div>
  </div>
</div></header>
<section class="states"><div class="wrap">
  <h2>{name}</h2><p class="n">{note}</p>
  <div class="row">
    <figure><figcaption>Rest</figcaption><div class="pop pop-me">{p_rest}</div></figure>
    <figure><figcaption>Hover</figcaption><div class="pop pop-me">{p_hover}</div></figure>
    <figure><figcaption>Keyboard focus</figcaption><div class="pop pop-me">{p_focus}</div></figure>
  </div>
</div></section>
<main class="wrap">
  <div class="rule"><span><b>52 series</b></span><span>Newest first</span></div>
  <ul class="grid">{tiles}</ul>
</main>
</body></html>
"""

for key, v in VARIANTS.items():
    html = PAGE.format(key=key, name=v["name"], note=v["note"], css=v["css"].strip(), email=EMAIL, chev=CHEV,
                       panel=panel(), p_rest=panel(), p_hover=panel("is-hover"), p_focus=panel("is-focus"),
                       tiles="".join(tile(*t) for t in TILES))
    (HERE / f"{key}.html").write_text(html, encoding="utf-8")
    print("wrote", HERE / f"{key}.html")
