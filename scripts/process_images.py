"""Turn downloaded product photos into web images. No background removal.

  - figures: real Rebrickable minifig photo, uniform border trimmed, padded to 3:4 with the
    photo's own background colour, max 900 px tall.
  - group shots: only resized (max 1800 px wide).
  - bags / boxes: cropped to the largest flat rectangle inside the packaging, so the tile shows
    the artwork itself (no bag outline, no white corners).
"""

import os

import numpy as np
from PIL import Image
from scipy import ndimage

BAG_WHITE_MIN = 245      # background pixels: all channels at least this bright ...
WHITE_SPREAD = 22        # ... and nearly gray (max - min channel)
BAG_EDGE_FILL = 0.985    # a crop edge must be this much artwork
TRIM_TOL = 14            # figure photos: pixel differs from the corner colour by more than this
TRIM_MARGIN = 0.04       # margin kept around the figure, fraction of its size
FIG_ASPECT = 3 / 4       # figure image width / height


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


def trim_and_pad(img, aspect=FIG_ASPECT):
    """Trim the uniform border (colour of the corners) and pad to width/height = aspect
    with the photo's own background colour."""
    img = img.convert("RGB")
    a = np.asarray(img).astype(np.int16)
    corners = np.stack([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]])
    bg = tuple(int(v) for v in np.median(corners, axis=0))
    diff = np.abs(a - np.array(bg, np.int16)).max(axis=2) > TRIM_TOL
    rows, cols = np.where(diff)
    if rows.size:
        l, r, t, b = cols.min(), cols.max() + 1, rows.min(), rows.max() + 1
        m = int(max(r - l, b - t) * TRIM_MARGIN)
        w, h = img.size
        img = img.crop((max(0, l - m), max(0, t - m), min(w, r + m), min(h, b + m)))
    w, h = img.size
    cw, ch = (w, round(w / aspect)) if w / h > aspect else (round(h * aspect), h)
    canvas = Image.new("RGB", (cw, ch), bg)
    canvas.paste(img, ((cw - w) // 2, (ch - h) // 2))
    return canvas


def prepare_figure(img, max_height):
    out = trim_and_pad(img)
    if out.size[1] > max_height:
        w, h = out.size
        out = out.resize((max(1, round(w * max_height / h)), max_height), Image.LANCZOS)
    return out


def prepare_group(img, max_width):
    """Group shot: unchanged except for a downscale to max_width."""
    img = img.convert("RGB")
    if img.size[0] > max_width:
        w, h = img.size
        img = img.resize((max_width, max(1, round(h * max_width / w))), Image.LANCZOS)
    return img


def process_file(src, dest, kind):
    """Process one downloaded file to WebP. kind: 'bag' | 'figure' | 'group'."""
    with Image.open(src) as img:
        if kind == "bag":
            out = flatten_bag(img, 700)
        elif kind == "figure":
            out = prepare_figure(img, 900)
        else:
            out = prepare_group(img, 1800)
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
