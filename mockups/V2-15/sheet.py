"""Compose sheet.png: directions A, B, C side by side for the owner to compare.

Each column holds one direction: the 1280 shot scaled to DESK_W next to the 390 shot scaled to
PHONE_W, under a label with the direction letter and name. Run after shoot.sh a / b / c.

Usage: python mockups/V2-15/sheet.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent

# Direction names as in build.py VARIANTS
NAMES = {"a": "Catalog card", "b": "Counter service", "c": "The collector's story"}

DESK_W, PHONE_W = 640, 200          # scaled widths of the desktop and phone shots
GAP, PAD, LABEL_H = 16, 40, 90      # gap between shots, outer padding, label band height
BG, INK, YELLOW, GREY = (18, 18, 17), (246, 246, 244), (255, 214, 0), (150, 150, 144)


def font(size):
    """Bold system font when present, PIL default otherwise."""
    for name in ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def scaled(path, width):
    im = Image.open(path).convert("RGB")
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def main():
    cols = []
    for key in NAMES:
        cols.append((key, scaled(HERE / f"{key}.png", DESK_W), scaled(HERE / f"{key}-390.png", PHONE_W)))
    col_w = DESK_W + GAP + PHONE_W
    body_h = max(max(d.height, p.height) for _, d, p in cols)
    sheet = Image.new("RGB", (PAD * 2 + col_w * 3 + PAD * 2, PAD * 2 + LABEL_H + body_h), BG)
    draw = ImageDraw.Draw(sheet)
    big, small = font(40), font(18)
    for i, (key, desk, phone) in enumerate(cols):
        x = PAD + i * (col_w + PAD)
        draw.text((x, PAD), key.upper(), font=big, fill=YELLOW)
        draw.text((x + 44, PAD), f"  {NAMES[key]}", font=big, fill=INK)
        draw.text((x, PAD + 52), "1280 wide (scaled)  |  390 phone", font=small, fill=GREY)
        top = PAD + LABEL_H
        sheet.paste(desk, (x, top))
        sheet.paste(phone, (x + DESK_W + GAP, top))
    out = HERE / "sheet.png"
    sheet.save(out, optimize=True)
    print("wrote", out, sheet.size)


if __name__ == "__main__":
    main()
