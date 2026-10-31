# V1-02 Catalog contract v2 (design)

Status: proposed 2026-11-01. Story: docs/backlog.md V1-02.

## Goal
One JSON file the new app (`app/`) reads at runtime: every CMF series and every figure, with the fields the
home grid (sort, search) and series page need. Built offline from the existing v1 catalog; no network.

## Input
`site/data.json` (v1, built by `scripts/fetch_data.py` from Rebrickable CSV dumps): 52 series, 787 figures.
v1 series = `{id, name, year, bag{set_num,img}, group{set_num,img}, figures[{set_num,name,img,src}], color}`.

## Output
`app/public/catalog.json`, written by a new script `scripts/build_catalog.py` (pure transform of `site/data.json`).

```json
{
  "version": 2,
  "generatedAt": "2026-11-01T10:00:00Z",
  "source": "site/data.json (Rebrickable CSV dumps)",
  "series": [
    {
      "id": "71045",
      "name": "Series 25 Minifigures",
      "line": "Series",
      "wave": 25,
      "label": "Series 25",
      "year": 2024,
      "figureCount": 12,
      "images": { "bag": "img/71045/71045-0.webp", "card": null },
      "figures": [
        { "id": "71045-1", "no": 1, "name": "Film Noir Detective", "img": "img/71045/71045-1.webp" }
      ]
    }
  ]
}
```

### Fields
| Field | Type | Rule |
|---|---|---|
| `id` | string | Base set number, `^\d{4,6}$` (e.g. `71045`, `8683`). Unique. |
| `name` | string | Rebrickable sub-theme name, unchanged. |
| `line` | string | Product line for grouping and sort: `"Series"` for the numbered main line, otherwise the theme with any trailing `Series N` removed (`"Marvel"`, `"Disney"`, `"The Simpsons"`, `"Shrek"`). |
| `wave` | int or null | N from `Series N Minifigures` or `<Theme> Series N`; null for one-off themes (Shrek, Disney 100). |
| `label` | string | Short display name: `Series 25`, `Marvel Series 2`, else `name`. |
| `year` | int | Release year from Rebrickable. |
| `figureCount` | int | `== figures.length`. |
| `images.bag` | string or null | Path relative to the catalog file. |
| `images.card` | string or null | Composed series card (V0-06 method); null until generated for that series. |
| `figures[].id` | string | Rebrickable set number `<id>-<n>`. Unique across the catalog. |
| `figures[].no` | int | n from the set number, 1-based, also the BrickLink CMF image number (verified for 6 series, V0-06). |
| `figures[].name` | string | Rebrickable name. |
| `figures[].img` | string or null | Figure image path. |

Sort order inside the file: `year` desc, then `id` desc. Figures by `no`.

### Dropped from v1
`group` (all-figures photo; v2 uses composed cards), `color` (cards carry their own palette), figure `src`
(pipeline detail). v1 site keeps its own `site/data.json`; nothing in v1 changes.

### Not in this story
BrickLink codes per series and the image switch to BrickLink cut-outs (V1-03); prices (MVP 3); user marks
(MVP 2, Supabase, keyed by `series.id` / `figures[].id`); i18n names (MVP 4, add `nameHe` later).

## Validation
- `tests/test_build_catalog.py`: transform on a small fixture and on the real `site/data.json`; asserts every
  rule in the table (uniqueness, regex, `figureCount`, `no` sequence 1..n without gaps, wave parsing for the
  name variants: `Series 25 Minifigures`, `Marvel Series 2`, `Harry Potter and Fantastic Beasts Series 2`,
  `The LEGO Batman Movie Series 1`, `Disney 100`, `DFB Minifigures`, `Team GB`).
- `app/src/catalog.ts`: TypeScript types + a runtime guard `parseCatalog(json)`; Vitest test loads
  `public/catalog.json` and runs the guard.
