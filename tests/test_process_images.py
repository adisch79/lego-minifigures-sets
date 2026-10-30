"""Unit tests for the bag flattening (no model needed). Run: python -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from process_images import background_mask, color_hex, flat_rect  # noqa: E402


class FlatRectTest(unittest.TestCase):
    def test_rotated_square_gives_inner_rect(self):
        # Diamond shape: crop must lie fully inside it.
        n = 200
        y, x = np.mgrid[:n, :n]
        fg = (abs(x - n / 2) + abs(y - n / 2)) < n * 0.45
        l, t, r, b = flat_rect(fg)
        self.assertGreaterEqual(fg[t:b, l:r].mean(), 0.97)
        self.assertGreater((r - l) * (b - t), 0.25 * fg.sum())

    def test_empty(self):
        self.assertIsNone(flat_rect(np.zeros((10, 10), bool)))


class BackgroundMaskTest(unittest.TestCase):
    def test_enclosed_white_is_kept(self):
        rgb = np.full((50, 50, 3), 255, np.uint8)
        rgb[10:40, 10:40] = 20          # dark box
        rgb[20:30, 20:30] = 255         # white hole inside the box
        bg = background_mask(rgb)
        self.assertTrue(bg[0, 0])
        self.assertFalse(bg[25, 25])
        self.assertFalse(bg[15, 15])


class ColorHexTest(unittest.TestCase):
    def test_average(self):
        self.assertEqual(color_hex(np.array([[[255, 0, 0], [0, 0, 255]]])), "#7f007f")


if __name__ == "__main__":
    unittest.main()
