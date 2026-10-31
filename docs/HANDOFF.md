# HANDOFF

## Resume on any PC
1. `git clone https://github.com/adisch79/lego-minifigures-sets.git` (or `git fetch --all`), then `git checkout dev`.
2. `python -m pip install --user -r requirements.txt -c constraints.txt`, then `python -m unittest discover tests` (expect 76 pass on `dev`).
3. Open Claude Code in the repo, read this file, and continue from **Next step**.

## Current state (2026-10-31)
- **Site live:** https://adisch79.github.io/lego-minifigures-sets/. Released E7-02, E7-03 and E8-01 (master `5b64810`, deploy OK, live `data.js` = 768 `fig` + 19 `set`).
- Figures = real Rebrickable minifig photos. 19 have no photo and use the set image (12 F1 cars, 7 DFB players). Hero = uncut group photo in a white rounded card. No background removal; rembg is gone.
- **Branches (all pushed):**

| Branch | State |
|---|---|
| `master` | production; a push deploys Pages |
| `dev` | integration, = master + docs |
| `feature/E7-04-site-a11y` | **WIP, 1 commit (`f64b716`), NOT rebased on E8-01**. 60 tests pass on it. |
| other `feature/*` | merged, can be deleted |
| `gh-pages` (local only) | stale, unused (Pages deploys from Actions); delete |

- Flow: `feature/<story>` → `dev` (local `git merge --no-ff`, no `gh` CLI) → release merge `dev` → `master` + push. The owner said "push ok" for the last release; ask again before the next `master` push.
- Headless check: `chrome.exe --headless=new --window-size=1280,1600 --virtual-time-budget=8000 --screenshot=<png> <url>`. Mobile: 375 px iframe wrapper (headless minimum width is ~500 px).

## Next step
1. **E7-04** on `feature/E7-04-site-a11y`:
   - `git rebase dev`. Conflicts are expected in `site/series.html` and `site/style.css`: keep E8-01's `.photo` cards and the hero `max-width`, and add E7-04's a11y bits.
   - Fix 3 code-review should-fix items:
     - (a) Focus is lost when the focused ←/→ arrow becomes disabled. Move focus to the other arrow or the track.
     - (b) An empty figures list still shows the viewer with "1 / 0". Hide the viewer and show "No figures".
     - (c) The track has an `aria-label` but no `role`. Add `role="region"` (or `group`) + `aria-roledescription="carousel"`.
   - Then code-reviewer → qa → merge into `dev`.
2. E7-05 catalog edge cases (deterministic series-id tie break; bag/group classification tests).
3. E4-02 mobile performance: lazy-load, 160 px thumbs, hero `fetchpriority=high` + width/height.
4. P-07 golden set is obsolete. Drop it, or repurpose it as an E2-03 photo review page.

## Open questions
- Owner feedback on the live E8-01 look.
- E6-01..E6-06 wording was reconstructed and never confirmed (E6-01/E6-02 are superseded by E8-01).
- Auto mode blocks reading stored git credentials. GitHub settings changes need the owner.

## Session rules learned
- The owner works hands-off: no mid-task questions. Stop only on real permission blocks.
- Commit and push HANDOFF + all WIP branches at every milestone, and before the context fills. Never leave work local-only.

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)
