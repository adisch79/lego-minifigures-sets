"""Offline tests for scripts/currency.py. Run: python -m unittest discover tests (or pytest)."""

import http.client
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import currency  # noqa: E402

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "boi_exr_sample.csv"


def fixture_text():
    return FIXTURE.read_text(encoding="utf-8")


class ParseTests(unittest.TestCase):
    def test_parse_latest_per_currency(self):
        rates = currency.parse_boi_csv(fixture_text())
        self.assertEqual(set(rates), {"USD", "EUR", "GBP"})
        self.assertEqual(rates["USD"]["date"], "2026-11-20")
        self.assertEqual(rates["USD"]["rate"], "3.326")

    def test_parse_empty_raises(self):
        with self.assertRaises(currency.CurrencyError):
            currency.parse_boi_csv("")


class ConvertTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cache = Path(self.tmp.name) / "rates.json"

    def test_conversion_math_and_fields(self):
        with mock.patch.object(currency, "fetch_text", return_value=fixture_text()):
            out = currency.convert("10.00", "USD", self.cache, today="2026-11-21")
        self.assertEqual(out["original_amount"], "10.00")
        self.assertEqual(out["original_currency"], "USD")
        self.assertEqual(out["ils_amount"], "33.26")
        self.assertEqual(out["rate"], "3.326")
        self.assertEqual(out["rate_date"], "2026-11-20")  # Saturday: last published
        self.assertTrue(out["rate_source_url"].startswith("https://edge.boi.gov.il/"))

    def test_rounding_two_decimals_half_up(self):
        rates = {"USD": {"rate": "3.333", "date": "2026-11-20"}}
        self.cache.write_text(json.dumps(
            {"fetched_on": "2026-11-21", "source_url": "https://x", "rates": rates}))
        out = currency.convert("0.15", "USD", self.cache, today="2026-11-21")
        self.assertEqual(out["ils_amount"], "0.50")  # 0.49995 -> 0.50

    def test_ils_passthrough(self):
        out = currency.convert("5", "ILS", self.cache, today="2026-11-21")
        self.assertEqual(out["ils_amount"], "5.00")
        self.assertEqual(out["rate"], "1")

    def test_cache_hit_no_refetch(self):
        with mock.patch.object(currency, "fetch_text", return_value=fixture_text()) as f:
            currency.convert("1", "USD", self.cache, today="2026-11-21")
            currency.convert("1", "EUR", self.cache, today="2026-11-21")
        self.assertEqual(f.call_count, 1)

    def test_next_day_refetches(self):
        with mock.patch.object(currency, "fetch_text", return_value=fixture_text()) as f:
            currency.convert("1", "USD", self.cache, today="2026-11-21")
            currency.convert("1", "USD", self.cache, today="2026-11-22")
        self.assertEqual(f.call_count, 2)

    def test_fetch_failure_uses_last_good_cache(self):
        with mock.patch.object(currency, "fetch_text", return_value=fixture_text()):
            currency.convert("1", "USD", self.cache, today="2026-11-21")
        with mock.patch.object(currency, "fetch_text", side_effect=OSError("down")):
            with self.assertLogs("currency", level="WARNING") as logs:
                out = currency.convert("10", "USD", self.cache, today="2026-11-25")
        self.assertEqual(out["rate_date"], "2026-11-20")
        self.assertIn("2026-11-20", "\n".join(logs.output))

    def test_fetch_failure_no_cache_raises(self):
        with mock.patch.object(currency, "fetch_text", side_effect=OSError("down")):
            with self.assertRaises(currency.CurrencyError):
                currency.convert("1", "USD", self.cache, today="2026-11-21")

    def test_unknown_currency(self):
        with mock.patch.object(currency, "fetch_text", return_value=fixture_text()):
            with self.assertRaises(currency.CurrencyError):
                currency.convert("1", "XYZ", self.cache, today="2026-11-21")


HEADER = ("SERIES_CODE,FREQ,BASE_CURRENCY,COUNTER_CURRENCY,UNIT_MEASURE,DATA_TYPE,DATA_SOURCE,"
          "TIME_COLLECT,CONF_STATUS,PUB_WEBSITE,UNIT_MULT,COMMENTS,TIME_PERIOD,OBS_VALUE,RELEASE_STATUS\n")


def csv_rows(*rows):
    """rows: (ccy, date, value) tuples -> BOI-shaped CSV text."""
    return HEADER + "".join(
        f"RER_{c}_ILS,D,{c},ILS,ILS,OF00,BOI_MRKT,V,F,Y,0,,{d},{v},YP\n" for c, d, v in rows)


def good_cache(fetched_on="2026-11-21", rate_date="2026-11-20"):
    return {"fetched_on": fetched_on, "source_url": "https://x",
            "rates": {"USD": {"rate": "3.326", "date": rate_date}}}


class HardeningTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cache = Path(self.tmp.name) / "rates.json"

    def run_convert(self, amount, ccy, today="2026-11-21", text=None):
        with mock.patch.object(currency, "fetch_text", return_value=text or fixture_text()):
            return currency.convert(amount, ccy, self.cache, today=today)

    def test_eur_and_gbp(self):
        rates = currency.parse_boi_csv(fixture_text())
        for ccy in ("EUR", "GBP"):
            out = self.run_convert("10", ccy)
            self.assertEqual(out["original_currency"], ccy)
            self.assertEqual(out["rate"], rates[ccy]["rate"])
            self.assertEqual(out["stale"], "false")

    def test_bad_amounts(self):
        for bad in ("-1", "abc", "NaN", "Infinity", None, ""):
            for ccy in ("USD", "ILS"):
                with self.subTest(amount=bad, ccy=ccy):
                    with self.assertRaises(currency.CurrencyError):
                        self.run_convert(bad, ccy)

    def test_bad_currency(self):
        for bad in (None, 5):
            with self.assertRaises(currency.CurrencyError):
                self.run_convert("1", bad)

    def test_lowercase_currency(self):
        self.assertEqual(self.run_convert("10.00", "usd")["original_currency"], "USD")

    def test_nested_missing_cache_dir(self):
        self.cache = Path(self.tmp.name) / "a" / "b" / "rates.json"
        self.run_convert("1", "USD")
        self.assertTrue(self.cache.exists())

    def test_corrupt_cache_treated_as_none(self):
        self.cache.write_text("{not json", encoding="utf-8")
        self.assertIsNone(currency._load_cache(self.cache))
        self.assertEqual(self.run_convert("10.00", "USD")["ils_amount"], "33.26")

    def test_bad_cache_shapes_rejected(self):
        bad = [
            {**good_cache(), "rates": {}},
            {**good_cache(), "rates": []},
            {**good_cache(), "rates": {"USD": {"rate": 3.3, "date": "2026-11-20"}}},
            {**good_cache(), "rates": {"USD": {"rate": "3.3"}}},
            {**good_cache(), "rates": {"USD": {"rate": "abc", "date": "2026-11-20"}}},
            {**good_cache(), "rates": {"USD": {"rate": "3.3", "date": "nope"}}},
            {**good_cache(), "fetched_on": 5},
            {**good_cache(), "source_url": None},
        ]
        for data in bad:
            with self.subTest(data=data):
                self.cache.write_text(json.dumps(data), encoding="utf-8")
                self.assertIsNone(currency._load_cache(self.cache))

    def test_good_cache_shape_accepted(self):
        self.cache.write_text(json.dumps(good_cache()), encoding="utf-8")
        self.assertIsNotNone(currency._load_cache(self.cache))

    def test_partial_response_raises(self):
        text = csv_rows(("USD", "2026-11-20", "3.3"), ("EUR", "2026-11-20", "3.9"))
        with self.assertRaises(currency.CurrencyError):
            currency.parse_boi_csv(text)

    def test_partial_response_not_cached_and_falls_back(self):
        self.cache.write_text(json.dumps(good_cache("2026-11-20")), encoding="utf-8")
        text = csv_rows(("USD", "2026-11-21", "9.9"))
        with self.assertLogs("currency", level="WARNING"):
            out = self.run_convert("10", "USD", text=text)
        self.assertEqual(out["rate"], "3.326")
        self.assertEqual(out["stale"], "true")
        self.assertEqual(json.loads(self.cache.read_text())["fetched_on"], "2026-11-20")

    def test_bad_obs_value_raises(self):
        for bad in ("abc", "NaN", "0", "-3.3", "Infinity"):
            with self.subTest(value=bad):
                text = csv_rows(("USD", "2026-11-20", bad), ("EUR", "2026-11-20", "3.9"),
                                ("GBP", "2026-11-20", "4.4"))
                with self.assertRaises(currency.CurrencyError):
                    currency.parse_boi_csv(text)

    def test_stale_within_limit_flagged(self):
        self.cache.write_text(json.dumps(good_cache("2026-11-20", "2026-11-20")), encoding="utf-8")
        with mock.patch.object(currency, "fetch_text", side_effect=OSError("down")):
            with self.assertLogs("currency", level="WARNING"):
                out = currency.convert("1", "USD", self.cache, today="2026-11-27")
        self.assertEqual(out["stale"], "true")

    def test_stale_beyond_limit_raises(self):
        self.cache.write_text(json.dumps(good_cache("2026-11-20", "2026-11-20")), encoding="utf-8")
        with mock.patch.object(currency, "fetch_text", side_effect=OSError("down")):
            with self.assertRaises(currency.CurrencyError):
                currency.convert("1", "USD", self.cache, today="2026-11-28")

    def test_http_and_csv_errors_fall_back(self):
        for exc in (http.client.IncompleteRead(b""), http.client.RemoteDisconnected("x")):
            self.cache.write_text(json.dumps(good_cache("2026-11-20")), encoding="utf-8")
            with mock.patch.object(currency, "fetch_text", side_effect=exc):
                with self.assertLogs("currency", level="WARNING"):
                    out = currency.convert("1", "USD", self.cache, today="2026-11-21")
            self.assertEqual(out["stale"], "true")
        import csv
        self.cache.write_text(json.dumps(good_cache("2026-11-20")), encoding="utf-8")
        with mock.patch.object(currency, "fetch_text", return_value=fixture_text()),                 mock.patch.object(currency.csv, "DictReader", side_effect=csv.Error("bad")):
            with self.assertLogs("currency", level="WARNING"):
                out = currency.convert("1", "USD", self.cache, today="2026-11-21")
        self.assertEqual(out["stale"], "true")

    def test_cache_write_oserror_still_returns_rates(self):
        with mock.patch.object(currency.os, "replace", side_effect=OSError("disk")):
            with self.assertLogs("currency", level="WARNING"):
                out = self.run_convert("10.00", "USD")
        self.assertEqual(out["ils_amount"], "33.26")
        self.assertEqual(out["stale"], "false")
        self.assertEqual([p.name for p in Path(self.tmp.name).iterdir()], [])  # no temp leftovers

    def test_cli_error_exits_with_message(self):
        with mock.patch.object(sys, "argv", ["currency.py", "-1", "USD", str(self.cache)]):
            with self.assertRaises(SystemExit) as cm:
                currency.main()
        self.assertIsInstance(cm.exception.code, str)


if __name__ == "__main__":
    unittest.main()
