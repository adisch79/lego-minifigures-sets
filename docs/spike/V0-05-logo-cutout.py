# Removes the flat light background from a downloaded theme logo by flood filling from the border.
# Usage: python V0-05-logo-cutout.py <in.png> <out.png> [tolerance]
import sys
from collections import deque
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
tol = int(sys.argv[3]) if len(sys.argv) > 3 else 18
im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()
bg = px[1, 1][:3]
seen = bytearray(w * h)
q = deque()
for x in range(w):
    q.append((x, 0)); q.append((x, h - 1))
for y in range(h):
    q.append((0, y)); q.append((w - 1, y))
while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i]:
        continue
    seen[i] = 1
    r, g, b, _ = px[x, y]
    d = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
    if d > tol:
        continue
    px[x, y] = (r, g, b, 0)
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
            q.append((nx, ny))
im = im.crop(im.getbbox())
im.save(dst)
print(dst, im.size)
