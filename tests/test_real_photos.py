"""E8-01: real minifig photos as primary image, no background removal. No network."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import fetch_data  # noqa: E402
import process_images  # noqa: E402

FIG = "https://cdn.rebrickable.com/media/sets/fig-000961.jpg"
SETIMG = "https://cdn.rebrickable.com/media/sets/71002-1.jpg"
GREY = (200, 200, 200)
RED = (200, 20, 20)


def grey_with_block(size=(400, 300), box=(150, 100, 250, 250), bg=GREY, fg=RED):
    im = Image.new("RGB", size, bg)
    im.paste(Image.new("RGB", (box[2] - box[0], box[3] - box[1]), fg), box[:2])
    return im


class PlanTest(unittest.TestCase):
    def test_fig_preferred(self):
        item = {"set_num": "71002-1", "src": SETIMG}
        fetch_data.plan_figure_source(item, FIG)
        self.assertEqual(item["source"], "fig")
        self.assertEqual(item["src"], FIG)
        self.assertEqual(item["alt"], SETIMG)

    def test_fallback_to_set_when_no_fig(self):
        item = {"set_num": "71002-1", "src": SETIMG}
        fetch_data.plan_figure_source(item, None)
        self.assertEqual(item["source"], "set")
        self.assertEqual(item["src"], SETIMG)

    def test_fallback_when_fig_url_not_allowed(self):
        item = {"set_num": "71002-1", "src": SETIMG}
        fetch_data.plan_figure_source(item, "https://evil.example/x.jpg")
        self.assertEqual(item["source"], "set")
        self.assertEqual(item["src"], SETIMG)

    def test_no_set_image_uses_fig(self):
        item = {"set_num": "71002-1", "src": ""}
        fetch_data.plan_figure_source(item, FIG)
        self.assertEqual((item["source"], item["src"]), ("fig", FIG))

    def test_neither(self):
        item = {"set_num": "71002-1", "src": ""}
        fetch_data.plan_figure_source(item, None)
        self.assertEqual(item["source"], "set")
        self.assertFalse(item["src"])


class LocalPathTest(unittest.TestCase):
    def test_fig_name_differs(self):
        a = fetch_data.local_path("71002", "71002-1", FIG)
        b = fetch_data.local_path("71002", "71002-1", FIG, fig=True)
        self.assertEqual(a.name, "71002-1.jpg")
        self.assertEqual(b.name, "71002-1.fig.jpg")
        self.assertEqual(a.parent, b.parent)

    def test_fig_still_validated(self):
        with self.assertRaises(ValueError):
            fetch_data.local_path("..", "71002-1", FIG, fig=True)
        with self.assertRaises(ValueError):
            fetch_data.local_path("71002", "../x-1", FIG, fig=True)


class TrimPadTest(unittest.TestCase):
    def test_trim_and_pad(self):
        out = process_images.trim_and_pad(grey_with_block())
        w, h = out.size
        self.assertAlmostEqual(w / h, 0.75, delta=0.01)
        self.assertEqual(out.getpixel((0, 0)), GREY)  # padding uses the photo background
        self.assertEqual(out.getpixel((w - 1, h - 1)), GREY)
        self.assertEqual(out.getpixel((w // 2, h // 2)), RED)  # figure kept, not cut out
        self.assertLess(h, 300)  # uniform border trimmed

    def test_uniform_image(self):
        out = process_images.trim_and_pad(Image.new("RGB", (100, 100), GREY))
        self.assertAlmostEqual(out.size[0] / out.size[1], 0.75, delta=0.02)

    def test_figure_max_height(self):
        out = process_images.prepare_figure(grey_with_block((2000, 3000), (500, 500, 1500, 2800)), 900)
        self.assertLessEqual(out.size[1], 900)

    def test_group_only_resized(self):
        im = grey_with_block((3600, 1200), (100, 100, 3000, 900), bg=(255, 255, 255))
        out = process_images.prepare_group(im, 1800)
        self.assertEqual(out.size, (1800, 600))
        self.assertEqual(out.getpixel((0, 0)), (255, 255, 255))
        self.assertEqual(out.getpixel((900, 300)), RED)
        small = process_images.prepare_group(Image.new("RGB", (800, 400), "white"), 1800)
        self.assertEqual(small.size, (800, 400))

    def test_no_rembg_import(self):
        self.assertNotIn("rembg", sys.modules)


class ProcessFileTest(unittest.TestCase):
    def test_figure_and_group_opaque_webp(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "in.png"
            grey_with_block().save(src)
            for kind in ("figure", "group"):
                dest = Path(d) / f"{kind}.webp"
                process_images.process_file(src, dest, kind)
                with Image.open(dest) as im:
                    self.assertEqual(im.format, "WEBP")
                    self.assertNotIn("A", im.getbands())


class RebuildTest(unittest.TestCase):
    def run_all(self, d, rebuild, dest_mtime, orig_mtime):
        site = Path(d) / "site"
        orig = Path(d) / "o.png"
        orig.write_bytes(b"x")
        dest = site / "img" / "71002" / "71002-1.webp"
        dest.parent.mkdir(parents=True)
        dest.write_bytes(b"old")
        os.utime(orig, (orig_mtime, orig_mtime))
        os.utime(dest, (dest_mtime, dest_mtime))
        item = {"set_num": "71002-1", "orig": orig}
        cat = [{"id": "71002", "bag": None, "group": None, "figures": [item]}]
        with mock.patch.object(fetch_data, "SITE", site), \
                mock.patch.object(fetch_data, "IMG", site / "img"), \
                mock.patch.object(process_images, "safe_process_file", return_value=True) as p:
            fetch_data.process_all(cat, rebuild=rebuild)
        return p.call_count

    def test_skip_existing_by_default(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(self.run_all(d, False, 2_000_000_000, 1_000_000_000), 0)

    def test_rebuild_reprocesses(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(self.run_all(d, True, 2_000_000_000, 1_000_000_000), 1)

    def test_newer_original_reprocesses(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(self.run_all(d, False, 1_000_000_000, 2_000_000_000), 1)


def _rows(with_second=False):
    sets = [{"set_num": "71002-1", "name": "Barbarian", "year": "2010",
             "theme_id": "1", "img_url": SETIMG}]
    if with_second:
        sets.append({"set_num": "71002-2", "name": "Other", "year": "2010",
                     "theme_id": "1", "img_url": SETIMG.replace("-1", "-2")})
    return {
        "themes": [{"id": "1", "parent_id": "535", "name": "Series X"}],
        "sets": sets,
        "inventories": [{"id": "9", "set_num": "71002-1"}],
        "inventory_minifigs": [{"inventory_id": "9", "fig_num": "fig-000961"}],
        "minifigs": [{"fig_num": "fig-000961", "img_url": FIG}],
    }


class MainTest(unittest.TestCase):
    def run_main(self, root, rows, fake_get, argv=()):
        with mock.patch.object(fetch_data, "ROOT", root), \
                mock.patch.object(fetch_data, "SITE", root / "site"), \
                mock.patch.object(fetch_data, "ORIG", root / "originals"), \
                mock.patch.object(fetch_data, "IMG", root / "site" / "img"), \
                mock.patch.object(fetch_data, "load_csv", side_effect=lambda n: rows[n]), \
                mock.patch.object(fetch_data, "http_get", side_effect=fake_get):
            code = fetch_data.main(list(argv))
        return code, json.loads((root / "site" / "data.json").read_text(encoding="utf-8"))

    def png(self, root):
        p = root / "p.png"
        grey_with_block().save(p)
        return p.read_bytes()

    def test_parse_rebuild_flag(self):
        self.assertTrue(fetch_data.parse_args(["--rebuild"]).rebuild)
        self.assertFalse(fetch_data.parse_args([]).rebuild)

    def test_src_field_and_priority(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "site").mkdir()
            data = self.png(root)
            fetched = []

            def fake_get(url, *a, **k):
                fetched.append(url)
                return data

            code, cat = self.run_main(root, _rows(True), fake_get)
            self.assertEqual(code, 0)
            figs = {f["set_num"]: f for f in cat[0]["figures"]}
            self.assertEqual(figs["71002-1"]["src"], "fig")
            self.assertEqual(figs["71002-2"]["src"], "set")
            self.assertTrue((root / "originals" / "71002" / "71002-1.fig.jpg").exists())
            self.assertTrue((root / "originals" / "71002" / "71002-2.jpg").exists())
            self.assertIn(FIG, fetched)
            self.assertNotIn(SETIMG, fetched)

    def test_fig_download_failure_falls_back_to_set(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "site").mkdir()
            data = self.png(root)
            _, cat = self.run_main(root, _rows(), lambda url, *a, **k: None if url == FIG else data)
            f = cat[0]["figures"][0]
            self.assertEqual(f["src"], "set")
            self.assertTrue(f["img"])
            self.assertTrue((root / "originals" / "71002" / "71002-1.jpg").exists())

    def test_rebuild_flag_reprocesses_all(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "site").mkdir()
            data = self.png(root)
            self.run_main(root, _rows(), lambda *a, **k: data)
            webp = root / "site" / "img" / "71002" / "71002-1.webp"
            os.utime(webp, (2_000_000_000, 2_000_000_000))
            with mock.patch.object(process_images, "safe_process_file", return_value=True) as p:
                self.run_main(root, _rows(), lambda *a, **k: data)
                self.assertEqual(p.call_count, 0)
                self.run_main(root, _rows(), lambda *a, **k: data, ["--rebuild"])
                self.assertEqual(p.call_count, 1)


if __name__ == "__main__":
    unittest.main()
