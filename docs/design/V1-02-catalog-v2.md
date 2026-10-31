# V1-02 Catalog contract v2 (design)

Status: revised 2026-11-01 after design review (opus): 1 blocking + 7 should-fix findings addressed below.
Story: docs/backlog.md V1-02.

## Goal
One JSON file the new app (`app/`) reads at runtime: every CMF series and every figure, with the fields the
home grid (sort, search) and series page need. Built offline from the existing v1 catalog; no network.

## Input
- `site/data.json` (v1, built by `scripts/fetch_data.py` from Rebrickable CSV dumps): 52 series, 787 figures.
- `scripts/catalog_overrides.json` (new, hand-kept): per-series facts not in Rebrickable, each with a `source`.

## Output
- `app/public/catalog.json`, written by `scripts/build_catalog.py` (pure transform, deterministic: same input
  gives byte-identical output; no timestamp field).
- Images are NOT copied into git twice. `site/img/` (30 MB, already committed) stays the single copy;
  `app/scripts/copy-images.mjs` copies it to `app/public/img/` (git-ignored) before `dev` and `build`.
  Paths in the catalog are relative to the catalog file, e.g. `img/71045/71045-1.webp`.

```json
{
  "version": 2,
  "source": "site/data.json (Rebrickable CSV dumps) + scripts/catalog_overrides.json",
  "series": [
    {
      "id": "71045",
      "name": "Series 25 Minifigures",
      "line": "Series",
      "seriesNo": 25,
      "year": 2024,
      "age": "5+",
      "bricklinkCode": "col25",
      "figureCount": 12,
      "bag": "img/71045/71045-0.webp",
      "card": null,
      "figures": [
        { "id": "71045-1", "no": 1, "name": "Film Noir Detective", "img": "img/71045/71045-1.webp", "imgFallback": false }
      ]
    }
  ]
}
```

### Fields (names follow the backlog: `seriesNo`, `bag`)
| Field | Type | Rule |
|---|---|---|
| `id` | string | Base set number, `^\d{4,6}$`. Unique. **Permanent key** (see Ids). |
| `name` | string | Rebrickable sub-theme name, unchanged. |
| `line` | string | Product line: `"Series"` for the numbered main line (`^Series (\d+) Minifigures$`), else the theme with a trailing `^(.*) Series (\d+)$` number or a trailing ` Minifigures` removed. Overrides win. |
| `seriesNo` | int or null | Number from the two anchored patterns above, or the override; null for one-off themes. |
| `year` | int | Release year from Rebrickable. |
| `age` | string or null | Age mark on the bag (`5+`, `6+`). Override table only; null when not yet read from the bag. |
| `bricklinkCode` | string or null | BrickLink CMF prefix (`col25`). Override table only; null until verified. |
| `figureCount` | int | `== figures.length`. |
| `bag` | string or null | Bag image path. |
| `card` | string or null | Composed series card (V0-06); null until generated. |
| `figures[].id` | string | Rebrickable set number `<id>-<n>`. Unique across the catalog; never equal to a series id. **Permanent key.** |
| `figures[].no` | int | n from the set number: `no` equals the Rebrickable id suffix; gaps are allowed only when pinned in KNOWN_GAPS (tests/test_build_catalog.py). Display order only, never a key. For 71001, no=19 is greater than figureCount=17, so the UI must never use `no` as an array index or in an "x of N" label. |
| `figures[].name` | string | Rebrickable name. |
| `figures[].img` | string or null | Figure image path; file must exist. |
| `figures[].imgFallback` | bool | true when v1 had no real minifig photo (v1 `src == "set"`, 19 figures today); feeds the V1-03 gap report. |

No display label in the data: the UI builds "Series 25" / "Marvel Series 2" from `line` + `seriesNo` through
i18n strings (Hebrew in MVP 4). `name` is the fallback.

### Explicit line/seriesNo overrides (`catalog_overrides.json`)
| Series | line | seriesNo | Why |
|---|---|---|---|
| The LEGO Movie (71004) | The LEGO Movie | 1 | pairs with "II" |
| The LEGO Movie II (71023) | The LEGO Movie | 2 | Roman numeral |
| Disney 100 (71038) | Disney 100 | null | own theme, not Disney Series 3 |
| Others | parsed | parsed | e.g. "DFB Minifigures" -> line "DFB"; "Team GB" -> "Team GB" |

Age and BrickLink code entries for the 6 V0-06 series (SOURCE: bag images, V0-06 verification); the other 46
series stay null until V1-03, which reads each bag and verifies each BrickLink code.

### Ids (for Supabase marks in MVP 2)
`series.id` and `figures[].id` are Rebrickable set numbers: permanent, never re-derived from position,
BrickLink codes or `no`. BrickLink number == Rebrickable n is verified for 6 series only; V1-03 checks it per
series before any BrickLink image is attached.

### Order
File: `year` desc, then numeric `id` desc. Figures by `no`.
"Series number" sort (V1-04) key, defined here and exported from `app/src/catalog.ts` as `seriesNoSortKey`:
main line first (`line == "Series"`) by `seriesNo`; then other lines A-Z by `line`, then `seriesNo`
(null first, as the one-off), then `year`.

### Dropped from v1
`group` (all-figures photo; v2 uses composed cards), `color` (cards carry their palette), figure `src`
(kept only as `imgFallback`). v1 site keeps its own `site/data.json`; nothing in v1 changes.

## Scope moved (logged in decisions.md)
Age for the other 46 series and the per-series BrickLink code + numbering check move to V1-03, where the bag
and BrickLink images are processed anyway. V1-02 carries the fields (nullable) and the 6 known values.

## Validation
- `tests/test_build_catalog.py`: fixture + real `site/data.json`:
  totals 52 series / 787 figures; every field rule above; unique ids; no figure id equals a series id;
  `no` equals the Rebrickable id suffix, unique per series, gaps only when pinned in KNOWN_GAPS; every non-null image path exists under `site/`; file order; deterministic output
  (two runs identical); line/seriesNo for `Series 25 Minifigures`, `Marvel Series 2`,
  `Harry Potter and Fantastic Beasts Series 2`, `The LEGO Batman Movie Series 1`, `The LEGO Movie II`,
  `Disney 100`, `DFB Minifigures`, `Team GB`, `Spider-Man - Across the Spider-Verse`, `Dungeons & Dragons`.
- `app/src/catalog.ts`: types, runtime guard `parseCatalog(json)` and `seriesNoSortKey`. Vitest: real
  `public/catalog.json` passes; negative cases (missing field, bad id, count mismatch, duplicate id) throw;
  sort key orders a mixed sample as specified.
