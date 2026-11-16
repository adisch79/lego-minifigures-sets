"""Compose sheet.png: the three V2-16 directions side by side.

Row 1: Magic link at 600 px (light). Row 2: the same email with the dark rules on.
Row 3: the 390 px phone render. Usage: python mockups/V2-16/sheet.py (after shoot.sh a|b|c)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
NAMES = {"a": "A - Receipt", "b": "B - Yellow band", "c": "C - Collector ticket"}
GAP, TOP, BG = 40, 70, (237, 237, 234)


def font(size):
    for f in ("segoeuib.ttf", "arialbd.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    rows = [[Image.open(HERE / f"{k}{s}.png").convert("RGB") for k in NAMES] for s in ("", "-dark", "-390")]
    colw = 624
    heights = [max(im.height for im in r) for r in rows]
    W = GAP + len(NAMES) * (colw + GAP)
    H = TOP + sum(heights) + GAP * (len(rows) + 1)
    sheet = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(sheet)
    for i, name in enumerate(NAMES.values()):
        d.text((GAP + i * (colw + GAP), 22), name, fill=(26, 26, 26), font=font(30))
    y = TOP
    for r, h in zip(rows, heights):
        for i, im in enumerate(r):
            x = GAP + i * (colw + GAP) + (colw - im.width) // 2
            sheet.paste(im, (x, y))
        y += h + GAP
    sheet.save(HERE / "sheet.png")
    print("sheet.png", W, H)


if __name__ == "__main__":
    main()
