"""Turn downloaded product photos into clean web images.

  - figures / group shots: background removed with the u2net model (rembg), trimmed to content,
    saved as WebP with transparency. u2net keeps white plastic (e.g. white trousers) solid and
    drops the soft floor shadow, which simple white-thresholding cannot do.
  - bags / boxes: cropped to the largest flat rectangle inside the packaging, so the tile shows
    the artwork itself (no bag outline, no white corners).
"""

import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

GROUP_WHITE_MIN = 253    # group shots: pixels this white are always background
BAG_WHITE_MIN = 245      # background pixels: all channels at least this bright ...
WHITE_SPREAD = 22        # ... and nearly gray (max - min channel)
BAG_EDGE_FILL = 0.985    # a crop edge must be this much artwork
PAD = 0.02               # padding around trimmed cut-outs, fraction of size
MODEL = "u2net"

_session = None


def _rembg_session():
    global _session
    if _session is None:
        from rembg import new_session  # heavy import, only when cut-outs are needed
        _session = new_session(MODEL)
    return _session


def background_mask(rgb):
    """Bool array: True for near-white pixels connected to the image border."""
    a = rgb.astype(np.int16)
    white = (a.min(axis=2) >= BAG_WHITE_MIN) & (a.max(axis=2) - a.min(axis=2) <= WHITE_SPREAD)
    labels, _ = ndimage.label(white)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    return np.isin(labels, border[border != 0])


def flat_rect(fg):
    """Shrink the content bounding box until every edge lies (almost) fully inside the content."""
    rows, cols = np.where(fg)
    if rows.size == 0:
        return None
    t, b, l, r = rows.min(), rows.max(), cols.min(), cols.max()
    step_y, step_x = max(1, (b - t) // 200), max(1, (r - l) // 200)
    for _ in range(400):
        edges = {
            "t": fg[t, l:r + 1].mean(), "b": fg[b, l:r + 1].mean(),
            "l": fg[t:b + 1, l].mean(), "r": fg[t:b + 1, r].mean(),
        }
        worst = min(edges, key=edges.get)
        if edges[worst] >= BAG_EDGE_FILL or b - t < 20 or r - l < 20:
            break
        if worst == "t":
            t += step_y
        elif worst == "b":
            b -= step_y
        elif worst == "l":
            l += step_x
        else:
            r -= step_x
    return int(l), int(t), int(r) + 1, int(b) + 1


def color_hex(rgb):
    """Average color of an RGB array as '#rrggbb'."""
    c = rgb.reshape(-1, 3).mean(axis=0)
    return "#{:02x}{:02x}{:02x}".format(*(int(v) for v in c))


def flatten_bag(img, max_size):
    """Bag / box photo -> RGB crop of the flat artwork."""
    img = img.convert("RGB")
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    fg = ndimage.binary_fill_holes(~background_mask(np.asarray(img)))
    box = flat_rect(fg)
    return img.crop(box) if box else img


def cleanup_alpha(rgb, alpha):
    """Group shots: u2net leaves white haze and semi-transparent figures among many small objects.
    Pure-white background pixels -> fully transparent; clearly colored covered pixels -> solid."""
    a = rgb.astype(np.int16)
    pure_white = a.min(axis=2) >= GROUP_WHITE_MIN
    colored = (a.min(axis=2) < BAG_WHITE_MIN) | (a.max(axis=2) - a.min(axis=2) > WHITE_SPREAD)
    alpha = alpha.copy()
    alpha[pure_white] = 0
    alpha[colored & (alpha > 40)] = 255
    return alpha


def cut_out(img, max_size, kind="figure"):
    """Figure / group shot -> RGBA with transparent background, trimmed to content."""
    from rembg import remove
    img = img.convert("RGB")
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    out = remove(img, session=_rembg_session())
    if kind == "group":
        alpha = cleanup_alpha(np.asarray(img), np.asarray(out.getchannel("A")))
        out.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.6)))
    box = out.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    if box:
        w, h = out.size
        p = int(max(w, h) * PAD)
        out = out.crop((max(0, box[0] - p), max(0, box[1] - p), min(w, box[2] + p), min(h, box[3] + p)))
    return out


def process_file(src, dest, kind):
    """Process one downloaded file to WebP. kind: 'bag' | 'figure' | 'group'."""
    max_size = {"bag": 700, "figure": 900, "group": 1800}[kind]
    with Image.open(src) as img:
        out = flatten_bag(img, max_size) if kind == "bag" else cut_out(img, max_size, kind)
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Save to a temp file first so a failed save never leaves a corrupt WebP behind.
    tmp = dest.with_name(dest.stem + ".tmp.webp")
    try:
        out.save(tmp, "WEBP", quality=82, method=5)
        os.replace(tmp, dest)
    finally:
        if tmp.exists():
            tmp.unlink()


def safe_process_file(src, dest, kind):
    """process_file that logs and swallows per-file errors. Returns True on success."""
    try:
        process_file(src, dest, kind)
        return True
    except Exception as e:  # one bad file must not abort the run
        print(f"  ERROR processing {src}: {type(e).__name__}: {e}", flush=True)
        return False
