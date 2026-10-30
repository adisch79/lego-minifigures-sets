"""Static checks for E7-04 (site robustness + a11y). Behaviour is covered by tests/manual_e7_04.md."""
import re
import unittest
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"


def read(name):
    return (SITE / name).read_text(encoding="utf-8")


class SiteStaticTests(unittest.TestCase):
    def test_favicon_in_both_pages(self):
        for page in ("index.html", "series.html"):
            self.assertRegex(read(page), r'<link rel="icon" href="data:image/svg\+xml,', page)

    def test_favicon_hash_encoded(self):
        for page in ("index.html", "series.html"):
            m = re.search(r'<link rel="icon" href="([^"]+)"', read(page))
            self.assertIsNotNone(m, page)
            self.assertNotIn("#", m.group(1), page)

    def test_reduced_motion(self):
        self.assertIn("prefers-reduced-motion", read("style.css"))
        s = read("series.html")
        self.assertGreaterEqual(s.count("prefers-reduced-motion"), 1)
        self.assertIn("matchMedia", s)

    def test_focus_visible(self):
        self.assertIn(":focus-visible", read("style.css"))

    def test_series_aria(self):
        s = read("series.html")
        for token in ("inert", "aria-current", "aria-live", "aria-roledescription", "ResizeObserver"):
            self.assertIn(token, s)

    def test_modifier_keys_ignored(self):
        s = read("series.html")
        for token in ("ctrlKey", "altKey", "metaKey", "shiftKey", "defaultPrevented"):
            self.assertIn(token, s)

    def test_no_unguarded_year(self):
        for page in ("index.html", "series.html"):
            self.assertNotIn("${s.year}", read(page), page)

    def test_no_innerhtml_with_catalog_strings(self):
        s = read("series.html")
        for line in s.splitlines():
            if "innerHTML" in line:
                self.assertNotIn("${", line)


if __name__ == "__main__":
    unittest.main()
