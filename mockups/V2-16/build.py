"""Generate the three V2-16 branded auth email mockups.

Outputs (next to this file):
  a.html  b.html  c.html                 Magic link template (existing users)
  a-confirm.html  b-confirm.html  ...     Confirm signup template (new users, V2-09)
  magic.txt  confirm.txt                  Plain-text alternative (same copy for all directions)
  preview/<name>.html                     Render copies for screenshots only:
                                          sample values for the Supabase variables,
                                          minifighunt.com images pointed at app/public,
                                          and preview/<name>-dark.html with the dark rules forced on.

The .html files are the real templates: Supabase Go-template variables
({{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }}) stay literal, and every image is an
absolute https URL on minifighunt.com.
SOURCE: variables listed at https://supabase.com/docs/guides/auth/auth-email-templates

Email HTML rules applied: table layout, inline CSS, 600 px max width, web-safe font stack,
bulletproof (table cell) buttons, alt text on every image, a hidden preheader, and a
<style> block used only for progressive extras (phone padding, dark mode in Apple Mail / iOS).

Usage: python mockups/V2-16/build.py
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
PREVIEW = HERE / "preview"

SITE = "https://minifighunt.com"
# SOURCE: app/public/apple-touch-icon.png (180x180 PNG of the V2-12 site icon; SVG is not shown by Gmail/Outlook)
MARK = f"{SITE}/apple-touch-icon.png"
# SOURCE: app/public/cards/*.png (600x800 series cards shown on the home grid), newest three with a card
CARDS = [("71045", "Series 25"), ("71039", "Marvel Series 2"), ("71037", "Series 24")]

# SOURCE: app/src/index.css :root (--lego-red, --lego-yellow, --ink, --grey-*)
RED, YELLOW, INK, WHITE = "#DF0012", "#FDE01B", "#1A1A1A", "#FFFFFF"
G50, G100, G300, G500 = "#F6F6F4", "#EDEDEA", "#C9C9C4", "#6E6E69"
# SOURCE: app/src/index.css body font-family, plus Apple and Roboto fallbacks for mail clients
FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,'Helvetica Neue',Arial,sans-serif"
MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace"

# SOURCE: https://supabase.com/docs/guides/auth/auth-email-passwordless
# ("By default, a user can only request an OTP once every 60 seconds and they expire after 1 hour.")
EXPIRY = "1 hour"

# Sample values used only in preview/ renders
SAMPLE = {
    # SOURCE: shape of the default Supabase link (project ref from app/public/_headers); it is a supabase.co URL
    "{{ .ConfirmationURL }}": "https://iagnfgedasxkqqjbsoeg.supabase.co/auth/v1/verify?token=pkce_8f3c2a&type=magiclink&redirect_to=https://minifighunt.com/",
    "{{ .Token }}": "418207",
    "{{ .Email }}": "collector@example.com",
}

COPY = {
    "magic": {
        "subject": "Your Minifig Hunt sign-in link",
        "pre": "Tap to sign in, or use the 6-digit code. Expires in 1 hour.",
        "kicker": "Sign-in link",
        "h1": "Back on the hunt?",
        "h1_em": "hunt",
        "lead": "Tap the button to sign in to Minifig Hunt. The link works once and expires in 1 hour.",
        "cta": "Sign in to Minifig Hunt",
        "why": "someone asked to sign in to minifighunt.com with",
        "ticket": "Sign-in pass",
    },
    "confirm": {
        "subject": "Confirm your email for Minifig Hunt",
        "pre": "One tap to confirm your address and start collecting. Expires in 1 hour.",
        "kicker": "Welcome",
        "h1": "Welcome to the hunt.",
        "h1_em": "hunt",
        "lead": "Confirm this address to finish your Minifig Hunt account. The link works once and expires in 1 hour.",
        "cta": "Confirm my email",
        "why": "someone created a Minifig Hunt account with",
        "ticket": "New collector pass",
    },
}


def em(c, color):
    """Colour the h1 keyword like the site hero (h1.big em is red)."""
    return c["h1"].replace(c["h1_em"], f'<span class="red" style="color:{color};">{c["h1_em"]}</span>', 1)


def head(c, extra_css=""):
    return f"""<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{c["subject"]}</title>
<style>
  body {{ margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; }}
  a {{ text-decoration:none; }}
  @media (max-width:480px) {{
    .px {{ padding-left:22px !important; padding-right:22px !important; }}
    .h1 {{ font-size:30px !important; }}
    .code {{ font-size:30px !important; letter-spacing:8px !important; }}
    .hide-s {{ display:none !important; }}
  }}
{extra_css}
</style>
</head>"""


def preheader(c):
    # Hidden inbox preview line; the zero-width padding stops clients pulling body text after it.
    return (f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">'
            f'{c["pre"]}' + "&#8202;&zwnj;" * 40 + "</div>")


def button(label, bg, fg, radius=999, border=None):
    b = f"border:2px solid {border};" if border else ""
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr><td class="btn" bgcolor="{bg}" style="border-radius:{radius}px;background:{bg};{b}">
    <a href="{{{{ .ConfirmationURL }}}}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:{FONT};font-size:16px;font-weight:800;line-height:20px;color:{fg};text-decoration:none;border-radius:{radius}px;">{label}&nbsp;&rarr;</a>
  </td></tr>
</table>"""


