# HANDOFF

## Current state (2026-10-31)
- **Site live:** https://adisch79.github.io/lego-minifigures-sets/. It shows the E8-01 real photos, released 2026-10-31 (master `5b64810`, deploy run succeeded, live `data.js` has 768 `fig` + 19 `set`).
- E7-02, E7-03 and E8-01 are released. `dev`, `master` and the feature branches are all pushed.
  - Figures use the real Rebrickable minifig photo (`fig-*.jpg`, straight pose): 768 of 787. The other 19 use the set promo image, because no photo exists (12 F1 cars, 7 DFB players).
  - No background removal anywhere. The hero is the original group photo in a white rounded card. rembg/onnxruntime are removed.
  - Checked by eye (desktop + 375 px). Review + QA passed. 76 tests.
- Flow: `feature/<story>` → `dev` (local `--no-ff` merge, no `gh` CLI) → release merge into `master`, which deploys. Default branch = `master`.
- Headless check without a browser prompt: `chrome.exe --headless=new --window-size=1280,2000 --screenshot=... file:///.../site/series.html?id=71053`. For mobile, wrap the page in a 375 px iframe, because headless has a minimum width of about 500 px.
- The owner works hands-off: don't ask mid-task. Stop only on real permission blocks.

## Next step
1. E7-04 (paused on `feature/E7-04-site-a11y`): rebase onto `dev` (conflicts in `site/series.html` and `style.css` with E8-01), fix the 3 should-fix items (focus lost on a disabled arrow, empty figures list, track role), re-review, QA.
2. E7-05 catalog edge cases → E4-02 mobile performance (160 px thumbs, hero `fetchpriority`). P-07 golden set is obsolete (no cut-outs any more); drop it or repurpose it as a photo review.

## Open questions
- Owner feedback on the E8-01 look once it is live.
- E6-01..E6-06 wording was reconstructed and never confirmed (E6-01/E6-02 cut-outs are superseded by E8-01).
- Reading stored git credentials is blocked by auto mode. GitHub settings changes need the owner.

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)
