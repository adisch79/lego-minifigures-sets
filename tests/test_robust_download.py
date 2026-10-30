"""Tests for robust download/processing (no network). Run: python -m unittest discover tests"""

import io
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import fetch_data  # noqa: E402
import process_images  # noqa: E402


def png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buf, "PNG")
    return buf.getvalue()


class Resp:
    def __init__(self, data):
        self.data = data

    def read(self):
        return self.data

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def http_error(code, headers=None):
    return urllib.error.HTTPError("http://x", code, "err", headers or {}, None)


class HttpGetTest(unittest.TestCase):
    def test_404_returns_none(self):
        with mock.patch("urllib.request.urlopen", side_effect=http_error(404)):
            self.assertIsNone(fetch_data.http_get("http://x"))

    def test_other_4xx_not_retried(self):
        m = mock.Mock(side_effect=http_error(403))
        with mock.patch("urllib.request.urlopen", m), mock.patch("time.sleep"):
            with self.assertRaises(urllib.error.HTTPError):
                fetch_data.http_get("http://x")
        self.assertEqual(m.call_count, 1)

    def test_429_honours_retry_after_capped(self):
        m = mock.Mock(side_effect=[http_error(429, {"Retry-After": "5"}),
                                   http_error(429, {"Retry-After": "9999"}), Resp(b"ok")])
        with mock.patch("urllib.request.urlopen", m), mock.patch("time.sleep") as sl:
            self.assertEqual(fetch_data.http_get("http://x"), b"ok")
        self.assertEqual([c.args[0] for c in sl.call_args_list], [5, 60])

    def test_5xx_retried_then_raises(self):
        m = mock.Mock(side_effect=http_error(503))
        with mock.patch("urllib.request.urlopen", m), mock.patch("time.sleep"):
            with self.assertRaises(urllib.error.HTTPError):
                fetch_data.http_get("http://x", retries=3)
        self.assertEqual(m.call_count, 3)


class LoadCsvTest(unittest.TestCase):
    def test_none_raises_clear_error_and_no_file(self):
        with tempfile.TemporaryDirectory() as d, \
                mock.patch.object(fetch_data, "CACHE", Path(d)), \
                mock.patch.object(fetch_data, "http_get", return_value=None):
            with self.assertRaises(RuntimeError) as cm:
                fetch_data.load_csv("sets")
            self.assertIn("sets", str(cm.exception))
            self.assertEqual(list(Path(d).iterdir()), [])


class SuffixTest(unittest.TestCase):
    def test_numeric(self):
        self.assertEqual(fetch_data.suffix("71019-10"), 10)

    def test_non_numeric_does_not_raise(self):
        self.assertGreater(fetch_data.suffix("fig-abc"), 10 ** 6)
        self.assertGreater(fetch_data.suffix("nodash"), 10 ** 6)


class DownloadOneTest(unittest.TestCase):
    def run_job(self, d, data=None, exc=None):
        dest = Path(d) / "s" / "a-1.jpg"
        job = ({"src": "http://x/a.jpg"}, dest)
        with mock.patch.object(fetch_data, "http_get", return_value=data, side_effect=exc):
            return fetch_data.download_one(job)[0], dest

    def test_valid_image_saved_atomically(self):
        with tempfile.TemporaryDirectory() as d:
            status, dest = self.run_job(d, png_bytes())
            self.assertEqual(status, "ok")
            self.assertTrue(dest.exists())
            self.assertEqual([p.name for p in dest.parent.iterdir()], ["a-1.jpg"])

    def test_html_rejected_and_nothing_left(self):
        with tempfile.TemporaryDirectory() as d:
            status, dest = self.run_job(d, b"<html>rate limited</html>")
            self.assertEqual(status, "error")
            self.assertEqual(list(dest.parent.iterdir()), [])

    def test_exception_returns_error(self):
        with tempfile.TemporaryDirectory() as d:
            status, dest = self.run_job(d, exc=http_error(500))
            self.assertEqual(status, "error")
            self.assertFalse(dest.exists())

    def test_missing(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(self.run_job(d, None)[0], "missing")


class ProcessFileTest(unittest.TestCase):
    def test_atomic_save_leaves_no_tmp_and_no_corrupt_on_failure(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "in.png"
            src.write_bytes(png_bytes())
            dest = Path(d) / "out" / "a.webp"
            process_images.process_file(src, dest, "bag")
            self.assertEqual([p.name for p in dest.parent.iterdir()], ["a.webp"])
            Image.open(dest).verify()

            dest2 = Path(d) / "out" / "b.webp"
            with mock.patch.object(Image.Image, "save", side_effect=OSError("disk")):
                with self.assertRaises(OSError):
                    process_images.process_file(src, dest2, "bag")
            self.assertFalse(dest2.exists())
            self.assertEqual(sorted(p.name for p in dest.parent.iterdir()), ["a.webp"])

    def test_safe_process_logs_and_continues(self):
        with mock.patch.object(process_images, "process_file", side_effect=ValueError("bad")):
            self.assertFalse(process_images.safe_process_file("s", "d", "bag"))
        with mock.patch.object(process_images, "process_file"):
            self.assertTrue(process_images.safe_process_file("s", "d", "bag"))


if __name__ == "__main__":
    unittest.main()
