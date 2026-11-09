"""Prepare card group images from grouped crowd photos (V2-11).

Owner rule 2026-11-09: cards show a packed crowd of figures, never a grid of figures on stands; when a set has many
figures, zoom in on part of the crowd instead of showing all (references: 71009, 71033, 71039, 71051).

Per series: source photo in mockups/V2-11/crowd-candidates/, optional pre-crop (drops captions, watermarks or a
second crowd), background removal ("white" flood from the border, or "grabcut" for gradients and photos), trim,
then an optional zoom crop. Writes mockups/assets/group/<id>.png. Sources: mockups/V2-11/crowd-candidates/SOURCES.md.
Needs OpenCV only for "grabcut" sources: pip install -r requirements-images.txt.
Usage: python scripts/prep_group.py [<id> ...]   (no args: all series in PREP)
"""
import pathlib, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "mockups/V2-11/crowd-candidates"
OUT = ROOT / "mockups/assets/group"

# id -> (source file, pre-crop box as fractions of the source (x0, y0, x1, y1) or None, method,
#        zoom box as fractions of the trimmed cut-out or None). Boxes set by eye against the card sheet.
PREP = {
    "8683": ("8683-2.jpg", None, "white", None),
    "8803": ("8803-1.png", None, "white", None),
    "8805": ("8805-1.jpg", None, "white", None),
    "8831": ("8831-1.jpg", None, "white", None),
    "8833": ("8833-1.png", None, "white", None),
    "71000": ("71000-2.jpg", None, "white", None),
    "8909": ("8909-1.jpg", None, "white", None),
    "71002": ("71002-1.png", None, "grabcut", None),
    "71007": ("71007-1.jpg", None, "white", None),
    "71017": ("71017-1.png", (0, 0.08, 1, 0.455), "white", None),
    "71023": ("71023-1.jpg", (0, 0.2, 1, 0.9), "grabcut", None),
    # 71031: the previous card image (already transparent), zoomed in on the crowd below the flying heroes.
    "71031": ("71031-0.png", None, "alpha", (0, 0.45, 1, 1)),
}


def keep_big(fg, share=0.002):
    """Drop specks: keep connected parts above share of the image."""
    labels, n = ndimage.label(fg)
    if not n:
        return fg
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    return np.isin(labels, 1 + np.flatnonzero(sizes >= share * labels.size))


def white_mask(rgb, white_min=226, spread=22):
    """Foreground = everything not in the near-white region connected to the image border."""
    white = (rgb.min(axis=2) >= white_min) & (rgb.max(axis=2).astype(int) - rgb.min(axis=2) <= spread)
    labels, _ = ndimage.label(white)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, edge[edge > 0])
    return ndimage.binary_opening(~bg, iterations=1)


def grabcut_mask(rgb, border=0.03, iterations=6):
    import cv2
    h, w = rgb.shape[:2]
    m = max(2, int(min(h, w) * border))
    mask = np.full((h, w), cv2.GC_PR_FGD, np.uint8)
    mask[:m], mask[-m:], mask[:, :m], mask[:, -m:] = cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(rgb[:, :, ::-1].copy(), mask, None, bgd, fgd, iterations, cv2.GC_INIT_WITH_MASK)
    return ndimage.binary_opening((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), iterations=1)


# Crowds wider than this are centre-cropped to it, so a big set shows part of the crowd with larger figures, as the
# owner's references do (71033 is 1.48, 71039 1.42). SOURCE: OWNER-SUPPLIED rule 2026-11-09, ratio by eye.
ZOOM_ASPECT = 1.4
# Small sets keep every figure: Team GB has 9.
NO_ZOOM = {"8909"}


def frac_box(size, box):
    w, h = size
    return round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)


def prep(sid):
    name, pre, method, zoom = PREP[sid]
    src = Image.open(SRC / name).convert("RGBA")
    if pre:
        src = src.crop(frac_box(src.size, pre))
    im = src.convert("RGB")
    rgb = np.asarray(im)
    if method == "alpha":
        fg = np.asarray(src)[:, :, 3] > 127
    else:
        fg = keep_big(white_mask(rgb) if method == "white" else grabcut_mask(rgb))
    solid = Image.fromarray((fg * 255).astype(np.uint8))
    out = im.convert("RGBA")
    out.putalpha(solid.filter(ImageFilter.GaussianBlur(0.8)))
    out = out.crop(solid.getbbox())
    if zoom:
        out = out.crop(frac_box(out.size, zoom))
        out = out.crop(out.split()[-1].getbbox())
    w, h = out.size
    if w / h > ZOOM_ASPECT and sid not in NO_ZOOM:
        x0 = round((w - ZOOM_ASPECT * h) / 2)
        out = out.crop((x0, 0, w - x0, h))
        out = out.crop(out.split()[-1].getbbox())
    out.save(OUT / f"{sid}.png", optimize=True)
    return sid, out.size


def main():
    ids = sys.argv[1:] or list(PREP)
    unknown = set(ids) - set(PREP)
    if unknown:
        sys.exit(f"no prep entry: {sorted(unknown)}")
    for sid in ids:
        print(*prep(sid), flush=True)


if __name__ == "__main__":
    main()
