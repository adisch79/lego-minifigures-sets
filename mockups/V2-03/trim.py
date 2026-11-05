# Trim the uniform board-coloured tail off a tall screenshot, leaving a 48px margin.
import sys
from PIL import Image
p = sys.argv[1]
im = Image.open(p).convert('RGB')
w, h = im.size
bg = im.getpixel((w - 2, h - 2))
y = h - 1
while y > 0 and all(im.getpixel((x, y)) == bg for x in range(0, w, 7)):
    y -= 1
end = min(h, y + 48)
im.crop((0, 0, w, end)).save(p)
print(p, w, end, 'of', h)
