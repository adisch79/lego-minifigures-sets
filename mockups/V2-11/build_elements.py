"""V2-11: export every badge element as a standalone transparent PNG, so the owner can assemble the badge by hand.

Usage: python mockups/V2-11/build_elements.py
Output: mockups/V2-11/elements/*.png, upright (no tilt), at SCALE x the card size, trimmed to the drawn pixels.
Colours, fonts and shapes come from scripts/build_cards.py (HEAD, HEAD_DARK, RED, FRAME, NAVY, label()).
"""
import json, pathlib, subprocess, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import build_cards as bc  # noqa: E402

OUT = ROOT / "mockups/V2-11/elements"
TMP = ROOT / "mockups/V2-11/tmp"
SCALE = 4  # badge viewBox units to PNG pixels; the card draws the badge at about 0.9 px per unit


def shape(name, w, h, body):
    """Render one SVG element (viewBox units w x h) to a transparent PNG and trim it."""
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w * SCALE}" height="{h * SCALE}" viewBox="0 0 {w} {h}">'
           f'<style>text{{font-family:"Arial Black",Arial,sans-serif;font-weight:900}}</style>{body}</svg>')
    html = TMP / f"el-{name}.html"
    html.write_text(f'<!DOCTYPE html><style>html,body{{margin:0;background:transparent}}</style>{svg}', encoding="utf-8")
    png = OUT / f"{name}.png"
    subprocess.run([bc.CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--default-background-color=00000000", f"--user-data-dir={TMP / 'chrome'}",
                    f"--window-size={w * SCALE},{h * SCALE}", f"--screenshot={png}", html.as_uri()],
                   check=True, capture_output=True, timeout=90)
    html.unlink()
    img = Image.open(png).convert("RGBA")
    img.crop(img.getbbox()).save(png)
    print(png.name, Image.open(png).size, flush=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    R = bc.RED
    catalog = json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))["series"]
    # Head parts: same rects as bc.badge, shifted to the origin.
    shape("head-stud", 84, 42, f'<rect x="2" y="2" width="80" height="38" rx="4" fill="{bc.HEAD_DARK}"/>')
    shape("head-neck", 116, 36, f'<rect x="2" y="2" width="112" height="32" rx="4" fill="{bc.HEAD_DARK}"/>')
    shape("head-face", 164, 154, f'<rect x="2" y="2" width="160" height="150" rx="34" fill="{bc.HEAD}"/>')
    shape("head-full", 164, 206,
          f'<rect x="42" y="2" width="80" height="38" rx="4" fill="{bc.HEAD_DARK}"/>'
          f'<rect x="26" y="172" width="112" height="32" rx="4" fill="{bc.HEAD_DARK}"/>'
          f'<rect x="2" y="31" width="160" height="150" rx="34" fill="{bc.HEAD}"/>')
    shape("checkbox", 40, 36,
          f'<rect x="4" y="8" width="24" height="24" rx="6" fill="#fff" stroke="{R}" stroke-width="4"/>'
          f'<path d="M9 20 l6 7 l18 -18" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
    shape("to-collect", 140, 40, bc.label(70, 30, 25, "TO COLLECT", 0.6, R, 1, -6))
    counts = sorted({s["figureCount"] for s in catalog})
    for n in counts:
        shape(f"count-{n}", 110, 90, bc.label(55, 78, 92, n, 0.66, R, 4, -8, -5))
    # Series frame parts.
    shape("series-circle", 120, 120, f'<circle cx="60" cy="60" r="53" fill="{bc.FRAME}" stroke="#fff" stroke-width="6"/>')
    shape("series-label", 80, 30, bc.label(40, 24, 23, "SERIES", 0.66, bc.NAVY, 0.5))
    numbers = sorted({n for n in map(bc.series_number, catalog) if n})
    for n in numbers:
        shape(f"series-{n}", 90, 50, bc.label(45, 44, 52, n, 0.72, bc.NAVY, 2))


if __name__ == "__main__":
    main()
