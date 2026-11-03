"""Add a found group image: trim to content, cap width, record the source.

Usage: python docs/spike/V1-07-add-group.py <set id> <downloaded file> <source url>
Output: mockups/assets/group/<id>.png and a line in SOURCES.md. Refuses files without real alpha.
"""
import pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
GROUP = ROOT / "mockups/assets/group"
MAX_W = 1600  # The card shows the image at most 564 px wide; 1600 covers high-DPI zoom.
MIN_CLEAR = 0.2  # Below this share of clear pixels the file has no real cut-out.


def main():
    sid, src, url = sys.argv[1:4]
    im = Image.open(src).convert("RGBA")
    clear = float((np.asarray(im)[..., 3] < 10).mean())
    if clear < MIN_CLEAR:
        sys.exit(f"{sid}: no real alpha (clear {clear:.2f})")
    im = im.crop(im.getbbox())
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    im.save(GROUP / f"{sid}.png", optimize=True)
    with open(GROUP / "SOURCES.md", "a", encoding="utf-8") as f:
        f.write(f"- {sid}.png — SOURCE: {url}\n")
    print(sid, im.size, f"clear {clear:.2f}")


if __name__ == "__main__":
    main()