def fallback_link(color):
    return (f'<p class="t2" style="margin:0;font-family:{FONT};font-size:12.5px;line-height:19px;color:{color};">'
            f'Button not working? Paste this link into your browser:<br>'
            f'<a class="t2" href="{{{{ .ConfirmationURL }}}}" style="color:{color};text-decoration:underline;word-break:break-all;">{{{{ .ConfirmationURL }}}}</a></p>')


def footer_text(c):
    return (f'You got this email because {c["why"]} <b>{{{{ .Email }}}}</b>. '
            f'If that was not you, ignore it: nothing happens without the link or the code.')


# ---------------------------------------------------------------- A: receipt
def direction_a(c):
    """A - Receipt: quiet white sheet, brand row, ink rules, the code as a receipt line."""
    css = f"""  @media (prefers-color-scheme: dark) {{
    body, .bg {{ background:#121211 !important; }}
    .red {{ color:#FF5A66 !important; }}
    .sheet {{ background:#1E1E1C !important; border-color:#33332F !important; }}
    .t1 {{ color:#F4F4F1 !important; }}
    .t2 {{ color:#B4B4AD !important; }}
    .rule {{ border-color:#F4F4F1 !important; }}
    .dash {{ border-color:#45453F !important; }}
    .codebox {{ background:#2A2A27 !important; }}
  }}"""
    return f"""{head(c, css)}
<body style="margin:0;padding:0;background:{G50};">
{preheader(c)}
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{G50}" style="background:{G50};">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" class="sheet" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{WHITE}" style="max-width:600px;background:{WHITE};border:1px solid {G100};border-radius:16px;">
    <tr><td class="px" style="padding:30px 44px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:12px;vertical-align:middle;"><img src="{MARK}" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px;"></td>
        <td style="vertical-align:middle;font-family:{FONT};">
          <div class="t1" style="font-size:19px;font-weight:800;letter-spacing:-0.3px;line-height:20px;color:{INK};">Minifig Hunt</div>
          <div class="t2" style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;line-height:14px;color:{G500};">Collectible Minifigures</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td class="px" style="padding:22px 44px 0;"><div class="rule" style="border-top:2px solid {INK};font-size:0;line-height:0;">&nbsp;</div></td></tr>
    <tr><td class="px" style="padding:28px 44px 0;font-family:{FONT};">
      <div class="red" style="font-size:11.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:{RED};">{c["kicker"]}</div>
      <h1 class="h1 t1" style="margin:8px 0 12px;font-size:36px;line-height:38px;font-weight:800;letter-spacing:-1.2px;color:{INK};">{em(c, RED)}</h1>
      <p class="t2" style="margin:0 0 26px;font-size:16px;line-height:24px;color:#4A4A46;">{c["lead"]}</p>
      {button(c["cta"], RED, WHITE)}
    </td></tr>
    <tr><td class="px" style="padding:32px 44px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:{FONT};">
        <tr><td colspan="2" class="dash" style="border-top:2px dashed {G300};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td class="t2" style="padding:14px 0 6px;font-size:13px;font-weight:700;color:{G500};">Or type this code</td>
          <td class="t2" align="right" style="padding:14px 0 6px;font-size:13px;font-weight:600;color:{G500};">valid {EXPIRY}</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0 14px;">
          <div class="codebox" style="background:{G50};border-radius:12px;padding:16px 0;text-align:center;">
            <span class="code t1" style="font-family:{MONO};font-size:36px;font-weight:700;letter-spacing:12px;color:{INK};">{{{{ .Token }}}}</span>
          </div>
        </td></tr>
        <tr><td colspan="2" class="dash" style="border-top:2px dashed {G300};font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td></tr>
    <tr><td class="px t2" style="padding:20px 44px 0;">{fallback_link(G500)}</td></tr>
    <tr><td class="px" style="padding:24px 44px 32px;font-family:{FONT};">
      <p class="t2" style="margin:0;font-size:12.5px;line-height:19px;color:{G500};">{footer_text(c)}</p>
      <p class="t2" style="margin:12px 0 0;font-size:12.5px;line-height:19px;color:{G500};"><a href="{SITE}" style="color:{INK};font-weight:700;" class="t1">minifighunt.com</a> &middot; every LEGO&reg; Collectible Minifigures series, one figure at a time</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
"""


