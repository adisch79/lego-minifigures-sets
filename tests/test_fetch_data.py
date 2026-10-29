"""Unit tests for build_catalog (no network). Run: python -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from fetch_data import build_catalog, minifig_images  # noqa: E402


def s(set_num, name, theme="618", year="2017", img=None):
    return {"set_num": set_num, "name": name, "year": year, "theme_id": theme,
            "num_parts": "5", "img_url": img if img is not None else f"https://x/{set_num}.jpg"}


THEMES = [
    {"id": "535", "name": "Collectible Minifigures", "parent_id": ""},
    {"id": "618", "name": "The LEGO Ninjago Movie", "parent_id": "535"},
    {"id": "536", "name": "Series 1 Minifigures", "parent_id": "535"},
    {"id": "999", "name": "Empty", "parent_id": "535"},
    {"id": "1", "name": "Technic", "parent_id": ""},
]
SETS = [
    s("71019-0", "The LEGO Ninjago Movie - Random Bag"),
    s("71019-2", "Spinjitzu Training Nya"),
    s("71019-10", "Zane"),
    s("71019-1", "Kai Kendo"),
    s("71019-21", "The LEGO Ninjago Movie - Complete - All Sets"),
    s("71019-22", "The LEGO Ninjago Movie - Sealed Box"),
    s("71019-23", "4614581-1"),
    s("6175016-1", "The LEGO Ninjago Movie - Sealed Box"),
    s("66667-1", "Ninjago - 6 Pack"),
    s("8683-0", "Series 1 - Random Bag", theme="536", year="2010"),
    s("8683-1", "Zombie", theme="536", year="2010", img=""),
    s("8683-17", "Series 1 - Complete - All Sets", theme="536", year="2010"),
    s("42000-1", "Technic car", theme="1"),
]


class BuildCatalogTest(unittest.TestCase):
    def setUp(self):
        self.cat = build_catalog(THEMES, SETS)
        self.ninjago = next(c for c in self.cat if c["id"] == "71019")

    def test_only_cmf_series_with_figures(self):
        self.assertEqual([c["id"] for c in self.cat], ["71019", "8683"])

    def test_sorted_newest_first(self):
        self.assertEqual([c["year"] for c in self.cat], [2017, 2010])

    def test_bag_and_group_detected(self):
        self.assertEqual(self.ninjago["bag"]["set_num"], "71019-0")
        self.assertEqual(self.ninjago["group"]["set_num"], "71019-21")

    def test_figures_numeric_order_and_filtered(self):
        self.assertEqual([f["set_num"] for f in self.ninjago["figures"]],
                         ["71019-1", "71019-2", "71019-10"])

    def test_figure_without_image_kept(self):
        s1 = next(c for c in self.cat if c["id"] == "8683")
        self.assertEqual(s1["figures"][0]["src"], "")


class MinifigImagesTest(unittest.TestCase):
    def test_first_minifig_per_set(self):
        out = minifig_images(
            [{"id": "1", "set_num": "71053-6"}, {"id": "2", "set_num": "71053-7"}],
            [{"inventory_id": "1", "fig_num": "fig-a"}, {"inventory_id": "1", "fig_num": "fig-b"},
             {"inventory_id": "9", "fig_num": "fig-c"}],
            [{"fig_num": "fig-a", "img_url": "a.jpg"}, {"fig_num": "fig-b", "img_url": "b.jpg"}],
        )
        self.assertEqual(out, {"71053-6": "a.jpg"})


if __name__ == "__main__":
    unittest.main()
