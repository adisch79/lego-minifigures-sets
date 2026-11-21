"""Convert a price to ILS using the Bank of Israel official daily representative rate.

Used by the daily price scraper. One fetch per run, cached to a local JSON file.
On fetch failure the last good cached rates are used and a warning is logged.
Weekends/holidays: BOI publishes no rate, so the latest published one is used
and its date is reported in `rate_date`.

Usage: python scripts/currency.py 19.99 USD cache/boi_rates.json
"""

import csv
import io
import json
import logging
import sys
import urllib.request
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

log = logging.getLogger("currency")

# SOURCE: https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0 (BOI SDMX EXR dataflow; verified live 2026-11-21)
BOI_BASE = "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0"
# SOURCE: BOI EXR series codes RER_<CCY>_ILS, confirmed in live CSV response 2026-11-21 (SERIES_CODE column)
SERIES = {"USD": "RER_USD_ILS", "EUR": "RER_EUR_ILS", "GBP": "RER_GBP_ILS"}
# SOURCE: BOI SDMX query syntax c[TIME_PERIOD]=ge:<date>&format=csv, verified live 2026-11-21 (HTTP 200)
LOOKBACK_DAYS = 14  # covers weekends and long holiday gaps
TIMEOUT_S = 30


class CurrencyError(Exception):
    pass


def source_url(since):
    series = "+".join(SERIES.values())
    return f"{BOI_BASE}/{series}?c%5BTIME_PERIOD%5D=ge:{since}&format=csv"


def fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "minifigures-extractor/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
        return resp.read().decode("utf-8-sig")


def parse_boi_csv(text):
    """Return {CCY: {"rate": str, "date": "YYYY-MM-DD"}} with the latest observation per currency."""
    by_series = {code: ccy for ccy, code in SERIES.items()}
    latest = {}
    for row in csv.DictReader(io.StringIO(text)):
        ccy = by_series.get(row.get("SERIES_CODE"))
        if not ccy or not row.get("OBS_VALUE"):
            continue
        d = row["TIME_PERIOD"]
        if ccy not in latest or d > latest[ccy]["date"]:
            latest[ccy] = {"rate": row["OBS_VALUE"], "date": d}
    if not latest:
        raise CurrencyError("no rates found in BOI response")
    return latest


def _load_cache(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return data if isinstance(data, dict) and "rates" in data else None
    except (OSError, ValueError):
        return None


def get_rates(cache_path, today=None):
    """Return (rates, source_url). Fetch at most once per day; fall back to cache on failure."""
    today = today or date.today().isoformat()
    cached = _load_cache(cache_path)
    if cached and cached.get("fetched_on") == today:
        return cached["rates"], cached["source_url"]
    since = (date.fromisoformat(today) - timedelta(days=LOOKBACK_DAYS)).isoformat()
    url = source_url(since)
    try:
        rates = parse_boi_csv(fetch_text(url))
    except (OSError, ValueError, CurrencyError) as exc:
        if not cached:
            raise CurrencyError(f"BOI fetch failed and no cache: {exc}") from exc
        oldest = min(r["date"] for r in cached["rates"].values())
        log.warning("BOI fetch failed (%s); using cached rates dated %s", exc, oldest)
        return cached["rates"], cached["source_url"]
    out = {"fetched_on": today, "source_url": url, "rates": rates}
    p = Path(cache_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, indent=2), encoding="utf-8")
    return rates, url


def convert(amount, currency, cache_path, today=None):
    """Convert `amount` in `currency` to ILS. Returns a dict of strings (no float drift)."""
    ccy = currency.upper()
    amt = Decimal(str(amount))
    if ccy == "ILS":
        return {"original_amount": str(amount), "original_currency": "ILS",
                "ils_amount": str(amt.quantize(Decimal("0.01"), ROUND_HALF_UP)),
                "rate": "1", "rate_date": today or date.today().isoformat(),
                "rate_source_url": BOI_BASE}
    if ccy not in SERIES:
        raise CurrencyError(f"unsupported currency: {currency}")
    rates, url = get_rates(cache_path, today)
    if ccy not in rates:
        raise CurrencyError(f"no rate for {ccy}")
    r = rates[ccy]
    ils = (amt * Decimal(r["rate"])).quantize(Decimal("0.01"), ROUND_HALF_UP)
    return {"original_amount": str(amount), "original_currency": ccy,
            "ils_amount": str(ils), "rate": r["rate"], "rate_date": r["date"],
            "rate_source_url": url}


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    if len(sys.argv) != 4:
        sys.exit("usage: currency.py AMOUNT CURRENCY CACHE_PATH")
    print(json.dumps(convert(sys.argv[1], sys.argv[2], sys.argv[3]), indent=2))