# ---------------------------------------------------------------- B: yellow band
def direction_b(c):
    """B - Yellow band: the site header band, big red-accent headline and three real series cards."""
    css = f"""  @media (prefers-color-scheme: dark) {{
    body, .bg {{ background:#121211 !important; }}
    .body {{ background:#1E1E1C !important; }}
    .t1 {{ color:#F4F4F1 !important; }}
    .t2 {{ color:#B4B4AD !important; }}
    .codebox {{ background:#2A2A27 !important; border-color:#45453F !important; }}
    .foot {{ background:#171716 !important; }}
  }}
  @media (max-width:480px) {{ .card {{ width:30% !important; }} .card img {{ width:100% !important; height:auto !important; }} }}"""
    cards = "".join(
        f'<td class="card" width="33%" align="center" style="padding:0 6px;">'
        f'<img src="{SITE}/cards/{cid}.png" width="160" height="213" alt="LEGO Minifigures {name}" '
        f'style="display:block;width:160px;max-width:100%;height:auto;border:0;border-radius:12px;"></td>'
        for cid, name in CARDS)
    return f"""{head(c, css)}
<body style="margin:0;padding:0;background:{G100};">
{preheader(c)}
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{G100}" style="background:{G100};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;border-radius:20px;overflow:hidden;">
    <tr><td bgcolor="{YELLOW}" class="px" style="background:{YELLOW};padding:26px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;width:48px;"><img src="{MARK}" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;"></td>
        <td style="vertical-align:middle;font-family:{FONT};color:{INK};">
          <div style="font-size:21px;font-weight:800;letter-spacing:-0.4px;line-height:22px;">Minifig Hunt</div>
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;line-height:14px;color:#4A4410;">Collectible Minifigures</div>
        </td>
        <td class="hide-s" align="right" style="vertical-align:middle;font-family:{FONT};">
          <span style="display:inline-block;background:{INK};color:{YELLOW};font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:6px 12px;border-radius:999px;">{c["kicker"]}</span>
        </td>
      </tr></table>
      <h1 class="h1" style="margin:30px 0 10px;font-family:{FONT};font-size:44px;line-height:44px;font-weight:800;letter-spacing:-1.8px;color:{INK};">{em(c, RED)}</h1>
      <p style="margin:0 0 24px;font-family:{FONT};font-size:16px;line-height:24px;font-weight:500;color:{INK};max-width:440px;">{c["lead"]}</p>
      <div style="padding-bottom:28px;">{button(c["cta"], RED, WHITE)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>{cards}</tr></table>
    </td></tr>
    <tr><td bgcolor="{INK}" style="background:{INK};height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td class="px body" bgcolor="{WHITE}" style="background:{WHITE};padding:30px 40px 6px;font-family:{FONT};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="t1" style="font-size:15px;font-weight:800;color:{INK};padding-bottom:10px;">Signing in on another device?</td>
      </tr><tr>
        <td class="t2" style="font-size:14px;line-height:21px;color:#4A4A46;padding-bottom:14px;">Type this 6-digit code on the sign-in screen instead. It expires in {EXPIRY}.</td>
      </tr><tr>
        <td class="codebox" align="center" style="background:{G50};border:2px solid {INK};border-radius:14px;padding:18px 0;">
          <span class="code t1" style="font-family:{MONO};font-size:38px;font-weight:700;letter-spacing:14px;color:{INK};">{{{{ .Token }}}}</span>
        </td>
      </tr></table>
    </td></tr>
    <tr><td class="px body" bgcolor="{WHITE}" style="background:{WHITE};padding:22px 40px 30px;">{fallback_link(G500)}</td></tr>
    <tr><td class="px foot" bgcolor="{G50}" style="background:{G50};padding:22px 40px 26px;font-family:{FONT};">
      <p class="t2" style="margin:0;font-size:12.5px;line-height:19px;color:{G500};">{footer_text(c)}</p>
      <p class="t2" style="margin:10px 0 0;font-size:12.5px;line-height:19px;color:{G500};"><a class="t1" href="{SITE}" style="color:{INK};font-weight:800;">minifighunt.com</a> &middot; a fan site, not made by the LEGO Group</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
"""


