"""Generate the three V2-15 mockups (a.html, b.html, c.html): Contact page and Buy me a coffee page.

Each page is a board of four frames, top to bottom:
  01 how a visitor reaches the two pages from the existing site,
  02 the Contact form (name optional, email for the reply, message up to 2000 characters,
     Cloudflare Turnstile placeholder, Send),
  03 the Contact success state,
  04 the Buy me a coffee page, with the button disabled as "Coming soon" because the payment
     link does not exist yet.
No email address of the site owner appears anywhere: the form is the only channel.

All frames link app/src/index.css, so the yellow band, brand, pills and type are the shipped
styles. Variant CSS sits in its own block and is what would ship.

Usage: python mockups/V2-15/build.py   then   sh mockups/V2-15/shoot.sh a   (b, c), python mockups/V2-15/sheet.py
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent

# SOURCE: app/public/catalog.json (52 series, 787 figures, 2010-2026), counted by script on 2026-11-16
N_SERIES, N_FIGS, Y0, Y1 = 52, 787, 2010, 2026

# SOURCE: app/public/catalog.json figure names; cut-out art from site/img (RGBA webp)
FIG = {
    "barista": ("../../site/img/71004/71004-10.webp", "Larry the Barista"),
    "detective": ("../../site/img/71045/71045-1.webp", "Film Noir Detective"),
    "librarian": ("../../site/img/71001/71001-1.webp", "Librarian"),
    "waiter": ("../../site/img/71000/71000-1.webp", "Waiter"),
    "boba": ("../../site/img/71052/71052-5.webp", "Boba Cup Fan"),
    "cake": ("../../site/img/71021/71021-10.webp", "Cake Guy"),
}

# SOURCE: app/public/catalog.json, newest three series; cards from app/public/cards/
TILES = [("71053", "Shrek", 2026, 12), ("71052", "Series 29 Minifigures", 2026, 12),
         ("71051", "Series 28 Minifigures", 2026, 12)]

# Sample visitor input shown in the filled form and the success state (mockup data, not a real person)
V_NAME, V_EMAIL = "Dana", "dana.k@example.com"
V_MSG = ("Hi! Love the site, I use it every time a new wave hits the shops. Is there a way to export "
         "my owned list? I also keep my collection in a spreadsheet and would love to sync the two.")

# ---------------------------------------------------------------- icons (stroke icons, 24 grid)
def ico(paths, size=18, sw=2.2):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths}</svg>')

CUP = '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V9Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 2.8c-.8 1 .8 2 0 3.2M12 2.8c-.8 1 .8 2 0 3.2"/>'
MAIL = '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>'
CHECK = '<path d="m5 12.5 4.5 4.5L19 7.5"/>'
CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
ARROW_L = '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>'
ARROW_R = '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'
USER = '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"/>'
SEND = '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4 18-7Z"/>'
HEART = '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"/>'
SEARCH = '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'
SHIELD = '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/>'

BRAND = ('<a class="brand" href="#"><span class="brand-mark" aria-hidden="true">'
         '<img src="../../app/public/favicon.svg" alt="" width="36" height="36"></span>'
         '<span><b>Minifig Hunt</b><small>Collectible Minifigures</small></span></a>')
SIGNIN = f'<div class="acct"><button type="button" class="pill-in">{ico(USER, 16, 2.4)}<span class="t">Sign in</span></button></div>'
BACK = f'<a class="back" href="#">{ico(ARROW_L, 16, 2.6)}<span class="back-t">All series</span></a>'
CONTROLS = (f'<div class="controls"><label class="field"><span class="sr">Search series</span>{ico(SEARCH, 16, 2.4)}'
            '<input type="search" placeholder="Search series, year, figure"></label>'
            '<label><span class="sr">Sort series</span><select><option>Newest first</option></select></label></div>')

# Cloudflare Turnstile placeholder, drawn at the real widget size (300 x 65, light theme)
TURNSTILE = ('<div class="ts" role="img" aria-label="Cloudflare Turnstile check (placeholder)">'
             '<span class="ts-box"></span><span class="ts-t">Verify you are human</span>'
             '<span class="ts-cf"><b>CLOUDFLARE</b><small>Privacy &middot; Terms</small></span></div>')


def fig(key, cls=""):
    src, name = FIG[key]
    return f'<img class="{cls}" src="{src}" alt="{name}" title="{name}">'


def tiles():
    return "".join(
        f'<li class="tile"><a class="tile-link" href="#"><div class="art"><img src="../../app/public/cards/{sid}.png" alt=""></div></a>'
        f'<div class="meta"><div class="meta-row"><span class="num">No. {sid} &middot; {y}</span>'
        f'<span class="count-badge">{n} figures</span></div><h2><a href="#">{name}</a></h2></div></li>'
        for sid, name, y, n in TILES)


def form(filled=True, send_label="Send message", extra_cls=""):
    """Contact form. Fields and limits per the V2-15 story."""
    name = V_NAME if filled else ""
    email = V_EMAIL if filled else ""
    msg = V_MSG if filled else ""
    return f"""
<form class="cf {extra_cls}" onsubmit="return false">
  <div class="row2">
    <label class="fld"><span class="lbl">Your name <i>optional</i></span>
      <input class="in" type="text" value="{name}" placeholder="What should I call you?" autocomplete="name"></label>
    <label class="fld"><span class="lbl">Your email <i>for the reply</i></span>
      <input class="in" type="email" value="{email}" placeholder="you@example.com" autocomplete="email" required></label>
  </div>
  <label class="fld"><span class="lbl">Message</span>
    <textarea class="in" maxlength="2000" rows="6" placeholder="A missing figure, a wrong name, an idea for the site...">{msg}</textarea>
    <span class="count"><b>{len(msg)}</b> / 2000</span></label>
  <div class="cf-foot">
    {TURNSTILE}
    <button type="submit" class="go">{ico(SEND, 17, 2.4)}<span>{send_label}</span></button>
  </div>
  <p class="priv">{ico(SHIELD, 14, 2.4)}Your email is used only to answer you. It is not shown, shared or added to a list.</p>
