# HANDOFF

## Current state (updated 2026-11-05)
- **Live:** MVP 1 at https://adisch79.github.io/lego-minifigures-sets/ (release PR #16). 16 of 23 stories done (V2-01, V2-02 on dev only) ([backlog](backlog.md)).
- **V1-07 card redesign:** owner signed off 2026-11-04; review and QA passed; released: PR #18 into dev, PR #19 into master, deploy success, live card verified 2026-11-03. Cards in `app/public/cards/`, built by `scripts/build_cards.py`; group images in `mockups/assets/group/` (SOURCES.md).
- **V2-01:** PR #17 merged into dev (2026-11-02). Migration applied to the live project by the owner in the SQL Editor (2026-11-04, "Success. No rows returned"). First admin created. Signups switched off in the dashboard. `node scripts/smoke_auth.mjs`: all 9 checks pass (2026-11-04). Live sign-in smoke test passes 5 of 5 (2026-11-04). V2-01 done: smoke script reviewed, QA passed, PR #20 into dev.
- **V2-02 sign-in:** PR #21 merged into dev as `b84c942` (2026-11-05). Link only, PKCE; direction A pill and popover (`mockups/V2-02/a.html`, owner pick). Code review, security review and QA passed; vitest 107. Repo variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set. Not yet live: needs the master release.
- **Context-cost hook:** built, registered, 9 of 9 acceptance cases pass (2026-11-03); fired live at 171k context (2026-11-04). Cost measurements: [context-cost.md](context-cost.md).

## Next step
**V2-03 done on `feature/V2-03-marks`, PR into dev** (2026-11-05). Twin chips (direction A) on Home and SeriesPage, filter pills All / My wanted / Missing, per-key save queue, writes scoped to user_id. vitest 138 pass; code review (3 passes), security review, QA pass. Screenshots `mockups/V2-03/build-*.png` (phone shots: `python mockups/V2-03/shoot390.py` with dev server on 5179). Dev-only `?demo` shows a fake signed-in collection. Next: V2-04 per backlog; owner live check of marks after the master release. Project is `minifigures-app`; the second project in the org is not this app.
- PR #22 (docs) merged into dev as `5ff82a3`.
- After the master release: live sign-in check on the site (pill, link, signed-in chip, sign out). Real Supabase error codes for unlisted addresses are untested; the UI maps them to the same answer.
- Smoke test: `node scripts/smoke_auth.mjs` sends no mail. `send <email>`, then `verify-link '<link>' <other-email>`: copy the link without opening it. Built-in mail allows 2 per hour and the full run uses both.

## Owner-needed
- Merge to master: owner only. Dev now carries V2-02 sign-in, a site change.
- Check Supabase Authentication > URL Configuration: Site URL and redirect list exactly `https://adisch79.github.io/lego-minifigures-sets/`, no wildcard (security review 2026-11-05).
- MVP 2: custom SMTP account before anyone but the owner can sign in.
- Supabase keys are in `.env` (2026-10-31); a database password or access token may also be needed for migrations. Telegram bot token and chat id: repo-root `.env` and a NAS copy. Key names unverified: a deny rule blocks reading `.env`.

## Rules worth keeping at hand
- Agent merges feature PRs into dev after code-reviewer and qa pass on the final diff (`gh pr merge <n> --merge`). The auto classifier refuses it otherwise.
- Re-render cards: `python scripts/build_cards.py <ids>` (no args builds only missing cards).
- Figure images: `img.bricklink.com/ItemImage/SN/0/<code>-<n>.png`. 71049 has no code and keeps v1 images.
- Logos: only files with real alpha (memory `feedback-asset-search`).

## Tests (2026-11-04)
`node --test scripts/smoke_auth.test.mjs`: 14 pass. `npx vitest run` in `app/`: 71 pass, 4 files; `npm ci` first if `node_modules` is empty. `python -m pytest tests`: 95 pass.

## Open questions
- Ages unreadable for 8909, 8805, 8684; no age is printed on their cards.
- One unreproduced `app/` vitest failure in 6 QA runs (2026-11-02): possibly flaky, name lost.
- Later, optional: `workflow_dispatch` for manual redeploy; deploy-job concurrency `{group: pages, cancel-in-progress: false}`; series page hero in mockup D still uses the bag image.
- `scripts/build_cards.py` review items deferred: Chrome stderr hidden on failure (line 144), hardcoded Chrome path (line 18). Weakest card images, replace if better ones appear: 600x450 grids on stands (71023, 71007, 71002, 71000, 8833, 8831), white-background cut-outs (8683, 8684, 8805, 8804, 8827).

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [context cost](context-cost.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md) · history up to 2026-11-03: [archive/handoff-2026-11-03.md](archive/handoff-2026-11-03.md)
