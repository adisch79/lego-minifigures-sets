# HANDOFF

## Current state (2026-10-31)
- **Site live:** https://adisch79.github.io/lego-minifigures-sets/ (52 CMF series, 787 figures, 891 images).
- Flow in place: `feature/<story>` → `dev` (local `--no-ff` merge, no `gh` CLI) → release merge into `master`, which deploys. Default branch = `master`.
- Tests: `python -m unittest discover tests` (30 tests, passing).
- Done this session:
  - P-01: added the `security-reviewer` agent.
  - Retro review of all code shipped so far (code, QA, security): no blocking security findings; findings became E7 stories.
  - E7-01: robust download and processing (atomic writes, image validation, per-file errors).
  - E7-06: owner decisions recorded.
  - E4-01: site live.
- The owner works hands-off: don't ask mid-task. Stop only on real permission blocks.

## E8-01 note
After upgrading from the rembg output run `python scripts/fetch_data.py --rebuild` once (figures whose `src` differs from the old data.json are also rebuilt automatically).

## Next step
Run E7-02 → E7-05 one at a time, each through the full flow: `coder` → `code-reviewer` → `qa` (+ `security-reviewer` for E7-02/E7-03), merge to `dev`. Then cut a release to `master`.
- E7-02 input validation · E7-03 version pins · E7-04 site robustness + a11y (UI: show 3 mockups if the visuals change) · E7-05 catalog edge cases.
- Then E4-02 mobile performance (160 px thumbs, hero `fetchpriority`), then P-07 golden set (E2-03 review page).

## Open questions
- The owner has not given feedback on the round-2 design live yet.
- The E6-01..E6-06 wording was reconstructed from commit 3b525d1, not confirmed by the owner.
- Known nit: u2net may clip thin accessories. P-07 will measure this.
- Reading stored git credentials is blocked by auto mode. GitHub settings changes need the owner.

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)
