"""Cut-out for catalog photos whose background is not pure white (flood fill fails).

Uses OpenCV GrabCut seeded from a thin border (certain background), then keeps
components above 0.2% of the image and crops to the figure.
Needs OpenCV: pip install -r requirements-images.txt (only for re-cutting images, not for the build).
"""
import cv2
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def cutout_photo(path, border=0.03, iterations=6):
    rgb = np.asarray(Image.open(path).convert("RGB"))
    h, w = rgb.shape[:2]
    m = max(2, int(min(h, w) * border))
    mask = np.full((h, w), cv2.GC_PR_FGD, np.uint8)
    mask[:m], mask[-m:], mask[:, :m], mask[:, -m:] = cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD, cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(rgb[:, :, ::-1].copy(), mask, None, bgd, fgd, iterations, cv2.GC_INIT_WITH_MASK)
    fg = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    fg = ndimage.binary_opening(fg, iterations=1)
    labels, n = ndimage.label(fg)
    if n:
        sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
        fg = np.isin(labels, 1 + np.flatnonzero(sizes >= 0.002 * labels.size))
    solid = Image.fromarray((fg * 255).astype(np.uint8))
    out = Image.fromarray(rgb).convert("RGBA")
    out.putalpha(solid.filter(ImageFilter.GaussianBlur(0.8)))
    return out.crop(solid.getbbox())
