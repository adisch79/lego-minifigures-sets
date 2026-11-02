"""BrickLink figure cut-out (V0-01 / V0-06 method): white region connected to the
border becomes transparent, then specks under 0.2% of the image are removed."""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def cutout(path, white_min=238, spread=24):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    white = (a.min(axis=2) >= white_min) & (a.max(axis=2) - a.min(axis=2) <= spread)
    labels, _ = ndimage.label(white)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, border[border != 0])
    bg = ndimage.binary_opening(bg, iterations=1)
    fg_labels, nfg = ndimage.label(~bg)
    if nfg:
        sizes = ndimage.sum(np.ones_like(fg_labels), fg_labels, range(1, nfg + 1))
        keep = np.isin(fg_labels, 1 + np.flatnonzero(sizes >= 0.002 * fg_labels.size))
        bg = ~keep
    alpha = Image.fromarray(((~bg) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    box = Image.fromarray(((~bg) * 255).astype(np.uint8)).getbbox()
    return out.crop(box)