</form>"""


# ---------------------------------------------------------------- shared board and form CSS
BASE_CSS = """
/* Mockup board: dark table, each frame is one browser page */
body { background:#121211; }
.board { max-width:1216px; margin:0 auto; padding:28px 0 64px; }
.board-h { color:#F6F6F4; padding:0 8px 22px; display:flex; gap:24px; align-items:flex-end; justify-content:space-between; }
.board-h h1 { margin:0; font-size:30px; letter-spacing:-.03em; font-weight:800; }
.board-h h1 span { color:var(--lego-yellow); }
.board-h p { margin:6px 0 0; font-size:14.5px; line-height:1.5; color:#B9B9B3; max-width:76ch; }
.tag { margin:30px 8px 10px; font-size:12px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#8E8E88; }
.tag b { color:var(--lego-yellow); margin-right:8px; }
.page { background:var(--white); border-radius:18px; overflow:hidden; position:relative; }
.page .wrap { max-width:1152px; }
.tile, .stats div { animation:none; }
.ann { position:absolute; z-index:30; background:var(--lego-red); color:var(--white); font-size:12px; font-weight:800; letter-spacing:.04em;
  padding:6px 11px; border-radius:999px; box-shadow:0 8px 18px -8px rgba(0,0,0,.6); white-space:nowrap; }

/* Form parts shared by all three directions; each direction restyles them */
.cf { display:flex; flex-direction:column; gap:18px; }
.row2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.fld { display:flex; flex-direction:column; gap:7px; min-width:0; position:relative; }
.lbl { font-size:12px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
.lbl i { font-style:normal; font-weight:600; letter-spacing:0; text-transform:none; color:var(--grey-500); margin-left:6px; font-size:13px; }
.in { width:100%; font:inherit; font-size:15px; color:var(--ink); height:50px; border-radius:14px; border:2px solid var(--grey-100);
  background:var(--grey-50); padding:0 16px; transition:border-color .2s, background .2s; }
.in::placeholder { color:#8A8A84; }
.in:focus { outline:none; border-color:var(--ink); background:var(--white); }
textarea.in { height:150px; padding:14px 16px; line-height:1.55; resize:vertical; }
.count { align-self:flex-end; font-size:12.5px; font-weight:700; color:var(--grey-500); font-variant-numeric:tabular-nums; }
.count b { color:var(--ink); }
.cf-foot { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.go { display:inline-flex; align-items:center; justify-content:center; gap:9px; height:52px; padding:0 26px; border:0; border-radius:999px;
  background:var(--lego-red); color:var(--white); font:inherit; font-size:15.5px; font-weight:800; cursor:pointer; transition:transform .15s; }
.go:active { transform:scale(.97); }
.priv { display:flex; gap:8px; align-items:flex-start; margin:0; font-size:13px; line-height:1.45; font-weight:600; color:var(--grey-500); }
.priv svg { flex:none; margin-top:2px; }

/* Turnstile placeholder at the widget's real 300 x 65 size */
.ts { box-sizing:border-box; width:300px; height:65px; flex:none; display:flex; align-items:center; gap:12px; padding:0 12px 0 14px;
  background:#FAFAFA; border:1px solid #E0E0E0; border-radius:4px; font-family:system-ui, -apple-system, "Segoe UI", sans-serif; color:#232323; }
.ts-box { width:26px; height:26px; border:2px solid #C9C9C9; border-radius:4px; background:#fff; flex:none; }
.ts-t { font-size:14px; flex:1; }
.ts-cf { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
.ts-cf b { font-size:10px; font-weight:800; letter-spacing:.06em; color:#F38020; }
.ts-cf small { font-size:9px; color:#6E6E69; }

/* Disabled coffee button: the payment link does not exist yet */
.soon { display:inline-flex; align-items:center; gap:10px; height:56px; padding:0 26px; border-radius:999px; border:2px dashed var(--grey-300);
  background:var(--grey-50); color:var(--grey-500); font:inherit; font-size:16px; font-weight:800; cursor:not-allowed; }
.soon em { font-style:normal; font-size:11.5px; letter-spacing:.12em; text-transform:uppercase; background:var(--ink); color:var(--lego-yellow);
  padding:4px 9px; border-radius:999px; }

@media (max-width:640px) {
  .board { padding:18px 0 40px; }
  .board-h { padding:0 16px 14px; display:block; }
  .board-h h1 { font-size:24px; }
  .tag { margin:24px 16px 8px; }
  .page { border-radius:0; }
  .row2 { grid-template-columns:1fr; gap:18px; }
  .in { font-size:16px; }
  .cf-foot { flex-direction:column; align-items:stretch; }
  .ts { width:100%; max-width:300px; align-self:center; }
  .go { width:100%; }
  .soon { width:100%; justify-content:center; }
  .ann { font-size:11px; }
}
"""

PAGE = """<!doctype html>
<!-- V2-15 mockup {key}: {name}. Generated by build.py; edit there. -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>V2-15 {name}</title>
<link rel="stylesheet" href="../../app/src/index.css">
<style>
{base}
/* ---- Direction {key_up} CSS: this block is what would ship ---- */
{css}
</style></head>
<body><div class="board">
<div class="board-h"><div><h1><span>{key_up}</span> &middot; {name}</h1><p>{note}</p></div></div>
<p class="tag"><b>01</b>How you get there</p>{f1}
<p class="tag"><b>02</b>Contact</p>{f2}
<p class="tag"><b>03</b>Contact, after Send</p>{f3}
<p class="tag"><b>04</b>Buy me a coffee (payment link not live yet)</p>{f4}
</div></body></html>
"""

# ================================================================ A: Catalog card
A_NAME = "Catalog card"
A_NOTE = ("Quiet and on-brand: the same yellow band and big headline as the catalog, one calm grey card per page. "
          "Both pages live in a new ink footer on every page, so they never compete with search in the header.")
A_CSS = """
.a-foot { background:var(--ink); color:var(--white); }
.a-foot .wrap { display:flex; align-items:center; gap:28px; padding-top:30px; padding-bottom:30px; flex-wrap:wrap; }
.a-foot .brand { color:var(--white); }
.a-foot .brand small { opacity:.6; }
.a-foot nav { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap; }
.a-foot nav a { display:inline-flex; align-items:center; gap:8px; height:42px; padding:0 18px; border-radius:999px; color:var(--white);
  text-decoration:none; font-size:14px; font-weight:700; background:rgba(255,255,255,.08); transition:background .2s, color .2s; }
.a-foot nav a:hover { background:rgba(255,255,255,.16); }
.a-foot nav a.cup { background:var(--lego-yellow); color:var(--ink); }
.a-foot .fine { width:100%; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,.12);
  padding-top:18px; font-size:12.5px; font-weight:600; color:#A3A39D; }
.a-tease { max-height:330px; overflow:hidden; position:relative; }
.a-tease::after { content:""; position:absolute; inset:auto 0 0; height:120px; background:linear-gradient(transparent, var(--white)); }

.a-band .band-hero { padding:22px 0 44px; }
.a-main { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(0,1fr); gap:40px; padding-top:44px; padding-bottom:72px; align-items:start; }
.a-card { background:var(--grey-50); border:1px solid var(--grey-100); border-radius:24px; padding:32px; }
.a-card .in { background:var(--white); }
.a-card h2 { margin:0 0 4px; font-size:24px; font-weight:800; letter-spacing:-.03em; }
.a-card .sub { margin:0 0 22px; font-size:15px; line-height:1.5; color:var(--grey-500); font-weight:500; }
.a-side h3 { font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; margin:6px 0 14px; }
.a-side ul { list-style:none; margin:0 0 30px; padding:0; display:flex; flex-direction:column; gap:10px; }
.a-side li { display:flex; gap:12px; align-items:flex-start; font-size:15px; line-height:1.45; font-weight:500; }
.a-side li b { flex:none; width:28px; height:28px; border-radius:9px; background:var(--lego-yellow); display:grid; place-items:center; font-size:13px; font-weight:800; }
.a-side .note { border-top:2px solid var(--ink); padding-top:16px; font-size:14px; line-height:1.5; color:var(--grey-500); font-weight:500; margin:0; }
.a-side .note a { color:var(--ink); font-weight:800; }

.a-sent { text-align:left; }
.a-sent .env { width:64px; height:64px; border-radius:18px; background:var(--lego-yellow); display:grid; place-items:center; margin-bottom:18px; animation:stamp .6s var(--ease) both; }
.a-sent h2 { font-size:30px; }
.a-sent p { font-size:16px; line-height:1.55; margin:0 0 14px; font-weight:500; max-width:52ch; }
.a-sent .echo { background:var(--white); border:1px solid var(--grey-100); border-radius:16px; padding:16px 18px; font-size:14.5px; color:var(--grey-500); line-height:1.5; margin:4px 0 22px; }
.a-sent .echo b { color:var(--ink); display:block; font-size:12px; letter-spacing:.1em; text-transform:uppercase; margin-bottom:6px; }
.a-row { display:flex; gap:10px; flex-wrap:wrap; }
.btn-ink { display:inline-flex; align-items:center; gap:8px; height:46px; padding:0 20px; border-radius:999px; background:var(--ink); color:var(--lego-yellow);
  text-decoration:none; font-size:14.5px; font-weight:800; border:0; font-family:inherit; }
.btn-line { display:inline-flex; align-items:center; gap:8px; height:46px; padding:0 20px; border-radius:999px; border:2px solid var(--ink); color:var(--ink);
  background:var(--white); text-decoration:none; font-size:14.5px; font-weight:800; font-family:inherit; }

.a-coffee { display:grid; grid-template-columns:auto 1fr; gap:28px; align-items:start; }
.a-mug { width:96px; height:96px; border-radius:26px; background:var(--ink); color:var(--lego-yellow); display:grid; place-items:center; }
.a-coffee p { font-size:16.5px; line-height:1.6; margin:0 0 14px; font-weight:500; max-width:56ch; }
.a-coffee .facts { margin:20px 0 26px; }
.a-coffee .facts .fact { background:var(--white); border:1px solid var(--grey-100); }
.a-coffee .hint2 { font-size:13.5px; font-weight:600; color:var(--grey-500); margin:12px 0 0; }
.a-thanks { background:var(--lego-yellow); border-radius:24px; padding:28px; }
.a-thanks h3 { margin:0 0 8px; font-size:20px; font-weight:800; letter-spacing:-.02em; }
.a-thanks p { margin:0; font-size:15px; line-height:1.55; font-weight:500; }

@media (max-width:640px) {
  .a-foot nav { margin-left:0; width:100%; }
  .a-foot nav a { flex:1; justify-content:center; }
  .a-main { grid-template-columns:1fr; gap:28px; padding-top:24px; padding-bottom:44px; }
  .a-card { padding:22px 18px; border-radius:20px; }
  .a-coffee { grid-template-columns:1fr; gap:18px; }
  .a-mug { width:72px; height:72px; border-radius:20px; }
  .a-tease { max-height:240px; }
}
"""


def a_band(h1, lede):
    return (f'<header class="band a-band"><div class="wrap"><div class="band-top">{BRAND}{BACK}{SIGNIN}</div>'
            f'<div class="band-hero"><h1 class="big">{h1}</h1><div><p class="lede">{lede}</p></div></div></div></header>')


A_FOOT = (f'<footer class="a-foot"><div class="wrap">{BRAND}<nav aria-label="Site">'
          f'<a href="#">{ico(MAIL, 16, 2.4)}Contact</a><a class="cup" href="#">{ico(CUP, 16, 2.4)}Buy me a coffee</a></nav>'
          f'<div class="fine"><span>{N_SERIES} series &middot; {N_FIGS} figures &middot; {Y0}-{Y1}</span>'
          '<span>Fan-made site, not affiliated with the LEGO Group.</span></div></div></footer>')

A_SIDE = f"""
<aside class="a-side">
  <h3>What helps me help you</h3>
  <ul>
    <li><b>1</b><span>The series number or name, for example <strong>No. 71052</strong> or <strong>Series 29</strong>.</span></li>
    <li><b>2</b><span>The figure's name as the site shows it, or its number on the card.</span></li>
    <li><b>3</b><span>For a wrong picture: a link to a better one helps a lot.</span></li>
  </ul>
  <p class="note">I read every message myself and reply when I can, usually within a few days. Enjoying the site? <a href="#">Buy me a coffee</a>.</p>
</aside>"""

A_F1 = (f'<div class="page"><main class="wrap"><div class="rule"><span><b>{N_SERIES} series</b></span><span>Newest first</span></div>'
        f'<div class="a-tease"><ul class="grid">{tiles()}</ul></div></main>{A_FOOT}'
        '<span class="ann" style="right:250px;bottom:118px">New footer, on every page</span></div>')

A_F2 = (f'<div class="page">{a_band("Say <em>hello.</em>", "Spotted a wrong name, a missing figure, or a series that is not here yet? Tell me, and I will fix it.")}'
        f'<main class="wrap a-main"><section class="a-card"><h2>Send a message</h2>'
        f'<p class="sub">Everything here is optional except your email and the message.</p>{form()}</section>{A_SIDE}</main>{A_FOOT}</div>')

A_F3 = (f'<div class="page">{a_band("Say <em>hello.</em>", "Spotted a wrong name, a missing figure, or a series that is not here yet? Tell me, and I will fix it.")}'
        f'<main class="wrap a-main"><section class="a-card a-sent" role="status"><div class="env">{ico(CHECK, 30, 3)}</div>'
        f'<h2>Message sent.</h2><p>Thanks, {V_NAME}. Your note is in my inbox. I will reply to <strong>{V_EMAIL}</strong>.</p>'
        f'<div class="echo"><b>You wrote</b>{V_MSG[:118]}...</div>'
        f'<div class="a-row"><a class="btn-ink" href="#">{ico(ARROW_L, 16, 2.6)}Back to the series</a>'
        f'<button class="btn-line" type="button">Write another</button></div></section>{A_SIDE}</main></div>')

A_F4 = (f'<div class="page">{a_band("Fuel the <em>hunt.</em>", "Minifig Hunt is free and has no ads. A coffee keeps it that way.")}'
        f'<main class="wrap a-main"><section class="a-card a-coffee"><div class="a-mug">{ico(CUP, 46, 2)}</div><div>'
        f'<p>Hi, I am the one collector behind this site. I built it because I wanted every Collectible Minifigures series in one place, with every figure, one at a time.</p>'
        f'<p>Hosting, the domain and the evenings spent adding each new wave cost a little. If the site helped you finish a series, a coffee is a lovely way to say thanks.</p>'
        f'<div class="facts"><span class="fact">{N_SERIES} series</span><span class="fact">{N_FIGS} figures</span><span class="fact dark">Free, no ads</span></div>'
        f'<button class="soon" type="button" disabled aria-disabled="true">{ico(CUP, 20, 2.4)}Buy me a coffee<em>Coming soon</em></button>'
        f'<p class="hint2">The payment page is not set up yet. Check back soon.</p></div></section>'
        f'<aside class="a-thanks"><h3>Not in a coffee mood?</h3><p>Telling a fellow collector about Minifig Hunt helps just as much. '
        f'Or <a href="#" style="color:inherit;font-weight:800">send me a note</a> about a figure I got wrong.</p></aside></main>{A_FOOT}</div>')

# ================================================================ B: Counter service
B_NAME = "Counter service"
B_NOTE = ("Playful and minifig-led: real figures from the catalog do the talking. Larry the Barista (No. 71004) runs the coffee page, "
          "the Film Noir Detective (No. 71045) takes your tips. A round cup button in the header opens a two-tile menu.")
B_CSS = """
.b-cupbtn { flex:none; width:44px; height:44px; border-radius:50%; border:0; background:var(--white); color:var(--ink); display:grid; place-items:center;
  cursor:pointer; position:relative; box-shadow:0 0 0 3px var(--white), 0 0 0 5px var(--ink); }
.b-cupbtn i { position:absolute; top:-3px; right:-3px; width:12px; height:12px; border-radius:50%; background:var(--lego-red); border:2px solid var(--lego-yellow); }
.b-hd { position:relative; display:flex; align-items:center; gap:12px; margin-left:auto; }
.b-menu { position:absolute; right:-6px; top:calc(100% + 16px); z-index:20; width:420px; background:var(--white); border-radius:22px; padding:16px;
  box-shadow:0 28px 60px -20px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.05); }
.b-menu::before { content:""; position:absolute; right:74px; top:-7px; width:16px; height:16px; background:var(--white); transform:rotate(45deg); border-radius:3px; }
.b-menu p { margin:2px 4px 12px; font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--grey-500); }
.b-menu .two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.b-tile { position:relative; display:block; height:168px; border-radius:16px; padding:14px; text-decoration:none; color:var(--ink); overflow:hidden; }
.b-tile.y { background:var(--lego-yellow); }
.b-tile.r { background:var(--lego-red); color:var(--white); }
.b-tile b { position:relative; z-index:1; display:block; font-size:17px; font-weight:800; letter-spacing:-.02em; line-height:1.15; max-width:9ch; }
.b-tile small { position:relative; z-index:1; display:block; font-size:12.5px; font-weight:600; margin-top:4px; opacity:.8; max-width:12ch; }
.b-tile img { position:absolute; right:-8px; bottom:-26px; height:150px; transition:transform .35s var(--ease); }
.b-tile:hover img { transform:translateY(-6px) rotate(-4deg); }

/* Contact: case file card with a brick under-edge */
.b-hero { display:grid; grid-template-columns:1fr 360px; gap:32px; align-items:end; padding:10px 0 0; }
.b-hero h1 { font-size:clamp(40px,6vw,78px); line-height:.92; letter-spacing:-.045em; font-weight:800; margin:0 0 14px; }
.b-hero h1 em { font-style:normal; color:var(--lego-red); }
.b-hero .lede { margin-bottom:44px; }
.b-stage { position:relative; height:300px; }
.b-stage img { position:absolute; bottom:-6px; height:300px; filter:drop-shadow(0 18px 18px rgba(0,0,0,.22)); }
.b-bubble { position:absolute; z-index:2; background:var(--white); border:3px solid var(--ink); border-radius:20px; padding:10px 15px; font-size:15px; font-weight:800;
  letter-spacing:-.01em; box-shadow:0 4px 0 var(--ink); white-space:nowrap; }
.b-bubble::after { content:""; position:absolute; bottom:-11px; width:16px; height:16px; background:var(--white); border-right:3px solid var(--ink); border-bottom:3px solid var(--ink); transform:rotate(45deg); }
.b-bubble.l::after { left:26px; } .b-bubble.r::after { right:30px; }
.b-body { background:var(--grey-50); padding:56px 0 72px; }
.b-file { position:relative; max-width:760px; margin:0 auto; background:var(--white); border:3px solid var(--ink); border-radius:22px; padding:40px 36px 30px;
  box-shadow:0 8px 0 var(--ink); }
/* Two studs on top, like a 2x1 plate */
.b-file::before, .b-file::after { content:""; position:absolute; top:-15px; width:46px; height:12px; border:3px solid var(--ink); border-bottom:0;
  border-radius:10px 10px 0 0; background:var(--lego-yellow); }
.b-file::before { left:60px; } .b-file::after { left:126px; }
.b-file .tab { position:absolute; top:-14px; right:30px; background:var(--ink); color:var(--lego-yellow); font-size:12px; font-weight:800; letter-spacing:.14em;
  text-transform:uppercase; padding:6px 12px; border-radius:999px; }
.b-file h2 { margin:0 0 4px; font-size:26px; font-weight:800; letter-spacing:-.03em; }
.b-file .sub { margin:0 0 24px; font-size:15px; color:var(--grey-500); font-weight:500; line-height:1.5; }
.b-file .in { border-radius:12px; }
.b-file .go { border-radius:14px; box-shadow:0 5px 0 #8E000B; transform:translateY(0); transition:transform .12s, box-shadow .12s; }
.b-file .go:active { transform:translateY(4px); box-shadow:0 1px 0 #8E000B; }

/* Sent: stamped case file */
.b-done { text-align:center; padding:48px 36px 40px; }
.b-done h2 { font-size:34px; }
.b-done p { font-size:16px; line-height:1.55; max-width:46ch; margin:0 auto 12px; font-weight:500; }
.b-stamp { display:inline-block; margin:0 0 20px; border:4px solid var(--lego-red); color:var(--lego-red); border-radius:12px; padding:8px 18px; font-size:26px;
  font-weight:900; letter-spacing:.14em; transform:rotate(-8deg); animation:stamp .6s var(--ease) both; }
.b-done .figs-row { display:flex; justify-content:center; align-items:flex-end; gap:6px; height:150px; margin:8px 0 18px; }
.b-done .figs-row img { height:150px; }
.b-done .figs-row img:nth-child(2) { height:120px; }
.b-done .again2 { display:inline-flex; align-items:center; gap:8px; height:48px; padding:0 22px; border-radius:14px; background:var(--ink); color:var(--lego-yellow);
  font-size:15px; font-weight:800; text-decoration:none; box-shadow:0 5px 0 #000; }

/* Coffee: Larry's counter */
.b-cof { display:grid; grid-template-columns:1.1fr 1fr; gap:48px; align-items:center; padding:40px 0 64px; }
.b-counter { position:relative; height:420px; background:var(--white); border:3px solid var(--ink); border-radius:28px; box-shadow:0 8px 0 var(--ink); overflow:hidden; }
.b-counter .shelf { position:absolute; left:0; right:0; bottom:0; height:96px; background:var(--lego-red); border-top:3px solid var(--ink); }
.b-counter .shelf::before { content:""; position:absolute; left:0; right:0; top:14px; height:10px;
  background:repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 28px, transparent 28px 44px); }
.b-counter img.larry { position:absolute; left:32px; bottom:60px; height:300px; z-index:1; }
.b-counter svg.mug { position:absolute; right:40px; bottom:72px; z-index:2; width:170px; height:auto; }
.b-counter .menu { position:absolute; right:30px; top:28px; background:var(--ink); color:var(--white); border-radius:14px; padding:12px 16px; font-size:13px; font-weight:700; line-height:1.6; }
.b-counter .menu b { color:var(--lego-yellow); display:block; letter-spacing:.14em; font-size:11px; text-transform:uppercase; }
.b-cof h1 { font-size:clamp(38px,5vw,64px); line-height:.94; letter-spacing:-.045em; font-weight:800; margin:0 0 18px; }
.b-cof h1 em { font-style:normal; color:var(--lego-red); }
.b-cof p { font-size:17px; line-height:1.55; margin:0 0 14px; font-weight:500; max-width:44ch; }
.b-pays { list-style:none; padding:0; margin:22px 0 28px; display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.b-pays li { background:var(--white); border:2px solid var(--ink); border-radius:14px; padding:12px; font-size:13px; font-weight:700; line-height:1.35; box-shadow:0 4px 0 var(--ink); }
.b-pays li b { display:block; font-size:22px; letter-spacing:-.03em; }
.b-soonwrap { position:relative; display:inline-block; }
.b-soon { display:inline-flex; align-items:center; gap:10px; height:60px; padding:0 30px; border-radius:16px; border:3px solid var(--ink); background:#F4E9A6;
  color:rgba(26,26,26,.55); font:inherit; font-size:17px; font-weight:800; cursor:not-allowed; box-shadow:0 5px 0 rgba(26,26,26,.35); }
.b-sticker { position:absolute; right:-34px; top:-20px; background:var(--lego-red); color:var(--white); font-size:12.5px; font-weight:900; letter-spacing:.1em;
  text-transform:uppercase; padding:8px 12px; border-radius:10px; transform:rotate(8deg); box-shadow:0 6px 14px -6px rgba(0,0,0,.5); }
.b-cof .hint2 { font-size:13.5px; font-weight:600; color:var(--grey-500); margin:18px 0 0; }

@media (max-width:640px) {
  .b-menu { left:-140px; right:-6px; width:auto; }
  .b-menu::before { right:70px; }
  .b-tile { height:150px; }
  .b-tile img { height:124px; right:-14px; }
  .b-hero { grid-template-columns:1fr; gap:0; }
  .b-hero .lede { margin-bottom:8px; }
  .b-stage { height:210px; }
  .b-stage img { height:210px; }
  .b-body { padding:36px 0 48px; }
  .b-file { padding:32px 18px 22px; border-radius:18px; }
  .b-file::before { left:28px; } .b-file::after { left:90px; }
  .b-file .tab { right:16px; }
  .b-cof { grid-template-columns:1fr; gap:28px; padding:18px 0 48px; }
  .b-counter { height:330px; }
  .b-counter img.larry { height:230px; left:14px; }
  .b-counter svg.mug { width:124px; right:18px; }
  .b-counter .menu { right:14px; top:16px; }
  .b-pays { grid-template-columns:1fr 1fr 1fr; gap:8px; }
  .b-pays li { padding:10px 8px; font-size:12px; }
  .b-pays li b { font-size:18px; }
  .b-soonwrap { display:block; }
  .b-soon { width:100%; justify-content:center; }
  .b-sticker { right:-6px; }
  .b-done .figs-row { height:120px; } .b-done .figs-row img { height:120px; } .b-done .figs-row img:nth-child(2) { height:96px; }
}
"""

# A mug built like a 2x2 brick: yellow body, studs on the lid, red handle. Original drawing.
B_MUG = """<svg class="mug" viewBox="0 0 200 190" aria-hidden="true">
  <path d="M70 34c-8 10 8 16 0 26M100 30c-8 10 8 16 0 26M130 34c-8 10 8 16 0 26" fill="none" stroke="#1A1A1A" stroke-width="6" stroke-linecap="round" opacity=".55"/>
  <rect x="44" y="70" width="40" height="18" rx="6" fill="#FDE01B" stroke="#1A1A1A" stroke-width="5"/>
  <rect x="98" y="70" width="40" height="18" rx="6" fill="#FDE01B" stroke="#1A1A1A" stroke-width="5"/>
  <path d="M146 104h14a22 22 0 0 1 0 44h-14" fill="none" stroke="#1A1A1A" stroke-width="18" stroke-linecap="round"/>
  <path d="M146 104h14a22 22 0 0 1 0 44h-14" fill="none" stroke="#DF0012" stroke-width="9" stroke-linecap="round"/>
  <rect x="28" y="84" width="126" height="98" rx="16" fill="#FDE01B" stroke="#1A1A1A" stroke-width="5"/>
  <circle cx="72" cy="128" r="6" fill="#1A1A1A"/><circle cx="110" cy="128" r="6" fill="#1A1A1A"/>
  <path d="M74 146q17 14 34 0" fill="none" stroke="#1A1A1A" stroke-width="6" stroke-linecap="round"/>
</svg>"""


def b_band(inner):
    return (f'<header class="band"><div class="wrap"><div class="band-top">{BRAND}'
            f'<div class="b-hd">{BACK}<button class="b-cupbtn" type="button" aria-label="Contact and coffee">{ico(CUP, 20, 2.4)}</button>{SIGNIN}</div></div>'
            f'{inner}</div></header>')


B_MENU = (f'<div class="b-menu" role="menu"><p>Talk to the hunter</p><div class="two">'
          f'<a class="b-tile r" href="#" role="menuitem"><b>Send a message</b><small>Tips, fixes, ideas</small>{fig("detective")}</a>'
          f'<a class="b-tile y" href="#" role="menuitem"><b>Buy me a coffee</b><small>Keep the site free</small>{fig("barista")}</a></div></div>')

B_F1 = (f'<div class="page"><header class="band"><div class="wrap"><div class="band-top">{BRAND}{CONTROLS}'
        f'<div class="b-hd" style="margin-left:0"><button class="b-cupbtn" type="button" aria-expanded="true" aria-label="Contact and coffee">{ico(CUP, 20, 2.4)}<i></i></button>{B_MENU}{SIGNIN}</div></div>'
        f'<div class="band-hero" style="padding-bottom:230px"><h1 class="big">Every series.<br>Every <em>figure.</em></h1><div><p class="lede">'
        'Browse every Collectible Minifigures series, or find one by the name of a single figure.</p>'
        f'<div class="stats"><div><strong>{N_SERIES}</strong>Series</div><div><strong>{N_FIGS}</strong>Figures</div>'
        f'<div><strong>{Y0}<span>-{Y1}</span></strong>Years</div></div></div></div></div></header>'
        '<span class="ann" style="left:24px;bottom:24px">Cup button next to Sign in, signed in or not</span></div>')

B_HERO_C = (f'<div class="b-hero"><div><p class="eyebrow">Contact</p><h1>Got a <em>lead?</em></h1>'
            '<p class="lede">A wrong name, a missing figure, a series that just landed in the shops. Drop it here and I will follow it up.</p></div>'
            f'<div class="b-stage"><span class="b-bubble l" style="left:150px;top:16px">I am all ears.</span>{fig("detective")}</div></div>')

B_HERO_C = B_HERO_C.replace('<img class=', '<img style="left:40px" class=')
B_HERO_D = B_HERO_C.replace("I am all ears.", "Case closed!")

B_F2 = (f'<div class="page">{b_band(B_HERO_C)}'
        f'<div class="b-body"><div class="wrap"><section class="b-file"><span class="tab">Case file</span>'
        f'<h2>Send a message</h2><p class="sub">Leave your email so I can write back. Your name is up to you.</p>{form()}</section></div></div></div>')

B_F3 = (f'<div class="page">{b_band(B_HERO_D)}'
        f'<div class="b-body"><div class="wrap"><section class="b-file b-done" role="status"><span class="tab">Case file</span>'
        f'<span class="b-stamp">Received</span><h2>Thanks, {V_NAME}!</h2>'
        f'<p>Your message is on my desk. I read every one and will reply to <strong>{V_EMAIL}</strong>.</p>'
        f'<div class="figs-row">{fig("librarian")}{fig("waiter")}{fig("cake")}</div>'
        f'<a class="again2" href="#">Back to the hunt {ico(ARROW_R, 16, 2.6)}</a></section></div></div></div>')

B_F4 = (f'<div class="page">{b_band("")}'
        f'<div class="b-body" style="padding-top:0"><div class="wrap"><div class="b-cof">'
        f'<div class="b-counter"><div class="menu"><b>Today</b>Flat white &middot; 1 brick<br>Espresso &middot; 1 stud</div>'
        f'{fig("barista", "larry")}{B_MUG}<div class="shelf"></div>'
        f'<span class="b-bubble r" style="left:120px;top:40px">What can I get you?</span></div>'
        f'<div><p class="eyebrow">Buy me a coffee</p><h1>Keep the hunt <em>brewing.</em></h1>'
        f'<p>Minifig Hunt is free and run by one collector. No ads, no paywall, just every figure from every series.</p>'
        f'<p>A coffee pays for the hosting and the late nights adding each new wave.</p>'
        f'<ul class="b-pays"><li><b>{N_SERIES}</b>series to browse</li><li><b>{N_FIGS}</b>figures, one by one</li><li><b>0</b>ads, ever</li></ul>'
        f'<div class="b-soonwrap"><button class="b-soon" type="button" disabled aria-disabled="true">{ico(CUP, 22, 2.4)}Buy me a coffee</button>'
        f'<span class="b-sticker">Coming soon</span></div>'
        f'<p class="hint2">Larry is still setting up the till. The button goes live when the payment page is ready.</p></div>'
        f'</div></div></div></div>')

# ================================================================ C: The collector's story
C_NAME = "The collector's story"
C_NOTE = ("Editorial: one About page tells who runs the site and why, in an ink column beside two chapters, "
          "Support (the coffee) and Write to me (the form). Reached from an About link in the header and a footer line.")
C_CSS = """
.c-about { flex:none; display:inline-flex; align-items:center; height:44px; padding:0 4px; font-size:15px; font-weight:800; color:var(--ink);
  text-decoration:none; border-bottom:3px solid var(--ink); border-radius:0; }
.band-top .c-about { margin-left:4px; height:auto; padding:4px 2px; }
.c-foot { border-top:2px solid var(--ink); }
.c-foot .wrap { display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; padding-top:22px; padding-bottom:26px; font-size:14px; font-weight:600; color:var(--grey-500); }
.c-foot nav { display:flex; gap:22px; }
.c-foot nav a { color:var(--ink); font-weight:800; text-decoration:none; }
.c-foot nav a:hover { text-decoration:underline; text-underline-offset:4px; }

.c-split { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,7fr); min-height:900px; }
.c-ink { background:var(--ink); color:var(--white); padding:44px 48px 48px; position:relative; overflow:hidden; }
.c-ink .brand { color:var(--white); margin-bottom:72px; }
.c-ink .brand small { opacity:.6; }
.c-ink .eyebrow { color:var(--lego-yellow); opacity:1; }
.c-ink h1 { font-size:clamp(40px,4.6vw,62px); line-height:.95; letter-spacing:-.045em; font-weight:800; margin:0 0 28px; }
.c-ink h1 em { font-style:normal; color:var(--lego-yellow); }
.c-ink p { font-size:16.5px; line-height:1.65; color:#D6D6D0; margin:0 0 16px; max-width:40ch; }
.c-ink p strong { color:var(--white); }
.c-ink .sig { font-size:15px; font-weight:800; color:var(--lego-yellow); margin-top:24px; }
.c-nums { display:grid; grid-template-columns:repeat(3,auto); justify-content:start; gap:28px; margin-top:40px; padding-top:24px; border-top:1px solid rgba(255,255,255,.15); }
.c-nums div { font-size:11.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#A3A39D; }
.c-nums strong { display:block; font-size:30px; letter-spacing:-.03em; color:var(--white); text-transform:none; font-variant-numeric:tabular-nums; }
.c-nums strong span { opacity:.45; }
.c-figs { position:absolute; right:-10px; bottom:-14px; display:flex; align-items:flex-end; opacity:.95; }
.c-figs img { height:150px; margin-left:-30px; }

.c-right { padding:28px 56px 56px; }
.c-top { display:flex; justify-content:flex-end; align-items:center; gap:14px; margin-bottom:40px; }
.c-ch { padding:0 0 44px; }
.c-ch + .c-ch { border-top:2px solid var(--ink); padding-top:36px; }
.c-ch .no { display:flex; align-items:baseline; gap:14px; margin:0 0 14px; }
.c-ch .no span { font-size:13px; font-weight:800; letter-spacing:.16em; color:var(--lego-red); }
.c-ch h2 { margin:0; font-size:34px; font-weight:800; letter-spacing:-.035em; line-height:1.05; }
.c-ch > p { font-size:16.5px; line-height:1.6; margin:0 0 22px; max-width:56ch; font-weight:500; color:#3A3A37; }
.c-coffee { display:grid; grid-template-columns:1fr auto; gap:20px; align-items:center; background:var(--lego-yellow); border-radius:22px; padding:24px 26px; position:relative; overflow:hidden; }
.c-coffee::after { content:""; position:absolute; right:-60px; top:-60px; width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,.25); }
.c-coffee b { display:block; font-size:19px; font-weight:800; letter-spacing:-.02em; margin-bottom:4px; }
.c-coffee small { font-size:14px; font-weight:600; line-height:1.45; display:block; opacity:.8; max-width:36ch; }
.c-coffee .soon { position:relative; z-index:1; background:rgba(255,255,255,.55); border-color:rgba(26,26,26,.25); color:rgba(26,26,26,.55); }
.c-ch .cf .in { background:var(--white); border-color:var(--grey-300); border-radius:10px; }
.c-ch .cf .in:focus { border-color:var(--ink); }
.c-ch .go { background:var(--ink); color:var(--lego-yellow); border-radius:10px; }
.c-sent { display:grid; grid-template-columns:auto 1fr; gap:22px; align-items:start; background:var(--grey-50); border-left:6px solid var(--lego-red); border-radius:0 18px 18px 0; padding:26px 28px; }
.c-sent .tick { width:52px; height:52px; border-radius:50%; background:var(--ink); color:var(--lego-yellow); display:grid; place-items:center; animation:stamp .6s var(--ease) both; }
.c-sent h3 { margin:2px 0 8px; font-size:24px; font-weight:800; letter-spacing:-.025em; }
.c-sent p { margin:0 0 10px; font-size:15.5px; line-height:1.55; font-weight:500; }
.c-sent blockquote { margin:14px 0 18px; padding:0 0 0 16px; border-left:3px solid var(--grey-300); font-size:15px; line-height:1.55; color:var(--grey-500); font-style:italic; }
.c-sent .linkish { font-size:15px; }
.c-live { position:relative; z-index:1; display:inline-flex; align-items:center; gap:10px; height:56px; padding:0 24px; border-radius:999px; border:0;
  background:var(--ink); color:var(--lego-yellow); font:inherit; font-size:16px; font-weight:800; cursor:pointer; transition:transform .15s; }
.c-live:hover { transform:translateY(-2px); }
.c-states { padding:36px 0 8px; }
.c-pair { display:grid; grid-template-columns:1fr 1fr; gap:40px; }
.c-pair figure { margin:0; }
.c-pair figcaption { font-size:12px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--grey-500); margin:0 0 16px; }
.c-pair .c-coffee { grid-template-columns:1fr; }
.c-pair .c-coffee > button { justify-self:start; }

@media (max-width:640px) {
  .c-split { grid-template-columns:1fr; min-height:0; }
  .c-ink { padding:22px 18px 170px; }
  .c-ink .brand { margin-bottom:36px; }
  .c-nums { gap:18px; }
  .c-nums strong { font-size:24px; }
  .c-figs img { height:120px; }
  .c-right { padding:0 18px 40px; }
  .c-top { display:none; }
  .c-ch:first-child { padding-top:32px; }
  .c-ch h2 { font-size:28px; }
  .c-coffee { grid-template-columns:1fr; }
  .c-pair { grid-template-columns:1fr; gap:28px; }
  .c-states { padding:24px 0 0; }
  .c-sent { grid-template-columns:1fr; padding:22px 18px; }
  .c-foot nav { gap:16px; flex-wrap:wrap; }
}
"""

C_STORY = f"""
<section class="c-ink">
  {BRAND}
  <p class="eyebrow">About</p>
  <h1>One collector.<br><em>Every figure.</em></h1>
  <p>Minifig Hunt started as a list I kept for myself: which series came out when, which figure was in which bag, which ones I still needed.</p>
  <p>It grew into this site, <strong>every Collectible Minifigures series since {Y0}</strong>, each figure shown on its own, with a way to mark what you own and what you are still hunting.</p>
  <p>It is free, it has no ads, and it is built and kept up to date by one person in the evenings.</p>
  <p class="sig">Happy hunting.</p>
  <div class="c-nums"><div><strong>{N_SERIES}</strong>Series</div><div><strong>{N_FIGS}</strong>Figures</div><div><strong>{Y0}<span>-{Y1}</span></strong>Years</div></div>
  <div class="c-figs" aria-hidden="true">{fig("boba")}{fig("barista")}{fig("librarian")}</div>
</section>"""

SOON_TXT = "The payment page is being set up. The button goes live as soon as it is ready."
LIVE_TXT = "Opens a secure payment page in a new tab. Any amount, no account needed."
SOON_BTN = f'<button class="soon" type="button" disabled aria-disabled="true">{ico(CUP, 20, 2.4)}Coming soon</button>'
C_SUPPORT = f"""
<section class="c-ch"><div class="no"><span>01</span><h2>Support the site</h2></div>
  <p>Hosting, the domain and the hours spent adding each new wave are paid out of my own pocket. If Minifig Hunt saved you a trip or a duplicate, a coffee helps keep it free for everyone.</p>
  <div class="c-coffee"><div><b>Buy me a coffee</b><small>{SOON_TXT}</small></div>
    {SOON_BTN}</div>
</section>"""


def c_page(second, top_extra=True):
    back = BACK.replace('class="back"', 'class="back" style="margin-left:0;background:var(--grey-50)"')
    top = f'<div class="c-top">{back}{SIGNIN}</div>' if top_extra else ""
    return (f'<div class="page"><div class="c-split">{C_STORY}<div class="c-right">{top}{C_SUPPORT}{second}</div></div>'
            f'<footer class="c-foot"><div class="wrap"><span>Minifig Hunt &middot; fan-made, not affiliated with the LEGO Group</span>'
            '<nav><a href="#">About</a><a href="#">Contact</a><a href="#">Buy me a coffee</a></nav></div></footer></div>')


C_WRITE = f"""
<section class="c-ch"><div class="no"><span>02</span><h2>Write to me</h2></div>
  <p>Found a wrong name or picture, or missing a series? Tell me. I read everything and answer by email.</p>
  {form(send_label="Send")}
</section>"""

C_DONE = f"""
<section class="c-ch"><div class="no"><span>02</span><h2>Write to me</h2></div>
  <div class="c-sent" role="status"><span class="tick">{ico(CHECK, 26, 3)}</span><div>
    <h3>Thanks, {V_NAME}. Message received.</h3>
    <p>I will answer at <strong>{V_EMAIL}</strong>, usually within a few days.</p>
    <blockquote>{V_MSG[:96]}...</blockquote>
    <button class="linkish" type="button">Send another message</button></div></div>
</section>"""

C_F1 = (f'<div class="page"><header class="band"><div class="wrap"><div class="band-top">{BRAND}{CONTROLS}'
        f'<a class="c-about" href="#">About</a>{SIGNIN}</div>'
        f'<div class="band-hero" style="padding-bottom:40px"><h1 class="big">Every series.<br>Every <em>figure.</em></h1><div><p class="lede">'
        'Browse every Collectible Minifigures series, or find one by the name of a single figure.</p></div></div></div></header>'
        f'<main class="wrap"><div class="rule"><span><b>{N_SERIES} series</b></span><span>Newest first</span></div></main>'
        '<footer class="c-foot" style="margin-top:20px"><div class="wrap"><span>Minifig Hunt &middot; fan-made, not affiliated with the LEGO Group</span>'
        '<nav><a href="#">About</a><a href="#">Contact</a><a href="#">Buy me a coffee</a></nav></div></footer>'
        '<span class="ann c-ann1" style="right:150px;top:72px">About link in the header</span>'
        '<span class="ann" style="right:30px;bottom:66px">Footer line on every page</span></div>')

C_F2 = c_page(C_WRITE)
C_F3 = c_page(C_DONE)
# Frame 04: the coffee chapter lives on the About page (frame 02); here it is shown close up, now and once the link exists
C_LIVE = f'<button class="c-live" type="button">{ico(CUP, 20, 2.4)}Buy me a coffee{ico(ARROW_R, 16, 2.6)}</button>'
C_F4 = (f'<div class="page c-states"><div class="wrap"><div class="c-pair">'
        f'<figure><figcaption>Now: no payment link yet</figcaption>{C_SUPPORT}</figure>'
        f'<figure><figcaption>Later: once the link exists (not built in V2-15)</figcaption>'
        f'{C_SUPPORT.replace(SOON_BTN, C_LIVE).replace(SOON_TXT, LIVE_TXT)}</figure>'
        f'</div></div></div>')

VARIANTS = {
    "a": (A_NAME, A_NOTE, A_CSS, A_F1, A_F2, A_F3, A_F4),
    "b": (B_NAME, B_NOTE, B_CSS, B_F1, B_F2, B_F3, B_F4),
    "c": (C_NAME, C_NOTE, C_CSS, C_F1, C_F2, C_F3, C_F4),
}

if __name__ == "__main__":
    for key, (name, note, css, f1, f2, f3, f4) in VARIANTS.items():
        html = PAGE.format(key=key, key_up=key.upper(), name=name, note=note, base=BASE_CSS.strip(), css=css.strip(),
                           f1=f1, f2=f2, f3=f3, f4=f4)
        (HERE / f"{key}.html").write_text(html, encoding="utf-8")
        print("wrote", HERE / f"{key}.html")