# ---------------------------------------------------------------- C: collector ticket
def direction_c(c):
    """C - Collector ticket: ink canvas, a pass with a yellow stub, perforation and the code as the ticket number."""
    css = """  @media (prefers-color-scheme: dark) {
    body, .bg { background:#0B0B0A !important; }
  }
  @media (max-width:480px) { .stub { display:none !important; } .pass { border-radius:18px !important; } }"""
    return f"""{head(c, css)}
<body style="margin:0;padding:0;background:{INK};">
{preheader(c)}
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{INK}" style="background:{INK};">
<tr><td align="center" style="padding:36px 12px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td align="center" style="padding-bottom:22px;font-family:{FONT};">
      <img src="{MARK}" width="56" height="56" alt="Minifig Hunt" style="display:block;margin:0 auto 12px;border:0;border-radius:14px;">
      <div style="font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:{YELLOW};">Minifig Hunt</div>
    </td></tr>
    <tr><td>
      <!-- the pass: yellow stub | perforation | white body -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
        <tr>
          <td class="stub" width="92" bgcolor="{YELLOW}" style="width:92px;background:{YELLOW};border-radius:18px 0 0 18px;vertical-align:middle;text-align:center;font-family:{FONT};">
            <div style="width:58px;height:58px;margin:0 auto;border-radius:50%;background:{RED};border:3px solid {WHITE};line-height:58px;color:{WHITE};font-size:20px;font-weight:800;">6</div>
            <div style="margin-top:8px;font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:{INK};">digits</div>
          </td>
          <td class="stub" width="2" bgcolor="{WHITE}" style="width:2px;background:{WHITE};border-left:3px dotted {INK};font-size:0;">&nbsp;</td>
          <td bgcolor="{WHITE}" class="px pass" style="background:{WHITE};border-radius:0 18px 18px 0;padding:30px 36px 30px;font-family:{FONT};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:{RED};">{c["ticket"]}</td>
              <td align="right" style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:{G500};">Admit one &middot; {EXPIRY}</td>
            </tr></table>
            <h1 class="h1" style="margin:14px 0 10px;font-size:34px;line-height:36px;font-weight:800;letter-spacing:-1.2px;color:{INK};">{em(c, RED)}</h1>
            <p style="margin:0 0 22px;font-size:15.5px;line-height:23px;color:#4A4A46;">{c["lead"]}</p>
            {button(c["cta"], INK, YELLOW)}
            <div style="margin:26px 0 0;border-top:2px dashed {G300};font-size:0;line-height:0;">&nbsp;</div>
            <div style="margin:16px 0 6px;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:{G500};">Pass code</div>
            <div class="code" style="font-family:{MONO};font-size:40px;line-height:44px;font-weight:700;letter-spacing:14px;color:{INK};">{{{{ .Token }}}}</div>
            <div style="margin-top:6px;font-size:13px;line-height:19px;color:{G500};">Type it on the sign-in screen if the button opens the wrong device.</div>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 8px 0;">{fallback_link("#A3A39C")}</td></tr>
    <tr><td style="padding:22px 8px 0;font-family:{FONT};">
      <div style="border-top:1px solid #33332F;font-size:0;line-height:0;">&nbsp;</div>
      <p style="margin:16px 0 0;font-size:12.5px;line-height:19px;color:#A3A39C;">{footer_text(c)}</p>
      <p style="margin:10px 0 0;font-size:12.5px;line-height:19px;color:#A3A39C;"><a href="{SITE}" style="color:{YELLOW};font-weight:800;">minifighunt.com</a> &middot; collect every series, one figure at a time</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
"""


def plain(c):
    """Plain-text alternative, same copy for all three directions."""
    return f"""MINIFIG HUNT
{c["h1"]}

{c["lead"]}

{c["cta"]}:
{{{{ .ConfirmationURL }}}}

Signing in on another device? Type this 6-digit code on the sign-in screen:

    {{{{ .Token }}}}

The code expires in {EXPIRY}.

--
You got this email because {c["why"]} {{{{ .Email }}}}.
If that was not you, ignore it: nothing happens without the link or the code.
https://minifighunt.com
"""


def to_preview(html, dark=False):
    """Swap template variables for samples and live image URLs for local files (render only)."""
    html = html.replace(f'src="{SITE}/', 'src="../../../app/public/')
    for k, v in SAMPLE.items():
        html = html.replace(k, v)
    if dark:
        # force the dark rules on, as Apple Mail / iOS Mail would with the system in dark mode
        html = html.replace("@media (prefers-color-scheme: dark)", "@media all")
    return html


def main():
    PREVIEW.mkdir(exist_ok=True)
    for key, fn in (("a", direction_a), ("b", direction_b), ("c", direction_c)):
        for kind, suffix in (("magic", ""), ("confirm", "-confirm")):
            c = COPY[kind]
            name = f"{key}{suffix}"
            html = fn(c)
            (HERE / f"{name}.html").write_text(html, encoding="utf-8")
            (PREVIEW / f"{name}.html").write_text(to_preview(html), encoding="utf-8")
            (PREVIEW / f"{name}-dark.html").write_text(to_preview(html, dark=True), encoding="utf-8")
            if key == "a":
                (HERE / f"{kind}.txt").write_text(plain(c), encoding="utf-8")
            print("wrote", name)


if __name__ == "__main__":
    main()
