# HANDOFF

## Current state (updated 2026-11-04)
- **Live:** MVP 1 at https://adisch79.github.io/lego-minifigures-sets/ (release PR #16). 13 of 23 stories done ([backlog](backlog.md)).
- **V1-07 card redesign:** owner signed off 2026-11-04; review and QA passed; released: PR #18 into dev, PR #19 into master, deploy success, live card verified 2026-11-03. Cards in `app/public/cards/`, built by `scripts/build_cards.py`; group images in `mockups/assets/group/` (SOURCES.md).
- **V2-01:** PR #17 merged into dev (2026-11-02). Migration applied to the live project by the owner in the SQL Editor (2026-11-04, "Success. No rows returned"). First admin created. Signups switched off in the dashboard. `node scripts/smoke_auth.mjs`: all 9 checks pass (2026-11-04). Live sign-in smoke test passes 5 of 5 (2026-11-04); remaining: review and QA of the smoke script (next step 3).
- **Context-cost hook:** built, registered, 9 of 9 acceptance cases pass (2026-11-03); fired live at 171k context (2026-11-04). Cost measurements: [context-cost.md](context-cost.md).

## Next step
Work is on `feature/V2-01-smoke` (pushed): `scripts/smoke_auth.mjs` and its tests, not yet in dev. Project is `minifigures-app`; the second project in the org is not this app.
1. **V2-01 live smoke test done (2026-11-04).** Owner set the Site URL. `verify-link`: link returns to the live site, link signs in, email change refused (HTTP 500 `unexpected_failure`, the expected shape when the `block_email_change` trigger in the migration raises inside Auth), user cannot read admins, own profile only: 5 of 5 pass, exit 0.
2. **Design conflict to resolve in V2-02:** `docs/design/V2-01-schema.md` plans code entry through `verifyOtp`, which needs `{{ .Token }}` in the template, so it needs custom SMTP. Without SMTP, sign-in is link only.
3. code-reviewer and qa on `feature/V2-01-smoke`, PR into dev, then V2-02 invite-only sign-in.

## Owner-needed
- Merge to master: owner only.
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
- `scripts/build_cards.py` review items deferred: Chrome stderr hidden on failure (line 144), hardcoded Chrome path (line 18). Weakest card images, replace if better ones appear: 600x450 grids on stands (71023, 71007, 71002, 71000, 8833, 8831), white-background cut-outs (8683, 8684, 8805, 8804, 8827).

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [context cost](context-cost.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md) · history up to 2026-11-03: [archive/handoff-2026-11-03.md](archive/handoff-2026-11-03.md)
