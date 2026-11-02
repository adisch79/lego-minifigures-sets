"""Remove leftover white background blobs from GrabCut cut-outs.

Near-white regions touching the transparent area and larger than 1% of the image become transparent.
Usage: python scripts/strip_white.py <figureId> ...   (rewrites site/img/<series>/<figureId>.webp)
"""
import pathlib, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent


def strip(im, white_min=222, spread=26):
    a = np.asarray(im.convert("RGBA")).astype(np.int16)
    rgb, alpha = a[:, :, :3], a[:, :, 3]
    white = (rgb.min(axis=2) >= white_min) & (rgb.max(axis=2) - rgb.min(axis=2) <= spread) & (alpha > 0)
    labels, n = ndimage.label(white)
    near_bg = ndimage.binary_dilation(alpha < 128, iterations=2)
    remove = np.zeros_like(white)
    for i in np.unique(labels[near_bg & white]):
        region = labels == i
        if i and region.sum() >= 0.01 * labels.size:
            remove |= region
    fg = ndimage.binary_opening(alpha.astype(bool) & ~ndimage.binary_dilation(remove, iterations=1), iterations=1)
    solid = Image.fromarray((fg * 255).astype(np.uint8))
    out = im.convert("RGBA")
    out.putalpha(solid.filter(ImageFilter.GaussianBlur(0.8)))
    return out.crop(solid.getbbox())


if __name__ == "__main__":
    for fid in sys.argv[1:]:
        p = ROOT / "site/img" / fid.split("-")[0] / f"{fid}.webp"
        strip(Image.open(p)).save(p, quality=90)
