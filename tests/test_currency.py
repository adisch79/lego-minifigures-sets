"""Offline tests for scripts/currency.py. Run: python -m unittest discover tests (or pytest)."""

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


if __name__ == "__main__":
    unittest.main()
