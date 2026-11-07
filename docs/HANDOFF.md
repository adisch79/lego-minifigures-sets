# HANDOFF

## Current state (updated 2026-11-06, V2-04 live, V2-05 direction C picked)
- **Live:** MVP 1 at https://adisch79.github.io/lego-minifigures-sets/ (release PR #16). 16 of 23 stories done (V2-01, V2-02 on dev only) ([backlog](backlog.md)).
- **V1-07 card redesign:** owner signed off 2026-11-04; review and QA passed; released: PR #18 into dev, PR #19 into master, deploy success, live card verified 2026-11-03. Cards in `app/public/cards/`, built by `scripts/build_cards.py`; group images in `mockups/assets/group/` (SOURCES.md).
- **V2-01:** PR #17 merged into dev (2026-11-02). Migration applied to the live project by the owner in the SQL Editor (2026-11-04, "Success. No rows returned"). First admin created. Signups switched off in the dashboard. `node scripts/smoke_auth.mjs`: all 9 checks pass (2026-11-04). Live sign-in smoke test passes 5 of 5 (2026-11-04). V2-01 done: smoke script reviewed, QA passed, PR #20 into dev.
- **V2-02 sign-in:** PR #21 merged into dev as `b84c942` (2026-11-05). Link only, PKCE; direction A pill and popover (`mockups/V2-02/a.html`, owner pick). Code review, security review and QA passed; vitest 107. Repo variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set. Live: release PR #24 into master 2026-11-05 (with V2-03).
- **Context-cost hook:** built, registered, 9 of 9 acceptance cases pass (2026-11-03); fired live at 171k context (2026-11-04). Cost measurements: [context-cost.md](context-cost.md).

## Next step
**V2-05 admin page, build direction C** (owner pick 2026-11-06, decisions.md). Mockups and `docs/status.html` (status + Gantt) are on branch `feature/V2-05-mockups` (not merged): `mockups/V2-05/c.html`, `c.html?allow` for the slide-over, shared `admin.css`, `data.js`. Build on `feature/V2-05-admin` from dev with senior-frontend-dev: real data from Supabase (allowlist, profiles, marks, wanted_alerts), admin-only route; check RLS lets only the admin read all marks and alerts (may need a migration: paste in SQL Editor, never `db push`). Then code review, security review, QA, PR into dev, release PR into master.
**V2-04 Telegram alert: done and live** (PR #26 into dev, 2026-11-06). Function `telegram-alert` deployed (v1) to `minifigures-app` (ref `iagnfgedasxkqqjbsoeg`), migration pasted in the SQL Editor (do not `db push`: V2-01 was also applied by hand, so the CLI history is empty). Owner confirmed a Telegram message on a wanted mark 2026-11-06. First try failed with 401: Vault `alert_hook_secret` differed from `ALERT_HOOK_SECRET`; owner reset both. `net` grants from `supabase_admin` accepted (decisions.md). Not yet on master: the release PR dev into master is pending.
Secret names: function `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ALERT_HOOK_SECRET`; Vault `alert_hook_secret` (same value), `alert_hook_url`; header `x-alert-secret`. Owner was asked (2026-11-06) to add the two Telegram secrets in Supabase Edge Functions > Secrets; not yet confirmed. Project is `minifigures-app`; the second project in the org is not this app.
- PR #22 (docs) merged into dev as `5ff82a3`.
- Real Supabase error codes for unlisted addresses are untested; the UI maps them to the same answer.
- Smoke test: `node scripts/smoke_auth.mjs` sends no mail. `send <email>`, then `verify-link '<link>' <other-email>`: copy the link without opening it. Built-in mail allows 2 per hour and the full run uses both.

## Owner-needed
- Hosting move decided 2026-11-07: Cloudflare Pages (story V2-06, after V2-05 release). Owner step 1 given: create a free Cloudflare account with 2FA. Next owner step: API token (Cloudflare Pages: Edit) as repo secret.
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
