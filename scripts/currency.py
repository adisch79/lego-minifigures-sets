"""Convert a price to ILS using the Bank of Israel official daily representative rate.

Used by the daily price scraper. One fetch per run, cached to a local JSON file.
On fetch failure the last good cached rates are used (at most MAX_STALE_DAYS old,
otherwise an error) and a warning is logged; the result then carries stale="true".
Weekends/holidays: BOI publishes no rate, so the latest published one is used
and its date is reported in `rate_date`.

Usage: python scripts/currency.py 19.99 USD cache/boi_rates.json
"""

import argparse
import csv
import http.client
import io
import json
import logging
import os
import tempfile
import urllib.request
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path

log = logging.getLogger("currency")

# SOURCE: https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0 (BOI SDMX EXR dataflow; verified live 2026-11-21)
BOI_BASE = "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0"
# SOURCE: BOI EXR series codes RER_<CCY>_ILS, confirmed in live CSV response 2026-11-21 (SERIES_CODE column)
SERIES = {"USD": "RER_USD_ILS", "EUR": "RER_EUR_ILS", "GBP": "RER_GBP_ILS"}
# SOURCE: own default, 14 days spans weekends and long holiday gaps; query syntax c[TIME_PERIOD]=ge:<date>&format=csv verified live 2026-11-21 (HTTP 200)
LOOKBACK_DAYS = 14
# SOURCE: own default, generous for a small CSV over a slow link; a daily job can wait
TIMEOUT_S = 30
# SOURCE: own default, a week-old rate is still within normal ILS daily moves for a hobby price chip; logged in docs/decisions.md
MAX_STALE_DAYS = 7
# SOURCE: own default, identifies this project to the BOI server
USER_AGENT = "minifigures-extractor/1.0"
# SOURCE: ISO 4217 lists ILS with 2 minor-unit digits (100 agorot per shekel), so amounts round to 0.01
AGOROT = Decimal("0.01")


class CurrencyError(Exception):
    pass


def source_url(since):
    series = "+".join(SERIES.values())
    return f"{BOI_BASE}/{series}?c%5BTIME_PERIOD%5D=ge:{since}&format=csv"


def fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
        return resp.read().decode("utf-8-sig")


def _positive_decimal(value, what):
    """Parse `value` to a finite Decimal > 0, else raise CurrencyError."""
    try:
        d = Decimal(value)
    except (InvalidOperation, TypeError, ValueError):
        raise CurrencyError(f"invalid {what}: {value!r}") from None
    if not d.is_finite() or d <= 0:
        raise CurrencyError(f"invalid {what}: {value!r}")
    return d


def parse_boi_csv(text):
    """Return {CCY: {"rate": str, "date": "YYYY-MM-DD"}} with the latest observation per currency.

    Every currency in SERIES must be present, so a partial response is never cached.
    """
    by_series = {code: ccy for ccy, code in SERIES.items()}
    latest = {}
    for row in csv.DictReader(io.StringIO(text)):
        ccy = by_series.get(row.get("SERIES_CODE"))
        if not ccy or not row.get("OBS_VALUE"):
            continue
        _positive_decimal(row["OBS_VALUE"], "OBS_VALUE")
        d = row["TIME_PERIOD"]
        if ccy not in latest or d > latest[ccy]["date"]:
            latest[ccy] = {"rate": row["OBS_VALUE"], "date": d}
    missing = sorted(set(SERIES) - set(latest))
    if missing:
        raise CurrencyError(f"BOI response missing rates for: {', '.join(missing)}")
    return latest


def _valid_cache(data):
    if not isinstance(data, dict):
        return False
    if not isinstance(data.get("fetched_on"), str) or not isinstance(data.get("source_url"), str):
        return False
    rates = data.get("rates")
    if not isinstance(rates, dict) or not rates:
        return False
    for entry in rates.values():
        if not isinstance(entry, dict):
            return False
        if not isinstance(entry.get("rate"), str) or not isinstance(entry.get("date"), str):
            return False
        try:
            _positive_decimal(entry["rate"], "cached rate")
            date.fromisoformat(entry["date"])
        except (CurrencyError, ValueError):
            return False
    try:
        date.fromisoformat(data["fetched_on"])
    except ValueError:
        return False
    return True


