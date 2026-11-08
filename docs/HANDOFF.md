# HANDOFF

## Current state (updated 2026-11-08, MVP 2.1 owner fixes in progress)
- **Live:** https://minifighunt.com/ on Cloudflare Pages (V2-06, 2026-11-07); `www` 301 to apex. GitHub Pages switched off. Releases: V2-04+V2-05 PR #35, V2-06 PR #38 ([backlog](backlog.md)).
- **V1-07 card redesign:** owner signed off 2026-11-04; review and QA passed; released: PR #18 into dev, PR #19 into master, deploy success, live card verified 2026-11-03. Cards in `app/public/cards/`, built by `scripts/build_cards.py`; group images in `mockups/assets/group/` (SOURCES.md).
- **V2-01:** PR #17 merged into dev (2026-11-02). Migration applied to the live project by the owner in the SQL Editor (2026-11-04, "Success. No rows returned"). First admin created. Signups switched off in the dashboard. `node scripts/smoke_auth.mjs`: all 9 checks pass (2026-11-04). Live sign-in smoke test passes 5 of 5 (2026-11-04). V2-01 done: smoke script reviewed, QA passed, PR #20 into dev.
- **V2-02 sign-in:** PR #21 merged into dev as `b84c942` (2026-11-05). Link only, PKCE; direction A pill and popover (`mockups/V2-02/a.html`, owner pick). Code review, security review and QA passed; vitest 107. Repo variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set. Live: release PR #24 into master 2026-11-05 (with V2-03).
- **Context-cost hook:** built, registered, 9 of 9 acceptance cases pass (2026-11-03); fired live at 171k context (2026-11-04). Cost measurements: [context-cost.md](context-cost.md).

## Next step: MVP 2.1 owner fixes, ONE AT A TIME (updated 2026-11-08)
Owner rule (memory `feedback-one-fix-at-a-time`): each message covers exactly one fix (what changed, proof, the one thing the owner does). Wait for the owner's answer before the next. Never report several fixes together.
Queue (backlog MVP 2.1). Work is already built for 1-5; present them in this order:
1. **V2-08 alerts pause.** DONE 2026-11-08: owner ran the two `drop trigger` lines in the Supabase SQL Editor (live). Re-enable SQL: header of `supabase/migrations/20261108000000_v2_08_pause_wanted_alerts.sql`. Code reaches master with the next release.
2. **V2-07 rename to Minifig Hunt.** Merged into dev (PR #43). Live after the release PR dev into master.
3. **V2-10 admin link.** Cause: `.adm-link` (app/src/Account.tsx:277) has no CSS. Mockups A/B/C: branch `feature/V2-10-12-mockups`, `mockups/V2-10/{a,b,c}.png`. Recommend B (yellow brick). Owner picks, then senior-frontend-dev builds.
4. **V2-12 site icon.** Same branch, `mockups/V2-12/sheet.png` (A lens head, B head in crosshair, C MH brick). Recommend B.
5. **V2-11 card layout v5.** Branch `feature/V2-11-mockups`, `mockups/V2-11/sheet.png` (A box stack, B logo crown, C full bleed; renderer `mockups/V2-11/build_mockups.py`). Recommend A. Known: about 90 px gap in 71052 for A/B. Then rebuild 52 cards.
6. **V2-13 front photos.** 71052 done on `feature/V2-13-front-photos` (5e0b34f): `.fig.jpg` (Rebrickable, front) cut out by `scripts/cutout.py`; switch `FRONT_PHOTO_SERIES` in scripts/process_images.py; `python scripts/apply_front.py <id>`. Screenshot `mockups/V2-13/71052-1280.png`. Owner sign-off, then all series (older ones have grey backgrounds: check cut-outs).
7. **V2-14 mock user.** Owner adds `adisch79+user@gmail.com` in https://minifighunt.com/#admin and signs in with it in a private window (not needed after V2-09).
8. **V2-09 open sign-up.** Not started. Design + security review: drop allowlist trigger (migration 20261102 `enforce_allowlist`), `shouldCreateUser: true` (app/src/auth.ts:91), admin lists all users. Owner: Supabase "Allow new users to sign up" and custom SMTP (built-in mail 2 per hour).
9. **V2-15 contact + coffee pages**, 10. **V2-16 branded auth emails** (pairs with V2-09 custom SMTP), 11. **V2-17 business model discussion**. Added by owner 2026-11-08, not started.
Docs PR #42 merged. Untracked leftover `mockups/V2-11/tmp/` in worktree agent-a11b373be5017f407 (delete was denied).
Previous next-step text (V2-04/05/06, all done): [archive/handoff-2026-11-07.md](archive/handoff-2026-11-07.md).

## Owner-needed
- Hosting move decided 2026-11-07: Cloudflare Pages (story V2-06, after V2-05 release). Owner step 1 done 2026-11-07 (account + 2FA). Owner step 2 in progress: account API token, policy Entire Account > Developer Platform > Pages > Edit, expiry 1 year, saved as repo secret `CLOUDFLARE_API_TOKEN`. Account ID `2e5bef97d31f8048a95d39221f12f214` (not secret; becomes repo variable `CLOUDFLARE_ACCOUNT_ID`).
- Supabase Authentication > URL Configuration: Site URL and redirect list exactly `https://minifighunt.com/`, no wildcard.
- MVP 2: custom SMTP account before anyone but the owner can sign in.
- Supabase keys are in `.env` (2026-10-31); a database password or access token may also be needed for migrations. Telegram bot token and chat id: repo-root `.env` and a NAS copy. Key names unverified: a deny rule blocks reading `.env`.

## Rules worth keeping at hand
- Agent merges feature PRs into dev after code-reviewer and qa pass on the final diff (`gh pr merge <n> --merge`). The auto classifier refuses it otherwise.
- Re-render cards: `python scripts/build_cards.py <ids>` (no args builds only missing cards).
- Figure images: `img.bricklink.com/ItemImage/SN/0/<code>-<n>.png`. 71049 has no code and keeps v1 images.
- Logos: only files with real alpha (memory `feedback-asset-search`).

## Tests (2026-11-08, dev + docs branch)
`npx vitest run` in `app/`: 235 pass. `python -m pytest tests`: 95 pass (97 on `feature/V2-13-front-photos`). `npm test` in `supabase/`: 84 pass (dev after PR #44).
Older (2026-11-04): `node --test scripts/smoke_auth.test.mjs`: 14 pass. `npx vitest run` in `app/`: 71 pass, 4 files; `npm ci` first if `node_modules` is empty. `python -m pytest tests`: 95 pass.

## Open questions
- Ages unreadable for 8909, 8805, 8684; no age is printed on their cards.
- One unreproduced `app/` vitest failure in 6 QA runs (2026-11-02): possibly flaky, name lost.
- Later, optional: `workflow_dispatch` for manual redeploy; deploy-job concurrency `{group: pages, cancel-in-progress: false}`; series page hero in mockup D still uses the bag image.
- `scripts/build_cards.py` review items deferred: Chrome stderr hidden on failure (line 144), hardcoded Chrome path (line 18). Weakest card images, replace if better ones appear: 600x450 grids on stands (71023, 71007, 71002, 71000, 8833, 8831), white-background cut-outs (8683, 8684, 8805, 8804, 8827).

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [context cost](context-cost.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md) · history up to 2026-11-03: [archive/handoff-2026-11-03.md](archive/handoff-2026-11-03.md)
