"""Input validation tests for E7-02 (no network). Run: python -m unittest discover tests"""

import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import fetch_data  # noqa: E402
from test_robust_download import Resp  # noqa: E402

GOOD = "https://cdn.rebrickable.com/media/sets/71053-1.jpg"


class UrlAllowlistTest(unittest.TestCase):
    def test_rejected_urls_never_fetched(self):
        bad = ["file:///etc/passwd", "ftp://cdn.rebrickable.com/a.jpg",
               "http://cdn.rebrickable.com/a.jpg", "https://evil.com/a.jpg",
               "https://cdn.rebrickable.com.evil.com/a.jpg",
               "https://cdn.rebrickable.com@evil.com/a.jpg", "", "//cdn.rebrickable.com/a"]
        for url in bad:
            with self.subTest(url=url), mock.patch("urllib.request.urlopen") as m:
                with self.assertRaises(ValueError):
                    fetch_data.http_get(url)
                m.assert_not_called()

    def test_allowed_url_fetched(self):
        with mock.patch("urllib.request.urlopen", return_value=Resp(b"ok", GOOD)):
            self.assertEqual(fetch_data.http_get(GOOD), b"ok")

    def test_redirect_to_other_host_rejected(self):
        with mock.patch("urllib.request.urlopen", return_value=Resp(b"ok", "https://evil.com/a")):
            with self.assertRaises(ValueError):
                fetch_data.http_get(GOOD)


class SizeCapTest(unittest.TestCase):
    def test_over_cap_fails(self):
        with mock.patch("urllib.request.urlopen", return_value=Resp(b"x" * 11, GOOD)):
            with self.assertRaises(ValueError):
                fetch_data.http_get(GOOD, max_bytes=10)

    def test_at_cap_ok(self):
        with mock.patch("urllib.request.urlopen", return_value=Resp(b"x" * 10, GOOD)):
            self.assertEqual(len(fetch_data.http_get(GOOD, max_bytes=10)), 10)

    def test_defaults(self):
        self.assertEqual(fetch_data.MAX_IMAGE_BYTES, 20 * 1024 * 1024)
        self.assertEqual(fetch_data.MAX_CSV_BYTES, 100 * 1024 * 1024)


class IdAndPathTest(unittest.TestCase):
    def test_valid_ids(self):
        for v in ("71053-1", "col01-3", "fig-012345", "8683-16"):
            self.assertTrue(fetch_data.valid_set_num(v), v)

    def test_invalid_ids(self):
        for v in ("../x-1", "a/b-1", "a\b-1", "71053", "71053-", "-1", "a-1/../b", "a-1\n", ""):
            self.assertFalse(fetch_data.valid_set_num(v), v)

    def test_ext_allowlist(self):
        lp = fetch_data.local_path
        self.assertEqual(lp("1", "1-1", "https://cdn.rebrickable.com/a.PNG").suffix, ".png")
        self.assertEqual(lp("1", "1-1", "https://cdn.rebrickable.com/a.exe").suffix, ".jpg")
        self.assertEqual(lp("1", "1-1", "https://cdn.rebrickable.com/a").suffix, ".jpg")

    def test_local_path_rejects_traversal(self):
        with self.assertRaises(ValueError):
            fetch_data.local_path("..", "x-1", "https://cdn.rebrickable.com/a.jpg")
        with self.assertRaises(ValueError):
            fetch_data.local_path("1", "../../x-1", "https://cdn.rebrickable.com/a.jpg")

    def test_local_path_inside_originals(self):
        p = fetch_data.local_path("71053", "71053-1", GOOD)
        self.assertTrue(p.resolve().is_relative_to(fetch_data.ORIG.resolve()))

    def test_catalog_drops_bad_rows(self):
        themes = [{"id": "1", "parent_id": "535", "name": "T"}]
        sets = [{"set_num": "../evil-1", "name": "A", "theme_id": "1", "year": "2020", "img_url": GOOD},
                {"set_num": "5-1", "name": "B", "theme_id": "1", "year": "2020", "img_url": GOOD},
                {"set_num": "5-2", "name": "C", "theme_id": "1", "year": "2020", "img_url": GOOD}]
        cat = fetch_data.build_catalog(themes, sets)
        self.assertEqual([f["set_num"] for f in cat[0]["figures"]], ["5-1", "5-2"])

    def test_existing_site_data_validates(self):
        data = json.loads((Path(__file__).resolve().parent.parent / "site" / "data.json")
                          .read_text(encoding="utf-8"))
        self.assertTrue(data)
        for s in data:
            self.assertRegex(s["id"], r"[A-Za-z0-9]+")
            for item in (s["bag"], s["group"], *s["figures"]):
                if item:
                    self.assertTrue(fetch_data.valid_set_num(item["set_num"]), item["set_num"])


if __name__ == "__main__":
    unittest.main()