def _load_cache(path):
    """Return the cache dict, or None if missing, unreadable or malformed."""
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if _valid_cache(data) else None


def _write_cache(path, out):
    """Atomic write: temp file in the same dir, then os.replace. Failure only logs a warning."""
    p = Path(path)
    tmp_name = None
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=p.parent,
                                         prefix=p.name + ".", suffix=".tmp", delete=False) as tmp:
            tmp_name = tmp.name
            tmp.write(json.dumps(out, indent=2))
        os.replace(tmp_name, p)
    except OSError as exc:
        log.warning("could not write rate cache %s: %s", p, exc)
        if tmp_name:
            try:
                os.unlink(tmp_name)
            except OSError:
                pass


def get_rates(cache_path, today=None):
    """Return (rates, source_url, stale). Fetch at most once per day; on failure fall back to a
    cache no older than MAX_STALE_DAYS (stale=True)."""
    today = today or date.today().isoformat()
    cached = _load_cache(cache_path)
    if cached and cached["fetched_on"] == today:
        return cached["rates"], cached["source_url"], False
    since = (date.fromisoformat(today) - timedelta(days=LOOKBACK_DAYS)).isoformat()
    url = source_url(since)
    try:
        rates = parse_boi_csv(fetch_text(url))
    except (OSError, ValueError, CurrencyError, http.client.HTTPException, csv.Error) as exc:
        if not cached:
            raise CurrencyError(f"BOI fetch failed and no cache: {exc}") from exc
        oldest = min(r["date"] for r in cached["rates"].values())
        age = (date.fromisoformat(today) - date.fromisoformat(oldest)).days
        if age > MAX_STALE_DAYS:
            raise CurrencyError(
                f"BOI fetch failed ({exc}) and cached rates dated {oldest} are older than "
                f"{MAX_STALE_DAYS} days") from exc
        log.warning("BOI fetch failed (%s); using cached rates dated %s", exc, oldest)
        return cached["rates"], cached["source_url"], True
    _write_cache(cache_path, {"fetched_on": today, "source_url": url, "rates": rates})
    return rates, url, False


def convert(amount, currency, cache_path, today=None):
    """Convert `amount` in `currency` to ILS. Returns a dict of strings (no float drift)."""
    if not isinstance(currency, str):
        raise CurrencyError(f"currency must be a string, got {currency!r}")
    ccy = currency.upper()
    try:
        amt = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError):
        raise CurrencyError(f"invalid amount: {amount!r}") from None
    if not amt.is_finite() or amt < 0:
        raise CurrencyError(f"amount must be finite and >= 0: {amount!r}")
    if ccy == "ILS":
        # No rate lookup happens, so rate_date is simply the conversion day.
        return {"original_amount": str(amount), "original_currency": "ILS",
                "ils_amount": str(amt.quantize(AGOROT, ROUND_HALF_UP)),
                "rate": "1", "rate_date": today or date.today().isoformat(),
                "rate_source_url": BOI_BASE, "stale": "false"}
    if ccy not in SERIES:
        raise CurrencyError(f"unsupported currency: {currency}")
    rates, url, stale = get_rates(cache_path, today)
    if ccy not in rates:
        raise CurrencyError(f"no rate for {ccy}")
    r = rates[ccy]
    ils = (amt * Decimal(r["rate"])).quantize(AGOROT, ROUND_HALF_UP)
    return {"original_amount": str(amount), "original_currency": ccy,
            "ils_amount": str(ils), "rate": r["rate"], "rate_date": r["date"],
            "rate_source_url": url, "stale": "true" if stale else "false"}


def main():
    ap = argparse.ArgumentParser(description="Convert a price to ILS using the BOI daily rate.")
    ap.add_argument("amount", help="amount, e.g. 19.99")
    ap.add_argument("currency", help="USD, EUR, GBP or ILS")
    ap.add_argument("cache_path", help="rate cache JSON file, e.g. cache/boi_rates.json")
    args = ap.parse_args()
    logging.basicConfig(level=logging.WARNING)
    try:
        result = convert(args.amount, args.currency, args.cache_path)
    except CurrencyError as exc:
        raise SystemExit(f"error: {exc}") from None
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
