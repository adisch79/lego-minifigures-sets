"""Font trial for the V1-07 badge: same head with candidate fonts, beside the owner's example.

Usage: python docs/spike/V1-07-badge-fonts.py <owner screenshot path>
Output: docs/spike/V1-07-badge-fonts.png
"""
import base64, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs/spike/V1-07-badge-fonts.png"
# SOURCE: same Chrome path as docs/spike/V0-06-cards.py
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
# SOURCE: OWNER-SUPPLIED badge screenshot, 2026-11-02 (sampled pixels).
RED, HEAD, HEAD_DARK, FRAME, NAVY, BG = "#D80008", "#F8C800", "#F0B800", "#38B8E8", "#002050", "#70b0d8"

# name, CSS font family, horizontal squeeze
FONTS = [
    ("Arial Black .78", "'Arial Black'", 0.78),
    ("Arial Black .88", "'Arial Black'", 0.88),
    ("Segoe UI Black .85", "'Segoe UI Black'", 0.85),
    ("Franklin Heavy", "'Franklin Gothic Heavy'", 0.95),
    ("Impact bolded", "Impact", 1.0),
    ("Bahnschrift Cond", "'Bahnschrift SemiBold Condensed'", 1.0),
    ("Rockwell XBold .8", "'Rockwell Extra Bold'", 0.8),
    ("Tahoma Bold .85", "Tahoma", 0.85),
]


def text(x, y, size, value, family, squeeze, fill, stroke=0, skew=0):
    return (f'<text transform="translate({x} {y}) skewX({skew}) scale({squeeze} 1)" text-anchor="middle" '
            f'style="font-family:{family};font-weight:900;font-size:{size}px;fill:{fill};stroke:{fill};stroke-width:{stroke}px;paint-order:stroke">{value}</text>')


def badge(name, family, squeeze):
    return f"""<figure><svg width="300" height="272" viewBox="0 0 270 245">
<circle cx="58" cy="60" r="53" fill="{FRAME}" stroke="#fff" stroke-width="6"/>
{text(58, 50, 24, "SERIES", family, squeeze, NAVY)}
{text(58, 94, 48, "28", family, squeeze, NAVY, 1)}
<g transform="rotate(12 172 130)">
<rect x="134" y="26" width="78" height="38" rx="4" fill="{HEAD_DARK}"/>
<rect x="120" y="196" width="104" height="32" rx="4" fill="{HEAD_DARK}"/>
<rect x="94" y="55" width="156" height="150" rx="34" fill="{HEAD}"/>
<rect x="103" y="110" width="24" height="24" rx="7" fill="#fff" stroke="{RED}" stroke-width="4"/>
<path d="M108 122 l6 7 l20 -19" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
{text(182, 152, 96, "12", family, squeeze, RED, 2, -8)}
{text(172, 186, 27, "TO COLLECT", family, squeeze, RED, 0.5, -6)}
</g></svg><figcaption>{name}</figcaption></figure>"""


def main():
    ref = base64.b64encode(pathlib.Path(sys.argv[1]).read_bytes()).decode()
    cells = "".join(badge(*f) for f in FONTS)
    html = ROOT / "docs/spike/V1-07-badge-fonts.html"
    html.write_text(f"""<!DOCTYPE html><meta charset="utf-8"><style>
body{{margin:0;background:{BG};display:grid;grid-template-columns:repeat(3,330px);width:990px;font:600 15px Arial}}
figure{{margin:0;padding:6px;text-align:center}} .ref img{{width:310px;image-rendering:auto}}
</style><figure class="ref"><img src="data:image/png;base64,{ref}"><figcaption>OWNER EXAMPLE</figcaption></figure>{cells}""", encoding="utf-8")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--window-size=990,920", f"--screenshot={OUT}", html.as_uri()], check=True, capture_output=True, timeout=60)
    html.unlink()


if __name__ == "__main__":
    main()
