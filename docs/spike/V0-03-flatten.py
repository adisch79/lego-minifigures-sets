"""V0-03 spike: flatten a bag/box photo into a straight rectangle of its printed artwork."""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

def fg_mask(rgb, white_min=238, spread=24):
    a = rgb.astype(np.int16)
    white = (a.min(axis=2) >= white_min) & (a.max(axis=2) - a.min(axis=2) <= spread)
    labels, _ = ndimage.label(white)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, border[border != 0])
    fg = ndimage.binary_fill_holes(~bg)
    lab, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(fg, lab, range(1, n + 1)); fg = lab == (1 + int(np.argmax(sizes)))
    return fg

def corners(fg):
    ys, xs = np.nonzero(fg)
    s, d = xs + ys, xs - ys
    tl = (xs[s.argmin()], ys[s.argmin()]); br = (xs[s.argmax()], ys[s.argmax()])
    tr = (xs[d.argmax()], ys[d.argmax()]); bl = (xs[d.argmin()], ys[d.argmin()])
    return tl, tr, br, bl

def flatten(path, trim=(0.03, 0.03, 0.035, 0.035)):
    """trim = fraction cut from (top, bottom, left, right) after warping: removes seals and crimped edges."""
    im = Image.open(path).convert("RGB"); fg = fg_mask(np.asarray(im))
    tl, tr, br, bl = corners(fg)
    w = int(round((np.hypot(*np.subtract(tr, tl)) + np.hypot(*np.subtract(br, bl))) / 2))
    h = int(round((np.hypot(*np.subtract(bl, tl)) + np.hypot(*np.subtract(br, tr))) / 2))
    quad = (*tl, *bl, *br, *tr)
    flat = im.transform((w, h), Image.QUAD, quad, resample=Image.BICUBIC)
    t, b, l, r = trim
    flat = flat.crop((int(w * l), int(h * t), int(w * (1 - r)), int(h * (1 - b))))
    return fill_hanger_hole(flat)

def fill_hanger_hole(im):
    """Paint the white hanger slot (enclosed near-white blob in the top third) with nearby artwork colours."""
    a = np.asarray(im).astype(np.int16)
    white = (a.min(axis=2) >= 235) & (a.max(axis=2) - a.min(axis=2) <= 25)
    top = np.zeros_like(white); top[: a.shape[0] // 3] = True
    lab, n = ndimage.label(white & top)
    if n == 0:
        return im
    sizes = ndimage.sum(white, lab, range(1, n + 1)); k = 1 + int(np.argmax(sizes))
    if sizes[k - 1] < 0.002 * white.size:
        return im
    hole = ndimage.binary_dilation(lab == k, iterations=4)
    _, (iy, ix) = ndimage.distance_transform_edt(hole, return_indices=True)
    filled = a[iy, ix].astype(np.uint8)
    blur = np.stack([ndimage.gaussian_filter(filled[..., c].astype(float), 6) for c in range(3)], -1)
    out = a.astype(float); out[hole] = blur[hole]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))

dst = sys.argv[1]
for p in sys.argv[2:]:
    out = flatten(p); out.thumbnail((600, 900))
    out.save(os.path.join(dst, os.path.basename(os.path.dirname(p)) + ".png"))
print("done")
