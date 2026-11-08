"""Tests for the front-photo source switch (V2-13)."""
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from process_images import front_source, process_file  # noqa: E402


class FrontSourceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        d = self.tmp / "71052"
        d.mkdir()
        a = np.full((800, 800, 3), 255, np.uint8)
        a[200:700, 300:500] = (200, 30, 30)   # figure
        a[400:450, 380:420] = 255             # enclosed white part must survive
        Image.fromarray(a).save(d / "71052-1.fig.jpg", quality=95)

    def test_switch(self):
        self.assertIsNotNone(front_source("71052", 1, self.tmp))
        self.assertIsNone(front_source("71052", 2, self.tmp))      # no photo -> old pipeline
        self.assertIsNone(front_source("71000", 1, self.tmp))      # series not switched

    def test_cutout_output(self):
        dest = self.tmp / "out" / "71052-1.webp"
        process_file(front_source("71052", 1, self.tmp), dest, "figure_front")
        im = Image.open(dest)
        self.assertEqual(im.mode, "RGBA")
        self.assertLessEqual(im.size[1], 480)
        self.assertLess(im.size[0], 300)                            # tight crop
        al = np.asarray(im)[:, :, 3]
        self.assertGreater(al[216, 96], 200)    # enclosed white hole (orig row 425, col 400) kept
        self.assertGreater(al.mean(), 200)       # crop is tight: mostly figure


if __name__ == "__main__":
    unittest.main()
