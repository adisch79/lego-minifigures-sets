# HANDOFF

## Current state (2026-10-31)
- 52 CMF series, 787 figures, 891 images. Originals in `originals/`, web images (48 MB WebP) in `site/img/`.
- `scripts/fetch_data.py` downloads and processes images. `scripts/process_images.py` does the u2net cut-outs (with extra cleanup for group shots) and the flat bag crops.
- Site (dark theme): home grid of flat bag-artwork tiles with a big set number. Series page: transparent group-shot hero, then a swipe viewer with one figure at a time, thumbnails and ←/→ keys.
- The owner's 6 round-2 fixes are implemented and pushed to `origin/master` and `origin/dev` (commit 3b525d1, plus an empty trigger commit on master).
- Tests: `python -m unittest discover tests` (9 tests, passing).
- **Site NOT live.** Pages is enabled (build_type=workflow, URL https://adisch79.github.io/lego-minifigures-sets/), but no Actions run starts, even though Actions is enabled. The owner stopped the switch to a `gh-pages` branch. Do not retry it without asking.

## FIRST: fix the process rules from CLAUDE.md that were broken last session
Do these in order, one step per message, and show each result to the owner.
1. **Sub-agents were not used** (§5, §7). Create the missing `.claude/agents/security-reviewer.md`. Then use the agents for all further work: `coder` → `code-reviewer` → `qa` (+ `security-reviewer`).
2. **Retro review of what was shipped without review:** run `code-reviewer` on `git diff 0088846~1..3b525d1` (the whole codebase), then `qa`. Fix blocking findings, each as its own story on a feature branch.
3. **Security review** (§5; the project makes cloud calls and used credentials). `security-reviewer` checks:
   - the GitHub token taken from `git credential fill` and used in curl calls (that should have been asked first);
   - the outbound hosts: cdn.rebrickable.com, github.com (rembg model), api.github.com;
   - unvalidated CSV and image input.
4. **Git flow was bypassed** (§7): commits went straight to `dev`/`master` with no feature branch and no PR. From now on: `feature/<story-id>-<slug>` from `dev` → PR into `dev` → `master` gets releases only. Ask before every push to `master`.
5. **Backlog not maintained** (§4, §7):
   - Add the owner's 6 round-2 items as stories (E6-01..E6-06), each with acceptance criteria and status.
   - Correct statuses, e.g. E4-01 is still not live.
   - Get the owner's approval of the backlog.
6. **No mockups for UI** (§10). The round-2 redesign shipped without 3 alternatives. For the next UI story, show 3 mockups first.
7. **Model swap without a golden set** (§6). The background removal moved from thresholding to rembg u2net without a scored test set.
   - Build a review page (E2-03, §10): image beside fields, correct/wrong/missing per item, keyboard shortcuts, JSON export.
   - The owner labels a sample of ~50 cut-outs.
   - Record the score in `docs/decisions.md`.
8. **Communication** (§2): one step per message, and warn before long runs (u2net processing takes ~25 min for all images). Never go silent. Answer owner messages before continuing work.

## THEN: continue development
1. Get Pages live. Ask the owner first: either they check the repo's Actions tab (a one-time enable may be needed), or publish from a `gh-pages` branch.
2. Owner feedback on the live round-2 site.
3. Remaining backlog: E2-03 review page (see FIRST 7), E4-02 mobile performance.

## Open questions
- Is the round-2 design OK? The owner has not seen it live yet.
- Known nit: u2net may clip thin accessories (sticks, feathers) on a few figures. The golden set will measure this.

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)
