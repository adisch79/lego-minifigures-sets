"""V0-01 spike: remove white background by flood fill from the border (no ML)."""
import sys, glob, os
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
    alpha = Image.fromarray(((~bg) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert("RGBA"); out.putalpha(alpha)
    return out.crop(out.getbbox())

dst = sys.argv[1]
for p in sys.argv[2:]:
    o = cutout(p)
    o.save(os.path.join(dst, os.path.basename(p).replace(".jpg", ".png")))
print("done")
