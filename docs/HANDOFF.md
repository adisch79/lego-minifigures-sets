# HANDOFF

## Current state (updated 2026-11-03)
- **Live:** MVP 1 at https://adisch79.github.io/lego-minifigures-sets/ (release PR #16). 12 of 23 stories done ([backlog](backlog.md)).
- **In progress:** V1-07 card redesign on `feature/V1-07-card-art`, pushed. All 52 cards rendered to `app/public/cards/` by `scripts/build_cards.py`; group images in `mockups/assets/group/` (SOURCES.md).
- **V2-01:** PR #17 merged into dev (2026-11-02). Migration and tests in `supabase/`. Not applied to the live project.
- **Context-cost hook:** built, registered, 9 of 9 acceptance cases pass (2026-11-03). Cost measurements: [context-cost.md](context-cost.md).

## Next step
1. **Owner sign-off on the V1-07 overview:** `docs/spike/V1-07-cards-all.png`, full-size sample `docs/spike/V1-07-cards-sample.png`. Weakest images, replace if better ones appear: 600x450 grids on stands (71023, 71007, 71002, 71000, 8833, 8831), white-background cut-outs (8683, 8684, 8805, 8804, 8827).
2. After sign-off: code-reviewer and qa on the final diff, PR into dev, then release PR to master (owner).
3. Then V2-01 live apply: paste the migration from dev in the Supabase SQL Editor, run the live smoke test. Paused until V1-07 is released (owner, 2026-11-02).

## Owner-needed
- V1-07 sign-off (step 1). Merge to master: owner only.
- MVP 2: custom SMTP account before anyone but the owner can sign in.
- Supabase keys are in `.env` (2026-10-31); a database password or access token may also be needed for migrations. Telegram bot token and chat id: repo-root `.env` and a NAS copy. Key names unverified: a deny rule blocks reading `.env`.

## Rules worth keeping at hand
- Agent merges feature PRs into dev after code-reviewer and qa pass on the final diff (`gh pr merge <n> --merge`). The auto classifier refuses it otherwise.
- Re-render cards: `python scripts/build_cards.py <ids>` (no args builds only missing cards).
- Figure images: `img.bricklink.com/ItemImage/SN/0/<code>-<n>.png`. 71049 has no code and keeps v1 images.
- Logos: only files with real alpha (memory `feedback-asset-search`).

## Open questions
- Ages unreadable for 8909, 8805, 8684; no age is printed on their cards.
- One unreproduced `app/` vitest failure in 6 QA runs (2026-11-02): possibly flaky, name lost.
- Later, optional: `workflow_dispatch` for manual redeploy; deploy-job concurrency `{group: pages, cancel-in-progress: false}`; series page hero in mockup D still uses the bag image.

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [context cost](context-cost.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md) · history up to 2026-11-03: [archive/handoff-2026-11-03.md](archive/handoff-2026-11-03.md)
