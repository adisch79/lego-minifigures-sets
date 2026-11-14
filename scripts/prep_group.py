"""Prepare card group images from grouped crowd photos (V2-11).

Owner rule 2026-11-09: cards show a packed crowd of figures, never a grid of figures on stands; when a set has many
figures, zoom in on part of the crowd instead of showing all (references: 71009, 71033, 71039, 71051).

Per series: source photo in mockups/V2-11/crowd-candidates/, optional pre-crop (drops captions, watermarks or a
second crowd), background removal ("white" flood from the border, "shadow" = white plus soft grey floor shadows, or "grabcut" for gradients and photos), trim,
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
    "8803": ("8803-1.png", None, "shadow", None),
    "8805": ("8805-1.jpg", None, "shadow", None),
    "8831": ("8831-1.jpg", None, "white", None),
    "8833": ("8833-1.png", None, "shadow", None),
    "71000": ("71000-2.jpg", None, "white", None),
    "8909": ("8909-1.jpg", None, "white", None),
    "71002": ("71002-1.png", None, "grabcut", None),
    # 8684: official box-back art (blue "?" background); crop drops the bottom logo row and the "16" badge.
    "8684": ("8684-1.jpg", (0.06, 0.27, 0.93, 0.74), "blue", None),
    "71007": ("71007-1.jpg", None, "white", None),
    # 71008: official render from Brickipedia (owner pointer 2026-11-14); the PNG alpha is fully opaque, white bg.
    "71008": ("71008-1.png", None, "shadow", None),
    "71017": ("71017-1.png", (0, 0.08, 1, 0.455), "white", None),
    "71023": ("71023-1.jpg", (0, 0.2, 1, 0.9), "grabcut", None),
    # 71031: the previous card image (already transparent); only the largest part (the ground crowd) is kept, which
    # drops the flying heroes above it.
    "71031": ("71031-0.png", None, "alpha", None),
}

# id -> boxes (fractions of the source) painted as background before masking: printed badges on box art.
# 8684: the red "Series 2" badge (x 124-180, y 126-187 of 690x480), its white hook and rod, top left. Boxes set by eye against the source.
ERASE = {"8684": [(0.1797, 0.2625, 0.2609, 0.3896), (0.1406, 0.302, 0.1797, 0.454), (0.171, 0.3896, 0.1855, 0.4833)]}
ERASE_FILL = (0, 70, 190)                                  # deep blue: keyed out by blue_mask


def keep_big(fg, share=0.002):
    """Drop specks: keep connected parts above share of the image."""
    labels, n = ndimage.label(fg)
    if not n:
        return fg
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    return np.isin(labels, 1 + np.flatnonzero(sizes >= share * labels.size))


def white_mask(rgb, white_min=226, spread=22, hole_min=250, hole_share=0.0004):
    """Foreground = not background. Background = near-white region touching the border, plus enclosed pure-white
    holes between figures above hole_share of the image (small white highlights on figures stay)."""
    lo, hi = rgb.min(axis=2), rgb.max(axis=2).astype(int)
    white = (lo >= white_min) & (hi - lo <= spread)
    labels, _ = ndimage.label(white)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, edge[edge > 0])
    pure = (lo >= hole_min) & (hi - lo <= 8) & ~bg
    plabels, n = ndimage.label(pure)
    if n:
        sizes = ndimage.sum(np.ones_like(plabels), plabels, range(1, n + 1))
        holes = np.isin(plabels, 1 + np.flatnonzero(sizes >= hole_share * plabels.size))
        bg |= ndimage.binary_dilation(holes, iterations=1) & white
    return ndimage.binary_opening(~bg, iterations=1)


def shadow_mask(rgb, lo_min=150, chroma=24, grad_max=6.0):
    """white_mask plus the soft grey floor shadows of studio shots (8803, 8805, 8833): light, low-colour, smooth
    pixels connected to the border are background too. The gradient limit stops the flood at figure outlines, so
    white figure parts (mummy, jersey) stay. Limits set by eye on those three sources."""
    lo, hi = rgb.min(axis=2).astype(int), rgb.max(axis=2).astype(int)
    gray = ndimage.gaussian_filter(rgb.mean(axis=2), 1.0)
    grad = np.hypot(ndimage.sobel(gray, 0), ndimage.sobel(gray, 1)) / 8
    cand = (lo >= lo_min) & (hi - lo <= chroma) & (grad <= grad_max)
    labels, _ = ndimage.label(cand)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    shadow = np.isin(labels, edge[edge > 0])
    # Enclosed white gaps between figures are not removed here: by colour they cannot be told from white figure
    # parts (a hole rule tried 2026-11-10 also cut the 8805 clown face, 8803 tank top and 8833 Santa beard).
    return ndimage.binary_opening(white_mask(rgb) & ~shadow, iterations=1)


def unmix_white(rgb, fg, band=2):
    """Soft alpha on the edge band from whiteness, with the white spill removed from the colour (no white halo)."""
    a = np.where(fg, 1.0, 0.0)
    edge = fg & ~ndimage.binary_erosion(fg, iterations=band)
    c = rgb.astype(float)
    soft = (255 - c.min(axis=2)) / 255 * 2.5          # light fringe pixels become see-through
    a[edge] = np.clip(soft[edge], 0, 1)
    k = np.maximum(a, 1e-3)[..., None]
    out = np.clip(255 - (255 - c) / k, 0, 255)
    out[~edge] = c[~edge]
    return out.astype(np.uint8), (a * 255).astype(np.uint8)


def gap_cut(alpha, x, window):
    """Column near x (within window) with the least figure coverage, so a crop edge falls between figures."""
    cover = (alpha > 127).sum(axis=0)
    lo, hi = max(0, x - window), min(len(cover) - 1, x + window)
    return lo + int(np.argmin(cover[lo:hi + 1]))


def blue_mask(rgb, margin=28, b_min=60, hole_max=0.004):
    """Box art on a blue background (8684): background = blue-dominant pixels. Enclosed blue parts smaller than
    hole_max of the image (blue stripes on a figure) are filled back in as figure."""
    r, g, b = (rgb[:, :, i].astype(int) for i in range(3))
    # b_min: black parts with a blue sheen (8684 ringmaster hat, b about 20) stay figure; background b is 125+.
    bg = (b > r + margin) & (b > g + margin // 3) & (b > b_min)
    bg = ndimage.binary_opening(bg, iterations=1)
    fg = ~bg
    holes = ndimage.binary_fill_holes(fg) & ~fg
    labels, n = ndimage.label(holes)
    if n:
        sizes = ndimage.sum(holes, labels, range(1, n + 1))
        fg |= np.isin(labels, 1 + np.flatnonzero(sizes < hole_max * fg.size))
    return ndimage.binary_opening(fg, iterations=1)


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
# owner's references do (71009 is 1.64, 71051 1.62). SOURCE: OWNER-SUPPLIED rule 2026-11-09, ratio by eye.
ZOOM_ASPECT = 1.7
# Small sets keep every figure: Team GB has 9.
NO_ZOOM = {"8909"}


def drop_fragments(im, share=0.01):
    """The zoom cut can slice a figure and leave a loose piece at the edge (71023: a 640 px yellow fragment top
    right). Clear alpha parts under share of the largest part."""
    a = np.asarray(im.split()[-1])
    labels, n = ndimage.label(a > 127)
    if n < 2:
        return im
    sizes = ndimage.sum(a > 127, labels, range(1, n + 1))
    small = np.isin(labels, 1 + np.flatnonzero(sizes < share * sizes.max()))
    small = ndimage.binary_dilation(small, iterations=2)       # include the soft alpha rim
    out = im.copy()
    out.putalpha(Image.fromarray(np.where(small, 0, a).astype(np.uint8)))
    return out


def frac_box(size, box):
    w, h = size
    return round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)


def prep(sid):
    name, pre, method, zoom = PREP[sid]
    src = Image.open(SRC / name).convert("RGBA")
    for box in ERASE.get(sid, []):
        src.paste(ERASE_FILL + (255,), frac_box(src.size, box))
    if pre:
        src = src.crop(frac_box(src.size, pre))
    im = src.convert("RGB")
    rgb = np.asarray(im)
    if method == "alpha":
        fg = np.asarray(src)[:, :, 3] > 127
        labels, n = ndimage.label(fg)
        if n > 1:                                          # keep the largest part only
            sizes = ndimage.sum(fg, labels, range(1, n + 1))
            fg = labels == 1 + int(np.argmax(sizes))
        out = src.copy()
        out.putalpha(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))
    else:
        masks = {"white": white_mask, "shadow": shadow_mask, "grabcut": grabcut_mask,
                 "blue": blue_mask}
        fg = keep_big(masks[method](rgb))
        colour, alpha = unmix_white(rgb, fg) if method not in ("grabcut", "blue") else (rgb, (fg * 255).astype(np.uint8))
        out = Image.fromarray(colour).convert("RGBA")
        out.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.5)))
    out = out.crop(Image.fromarray((fg * 255).astype(np.uint8)).getbbox())
    if zoom:
        out = out.crop(frac_box(out.size, zoom))
        out = out.crop(out.split()[-1].getbbox())
    w, h = out.size
    if w / h > ZOOM_ASPECT and sid not in NO_ZOOM:
        a = np.asarray(out.split()[-1])
        x0 = round((w - ZOOM_ASPECT * h) / 2)
        win = round(0.08 * w)
        out = out.crop((gap_cut(a, x0, win), 0, gap_cut(a, w - x0, win), h))
        out = drop_fragments(out)
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
