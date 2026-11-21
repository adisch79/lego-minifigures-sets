#!/usr/bin/env bash
# V3-01b: read-only check of toysrus.co.il for LEGO Minifigures (CMF) stock and Shopify product JSON.
# Throttled: one request, then a 6 s pause (spike rule: at most 1 request per 4 s per host).
# Only paths allowed by https://www.toysrus.co.il/robots.txt are fetched (sitemap, product pages, product .json).
# Output: docs/spike/v3-01b/ (sitemaps, matches.txt, product JSON, log.txt).
set -u
OUT="$(cd "$(dirname "$0")/../.." && pwd)/docs/spike/v3-01b"
mkdir -p "$OUT"
cd "$OUT" || exit 1
UA="Mozilla/5.0 (compatible; price-research-script/0.1)"
LOG=log.txt
: > "$LOG"

get() {
  # $1 url, $2 output file
  curl -s -A "$UA" -L --max-time 30 -o "$2" -w "%{http_code} %{content_type} $1\n" "$1" | tee -a "$LOG"
  sleep 6
}

get "https://www.toysrus.co.il/sitemap.xml" sitemap.xml

# Shopify sitemap index lists sitemap_products_1.xml, sitemap_products_2.xml, ...
i=0
for u in $(grep -o '<loc>[^<]*sitemap_products[^<]*</loc>' sitemap.xml | sed 's#</\?loc>##g; s#&amp;#\&#g' | head -5); do
  i=$((i+1))
  get "$u" "products_$i.xml"
done

# Candidate CMF product URLs by handle keywords (series numbers of recent CMF waves).
cat products_*.xml 2>/dev/null \
  | grep -o '<loc>[^<]*/products/[^<]*</loc>' | sed 's#</\?loc>##g' \
  | grep -iE '7105[0-9]|7104[0-9]|7103[0-9]|minifig|%d7%9e%d7%99%d7%a0%d7%99%d7%a4' \
  | sort -u > matches.txt
echo "matches: $(wc -l < matches.txt)" | tee -a "$LOG"

# Product JSON for the first 3 matches (Shopify /products/<handle>.json).
n=0
while read -r p; do
  [ -z "$p" ] && continue
  n=$((n+1)); [ "$n" -gt 3 ] && break
  get "${p%%\?*}.json" "product_$n.json"
done < matches.txt

echo "done. Files in $OUT" | tee -a "$LOG"
