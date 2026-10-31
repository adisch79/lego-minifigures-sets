"""Input validation tests for E7-02 (no network). Run: python -m unittest discover tests"""

import json
import sys
import unittest
import urllib.error
import urllib.request
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
            with self.subTest(url=url), mock.patch.object(fetch_data.OPENER, "open") as m:
                with self.assertRaises(ValueError):
                    fetch_data.http_get(url)
                m.assert_not_called()

    def test_allowed_url_fetched(self):
        with mock.patch.object(fetch_data.OPENER, "open", return_value=Resp(b"ok", GOOD)):
            self.assertEqual(fetch_data.http_get(GOOD), b"ok")

    def test_redirect_to_other_host_rejected(self):
        with mock.patch.object(fetch_data.OPENER, "open", return_value=Resp(b"ok", "https://evil.com/a")):
            with self.assertRaises(ValueError):
                fetch_data.http_get(GOOD)


class RedirectTest(unittest.TestCase):
    def _redirect(self, newurl):
        h = fetch_data._CheckedRedirect()
        req = urllib.request.Request(GOOD)
        return h.redirect_request(req, None, 302, "Found", {}, newurl)

    def test_off_host_and_downgrade_rejected(self):
        for url in ("https://evil.com/a.jpg", "http://cdn.rebrickable.com/a.jpg", "file:///etc/passwd"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                self._redirect(url)

    def test_allowed_redirect_ok(self):
        self.assertIsNotNone(self._redirect("https://cdn.rebrickable.com/b.jpg"))


class TruncationTest(unittest.TestCase):
    def test_truncated_is_retried(self):
        bad = Resp(b"abc", GOOD)
        bad.headers = {"Content-Length": "10"}
        m = mock.Mock(side_effect=[bad, Resp(b"ok", GOOD)])
        with mock.patch.object(fetch_data.OPENER, "open", m), mock.patch("time.sleep"):
            self.assertEqual(fetch_data.http_get(GOOD), b"ok")
        self.assertEqual(m.call_count, 2)

    def test_truncated_final_raises(self):
        bad = Resp(b"abc", GOOD)
        bad.headers = {"Content-Length": "10"}
        with mock.patch.object(fetch_data.OPENER, "open", return_value=bad), mock.patch("time.sleep"):
            with self.assertRaises(urllib.error.URLError):
                fetch_data.http_get(GOOD, retries=2)


class SizeCapTest(unittest.TestCase):
    def test_over_cap_fails(self):
        with mock.patch.object(fetch_data.OPENER, "open", return_value=Resp(b"x" * 11, GOOD)):
            with self.assertRaises(ValueError):
                fetch_data.http_get(GOOD, max_bytes=10)

    def test_at_cap_ok(self):
        with mock.patch.object(fetch_data.OPENER, "open", return_value=Resp(b"x" * 10, GOOD)):
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

    def test_unicode_digits_rejected(self):
        self.assertFalse(fetch_data.valid_set_num("71053-١"))

    def test_windows_reserved_series_rejected(self):
        for v in ("CON", "nul", "Com1", "LPT9", "aux", "PRN"):
            with self.subTest(v=v), self.assertRaises(ValueError):
                fetch_data.local_path(v, "1-1", GOOD)

    def test_malformed_row_does_not_crash(self):
        themes = [{"id": "1", "parent_id": "535", "name": "T"}]
        sets = [{"set_num": None, "name": "A", "theme_id": "1", "year": "2020", "img_url": GOOD},
                {"set_num": "5-1", "name": "B", "theme_id": "1", "year": "2020", "img_url": GOOD}]
        cat = fetch_data.build_catalog(themes, sets)
        self.assertEqual(len(cat[0]["figures"]), 1)

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
