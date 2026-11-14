"""Tests for the front-photo source switch (V2-13). The segmentation model is never loaded."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import process_images  # noqa: E402
from process_images import front_source, prepare_front  # noqa: E402


class FrontSourceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        for sid in ("71052", "71000"):
            d = self.tmp / sid
            d.mkdir()
            a = np.full((800, 800, 3), 255, np.uint8)
            a[200:700, 300:500] = (200, 30, 30)   # figure
            a[400:450, 380:420] = 255             # enclosed white part must survive
            Image.fromarray(a).save(d / f"{sid}-1.fig.jpg", quality=95)

    def test_switch(self):
        self.assertIsNotNone(front_source("71052", 1, self.tmp))
        self.assertIsNotNone(front_source("71000", 1, self.tmp))   # any series
        self.assertIsNone(front_source("71052", 2, self.tmp))      # no photo -> old pipeline
        self.assertIsNone(front_source("79999", 1, self.tmp))      # no dir

    def test_cutout_output_flood(self):
        out = prepare_front(front_source("71052", 1, self.tmp), method="flood")
        self.assertEqual(out.mode, "RGBA")
        self.assertLessEqual(out.size[1], 480)
        self.assertLess(out.size[0], 300)                           # tight crop
        al = np.asarray(out)[:, :, 3]
        self.assertGreater(al[216, 96], 200)    # enclosed white hole (orig row 425, col 400) kept
        self.assertGreater(al.mean(), 200)       # crop is tight: mostly figure

    def test_model_method_uses_alpha_and_crops(self):
        def fake_alpha(rgb):
            a = np.zeros(rgb.shape[:2], np.float32)
            a[100:600, 250:450] = 1.0           # 500 x 200 foreground
            return a

        import seg_model
        with mock.patch.object(seg_model, "model_alpha", fake_alpha):
            out = prepare_front(front_source("71000", 1, self.tmp), method="model")
        self.assertEqual(out.mode, "RGBA")
        self.assertEqual(out.size, (round(200 * 480 / 500), 480))   # tight crop, scaled to max_h
        self.assertGreater(np.asarray(out)[:, :, 3].min(), 250)

    def test_process_file_default_is_model(self):
        calls = []

        def fake_prepare(src, max_h=480, method="model"):
            calls.append(method)
            return Image.new("RGBA", (10, 10))

        dest = self.tmp / "o" / "x.webp"
        with mock.patch.object(process_images, "prepare_front", fake_prepare):
            process_images.process_file(Path("x"), dest, "figure_front")
        self.assertEqual(calls, ["model"])


if __name__ == "__main__":
    unittest.main()
