"""Tests for scripts/build_catalog.py (no network). Run: python -m unittest discover tests"""

import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from build_catalog import build, derive_line, main  # noqa: E402


def fig(sn, n, name="F", src="fig", img=True):
    return {"set_num": f"{sn}-{n}", "name": name, "src": src,
            "img": f"img/{sn}/{sn}-{n}.webp" if img else None}


def ser(sn, name, year, nfig=2, bag=True):
    return {"id": sn, "name": name, "year": year,
            "bag": {"set_num": f"{sn}-0", "img": f"img/{sn}/{sn}-0.webp"} if bag else None,
            "group": None, "figures": [fig(sn, i + 1) for i in range(nfig)]}


class DeriveLine(unittest.TestCase):
    CASES = [
        ("Series 25 Minifigures", ("Series", 25)),
        ("Marvel Series 2", ("Marvel", 2)),
        ("Harry Potter and Fantastic Beasts Series 2", ("Harry Potter and Fantastic Beasts", 2)),
        ("The LEGO Batman Movie Series 1", ("The LEGO Batman Movie", 1)),
        ("DFB Minifigures", ("DFB", None)),
        ("Team GB", ("Team GB", None)),
        ("Spider-Man - Across the Spider-Verse", ("Spider-Man - Across the Spider-Verse", None)),
        ("Dungeons & Dragons", ("Dungeons & Dragons", None)),
    ]

    def test_cases(self):
        for name, want in self.CASES:
            with self.subTest(name):
                self.assertEqual(derive_line(name), want)


class Fixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.site = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        self.data = [ser("71001", "Series 10 Minifigures", 2013),
                     ser("71004", "The LEGO Movie", 2014),
                     ser("71005", "The Simpsons Series 1", 2014),
                     ser("71000", "Team GB", 2012, nfig=1)]
        for s in self.data:
            for p in [s["bag"]["img"]] + [f["img"] for f in s["figures"]]:
                f = self.site / p
                f.parent.mkdir(parents=True, exist_ok=True)
                f.write_bytes(b"x")
        self.data[0]["figures"][0]["src"] = "set"
        self.ov = {"series": {"71004": {"line": "The LEGO Movie", "seriesNo": 1, "source": "t"},
                              "71001": {"age": "5+", "bricklinkCode": "col10", "source": "t"}}}

    def test_fields_and_order(self):
        c = build(self.data, self.ov, self.site)
        self.assertEqual(c["version"], 2)
        self.assertEqual([s["id"] for s in c["series"]], ["71005", "71004", "71001", "71000"])
        s = {x["id"]: x for x in c["series"]}
        self.assertEqual((s["71001"]["line"], s["71001"]["seriesNo"]), ("Series", 10))
        self.assertEqual((s["71004"]["line"], s["71004"]["seriesNo"]), ("The LEGO Movie", 1))
        self.assertEqual((s["71005"]["line"], s["71005"]["seriesNo"]), ("The Simpsons", 1))
        self.assertEqual(s["71001"]["age"], "5+")
        self.assertIsNone(s["71005"]["age"])
        self.assertIsNone(s["71005"]["bricklinkCode"])
        self.assertEqual(s["71001"]["figureCount"], 2)
        self.assertEqual(s["71001"]["bag"], "img/71001/71001-0.webp")
        self.assertIsNone(s["71001"]["card"])
        self.assertTrue(s["71001"]["figures"][0]["imgFallback"])
        self.assertFalse(s["71001"]["figures"][1]["imgFallback"])
        self.assertEqual(s["71001"]["figures"][1]["no"], 2)
        self.assertNotIn("group", s["71001"])

    def test_missing_image_file_raises(self):
        (self.site / "img/71001/71001-1.webp").unlink()
        with self.assertRaises(ValueError):
            build(self.data, self.ov, self.site)

    def test_duplicate_figure_id_raises(self):
        self.data[1]["figures"][0]["set_num"] = "71001-1"
        with self.assertRaises(ValueError):
            build(self.data, self.ov, self.site)

    def test_figure_id_equals_series_id_raises(self):
        self.data[3]["figures"][0]["set_num"] = "71004"
        with self.assertRaises(ValueError):
            build(self.data, self.ov, self.site)

    def test_override_for_unknown_series_raises(self):
        self.ov["series"]["99999"] = {"age": "5+", "source": "t"}
        with self.assertRaises(ValueError):
            build(self.data, self.ov, self.site)

    def test_override_without_source_raises(self):
        del self.ov["series"]["71001"]["source"]
        with self.assertRaises(ValueError):
            build(self.data, self.ov, self.site)

    def test_bad_override_fields_raise(self):
        for key, bad in [("seriesNo", "1"), ("seriesNo", 1.5), ("age", "five"),
                         ("bricklinkCode", "Col10"), ("bricklinkCode", 5)]:
            with self.subTest(key=key, bad=bad):
                self.ov["series"]["71001"][key] = bad
                with self.assertRaises(ValueError):
                    build(self.data, self.ov, self.site)

    def test_null_image_allowed(self):
        self.data[0]["figures"][1]["img"] = None
        c = build(self.data, self.ov, self.site)
        self.assertIsNone(c["series"][2]["figures"][1]["img"])


