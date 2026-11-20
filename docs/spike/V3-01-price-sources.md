# V3-01 Price source spike (2026-11-21)

Goal: pick sources for a daily job (GitHub Action, at most 1 request per 4 s per host) that finds the lowest price per series and figure for a buyer in Israel.
Method: two read-only research passes (GET pages and robots.txt only). Every claim below has its URL; UNVERIFIED means the page could not be read on 2026-11-21.

## Result

| Source | Access | Israel filter | Terms / robots | Match quality | Verdict |
|---|---|---|---|---|---|
| eBay Browse API | REST `item_summary/search`, OAuth client credentials | `filter=deliveryCountry:IL` (ships to IL) | License limits public display (see below) | Weak: title keyword match | **Pick 1** (needs owner keys) |
| toysrus.co.il | Shopify, sitemap, product pages allowed | Israeli shop | robots allows product pages; 429 under load | Good if CMF is stocked | **Pick 2** (verify stock first) |
| lego.com/en-il | Product page per set | IL storefront exists | robots UNVERIFIED; fetch 403 | Exact set number | Reference price only (manual check) |
| BrickLink API | OAuth 1.0, 4 keys, price guide | `country_code` meaning UNVERIFIED | Site in maintenance; display rights UNVERIFIED | Native ids (col29-1, 71052-1) | **On hold** |
| zap.co.il | HTML search | Israeli aggregator | robots disallows `/search.asp`, `/fs?`, `*?keyword` | Good | **No** (robots) |
| ksp.co.il | JS app | Israeli shop | robots disallows ClaudeBot/GPTBot; search 403 | CMF unlikely | **No** |

## Evidence

### eBay Browse API
- Call limit: 5,000 calls/day default for Browse; Buy APIs "require an additional license". SOURCE: https://www.edp.ebay.com/develop/api/buy/api_call_limits
- `deliveryCountry:IL` returns only items that can ship to IL; `conditions`, `buyingOptions:{FIXED_PRICE}`, `price` + `priceCurrency`, `maxDeliveryCost:0` exist. SOURCE: https://www.edp.ebay.com/api-docs/buy/ref-buy-browse-filters.html
- License (SOURCE: https://www.edp.ebay.com/join/api-license-agreement):
  - §8.1(c): shown data at most 6 hours older than eBay, or the gap must be disclosed.
  - §8.1(b): eBay content must not be combined with non-eBay content in a public display.
  - §9.5: eBay content must not be used to suggest or model prices.
  - §8.1(b): delete content once the listing ends.
- Scraping: https://www.ebay.com/robots.txt disallows `/sch/` and AI crawlers. API only.

### toysrus.co.il
- robots.txt allows `/` by default, disallows cart/checkout/account/sort-filter URLs, lists `https://toysrus.co.il/sitemap.xml`. SOURCE: https://www.toysrus.co.il/robots.txt
- `https://toysrus.co.il/search?q=71052` returned HTTP 429. CMF stock UNVERIFIED. Shopify `/products/<handle>.json` and JSON-LD UNVERIFIED.

### lego.com/en-il
- `https://www.lego.com/en-il/product/series-29-71052` exists (search result, "Retiring soon"). ILS price and shipping to IL UNVERIFIED (fetch 403).

### BrickLink
- All bricklink.com URLs redirected to https://maintenance.bricklink.com/recovery.html on 2026-11-21. API manual, ToS (https://v2.bricklink.com/terms-of-service) and robots.txt not read.
- Forum reports (secondhand, UNVERIFIED): API offered for sellers' own stores (https://www.bricklink.com/messageThread.asp?ID=339242); price guide sold data US-only (ID=315125); IP binding of keys may break GitHub Actions runners.

### zap.co.il / ksp.co.il
- zap robots.txt disallows `/search.asp`, `/fs?`, `*?keyword`, `*?q=`. SOURCE: https://www.zap.co.il/robots.txt. Data point for manual use: 71052 box 20 ILS.
- ksp robots.txt disallows GPTBot, ClaudeBot, CCBot, Bytespider. SOURCE: https://ksp.co.il/robots.txt

## Impact on MVP 3 stories
- **V3-04 "lowest price" chip conflicts with eBay §8.1(b) and §9.5** if one chip merges eBay and shop prices. Default chosen (logged in decisions.md): show per-source offers side by side ("eBay from X, ships to IL, as of <time>" and "Toys R Us X"), no merged "lowest" across eBay and others; show the data age. Owner can override.
- Daily job vs the 6-hour rule: show "as of <date time>" next to every eBay price.
- eBay matching needs a title filter (set number + "sealed"/series name; drop lots and "custom").

## Next steps
1. Agent: verify toysrus.co.il CMF stock, JSON-LD and `/products/<handle>.json` with one throttled request per page (V3-01b).
2. Owner: create eBay developer keys (Client ID + Secret, production) and put them in GitHub Actions secrets `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`. Steps: https://developer.ebay.com/my/keys
3. Agent: retry BrickLink API manual and ToS when the site is out of maintenance.