# Series whose Rebrickable numbering has a known gap (Series 10 jumps 16 -> 19).
# The design asked for no gaps; real data has this one, so it is pinned here
# and any new gap fails the test.
KNOWN_GAPS = {"71001": [17, 18]}


class RealData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cat = json.loads((ROOT / "app/public/catalog.json").read_text(encoding="utf-8"))
        cls.by = {s["id"]: s for s in cls.cat["series"]}

    def test_totals(self):
        self.assertEqual(len(self.cat["series"]), 52)
        self.assertEqual(sum(len(s["figures"]) for s in self.cat["series"]), 787)
        self.assertEqual(sum(f["imgFallback"] for s in self.cat["series"] for f in s["figures"]), 19)

    def test_field_rules(self):
        fig_ids = set()
        for s in self.cat["series"]:
            self.assertRegex(s["id"], r"^\d{4,6}$")
            self.assertEqual(s["figureCount"], len(s["figures"]))
            self.assertIsInstance(s["year"], int)
            self.assertTrue(s["age"] is None or re.match(r"^\d+\+$", s["age"]))
            for f in s["figures"]:
                self.assertTrue(f["id"].startswith(s["id"] + "-"))
                self.assertNotIn(f["id"], fig_ids)
                self.assertNotIn(f["id"], self.by)
                fig_ids.add(f["id"])
                self.assertIsInstance(f["imgFallback"], bool)
        self.assertEqual(len(self.by), 52)

    def test_figure_numbers(self):
        for s in self.cat["series"]:
            nos = [f["no"] for f in s["figures"]]
            self.assertEqual(nos, sorted(set(nos)))
            self.assertEqual(nos, [int(f["id"].rsplit("-", 1)[1]) for f in s["figures"]])
            missing = [n for n in range(1, max(nos) + 1) if n not in nos]
            self.assertEqual(missing, KNOWN_GAPS.get(s["id"], []), s["id"])

    def test_images_exist(self):
        for s in self.cat["series"]:
            for p in [s["bag"]] + [f["img"] for f in s["figures"]]:
                if p:
                    self.assertTrue((ROOT / "site" / p).is_file(), p)

    def test_order(self):
        keys = [(-s["year"], -int(s["id"])) for s in self.cat["series"]]
        self.assertEqual(keys, sorted(keys))

    def test_line_series_no(self):
        want = {"71045": ("Series", 25), "71039": ("Marvel", 2), "71004": ("The LEGO Movie", 1),
                "71023": ("The LEGO Movie", 2), "71038": ("Disney 100", None),
                "71014": ("DFB", None), "8909": ("Team GB", None),
                "71047": ("Dungeons & Dragons", None)}
        for sid, v in want.items():
            self.assertEqual((self.by[sid]["line"], self.by[sid]["seriesNo"]), v, sid)
        by_name = {s["name"]: s for s in self.cat["series"]}
        hp = by_name["Harry Potter and Fantastic Beasts Series 2"]
        self.assertEqual((hp["line"], hp["seriesNo"]), ("Harry Potter and Fantastic Beasts", 2))
        bm = by_name["The LEGO Batman Movie Series 1"]
        self.assertEqual((bm["line"], bm["seriesNo"]), ("The LEGO Batman Movie", 1))
        sp = by_name["Spider-Man - Across the Spider-Verse"]
        self.assertEqual((sp["line"], sp["seriesNo"]), (sp["name"], None))

    def test_overrides_applied(self):
        self.assertEqual(self.by["71045"]["bricklinkCode"], "col25")
        self.assertEqual(self.by["71053"]["age"], "6+")
        self.assertEqual(sum(s["bricklinkCode"] is not None for s in self.cat["series"]), 52)

    def test_bricklink_no_override(self):
        figs = {f["id"]: f for f in self.by["71001"]["figures"]}
        self.assertEqual(figs["71001-19"]["bricklinkNo"], 17)
        self.assertEqual(sum("bricklinkNo" in f for s in self.cat["series"] for f in s["figures"]), 1)

    def test_bricklink_no_override_validation(self):
        d = [{"id": "71001", "name": "Series 10 Minifigures", "year": "2013", "bag": None,
              "figures": [{"set_num": "71001-5", "name": "A", "img": None}]}]
        out = build(d, {"series": {"71001": {"source": "t", "figures": {"71001-5": {"bricklinkNo": 5}}}}}, ROOT / "site")
        self.assertNotIn("bricklinkNo", out["series"][0]["figures"][0])
        for bad in ({"71001-9": {"bricklinkNo": 2}}, {"71001-5": {"bricklinkNo": "x"}}):
            with self.assertRaises(ValueError):
                build(d, {"series": {"71001": {"source": "t", "figures": bad}}}, ROOT / "site")

    def test_deterministic(self):
        with tempfile.TemporaryDirectory() as t:
            a, b = Path(t) / "a.json", Path(t) / "b.json"
            main(a)
            main(b)
            self.assertEqual(a.read_bytes(), b.read_bytes())
            self.assertEqual(a.read_bytes(), (ROOT / "app/public/catalog.json").read_bytes())


if __name__ == "__main__":
    unittest.main()
