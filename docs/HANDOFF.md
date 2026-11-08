# HANDOFF

## Current state (updated 2026-11-07, V2-05 released (PR #35), V2-06 Cloudflare prepared)
- **Live:** https://minifighunt.com/ on Cloudflare Pages (V2-06, 2026-11-07); `www` 301 to apex. GitHub Pages switched off. Releases: V2-04+V2-05 PR #35, V2-06 PR #38 ([backlog](backlog.md)).
- **V1-07 card redesign:** owner signed off 2026-11-04; review and QA passed; released: PR #18 into dev, PR #19 into master, deploy success, live card verified 2026-11-03. Cards in `app/public/cards/`, built by `scripts/build_cards.py`; group images in `mockups/assets/group/` (SOURCES.md).
- **V2-01:** PR #17 merged into dev (2026-11-02). Migration applied to the live project by the owner in the SQL Editor (2026-11-04, "Success. No rows returned"). First admin created. Signups switched off in the dashboard. `node scripts/smoke_auth.mjs`: all 9 checks pass (2026-11-04). Live sign-in smoke test passes 5 of 5 (2026-11-04). V2-01 done: smoke script reviewed, QA passed, PR #20 into dev.
- **V2-02 sign-in:** PR #21 merged into dev as `b84c942` (2026-11-05). Link only, PKCE; direction A pill and popover (`mockups/V2-02/a.html`, owner pick). Code review, security review and QA passed; vitest 107. Repo variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set. Live: release PR #24 into master 2026-11-05 (with V2-03).
- **Context-cost hook:** built, registered, 9 of 9 acceptance cases pass (2026-11-03); fired live at 171k context (2026-11-04). Cost measurements: [context-cost.md](context-cost.md).

## Next step
**V2-05 admin page: PR #33 merged into dev as `4afff6e` (2026-11-07)**, branch `feature/V2-05-admin-ui` (worktree `.claude/worktrees/agent-af3c0ecec5f8cbd78`; includes backend branch `feature/V2-05-admin`). Code review, re-review, security review (gate fixed: shared-origin CI guard `scripts/check_pages_origin.mjs`) and QA all passed: app 229 tests, supabase 78, pytest 95, catalog 52 series / 787 figures, no regression vs dev. Screenshots `mockups/V2-05/built-*.png` match mockup C.
1. Done: CI green, merged.
2. Release (2026-11-07): release PR #35 dev into master open; migration pasted and `admin-people` deployed (ACTIVE v1, verify_jwt true, 401 without token) 2026-11-07. Owner merged PR #35 2026-11-07; master App CI build, pages-origin-guard, deploy all success; live bundle contains `admin-people`. V2-04 and V2-05 are live. Left: owner signs in and opens `#admin` on the live site.
3. Then V2-06 Cloudflare Pages move (backlog). Cloudflare account + 2FA done, token saved as secret `CLOUDFLARE_API_TOKEN` (Account API token, Developer Platform > Pages > Edit, 1 year), variable `CLOUDFLARE_ACCOUNT_ID` set. Domain `minifighunt.com` bought 2026-11-07 at Cloudflare Registrar (decisions.md): it is the V2-06 origin.
**V2-04 Telegram alert: done and live** (PR #26 into dev, 2026-11-06). Function `telegram-alert` deployed (v1) to `minifigures-app` (ref `iagnfgedasxkqqjbsoeg`), migration pasted in the SQL Editor (do not `db push`: V2-01 was also applied by hand, so the CLI history is empty). Owner confirmed a Telegram message on a wanted mark 2026-11-06. First try failed with 401: Vault `alert_hook_secret` differed from `ALERT_HOOK_SECRET`; owner reset both. `net` grants from `supabase_admin` accepted (decisions.md). Not yet on master: the release PR dev into master is pending.
Secret names: function `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ALERT_HOOK_SECRET`; Vault `alert_hook_secret` (same value), `alert_hook_url`; header `x-alert-secret`. Owner was asked (2026-11-06) to add the two Telegram secrets in Supabase Edge Functions > Secrets; not yet confirmed. Project is `minifigures-app`; the second project in the org is not this app.
- PR #22 (docs) merged into dev as `5ff82a3`.
- Real Supabase error codes for unlisted addresses are untested; the UI maps them to the same answer.
- Smoke test: `node scripts/smoke_auth.mjs` sends no mail. `send <email>`, then `verify-link '<link>' <other-email>`: copy the link without opening it. Built-in mail allows 2 per hour and the full run uses both.

## Owner-needed
- Hosting move decided 2026-11-07: Cloudflare Pages (story V2-06, after V2-05 release). Owner step 1 done 2026-11-07 (account + 2FA). Owner step 2 in progress: account API token, policy Entire Account > Developer Platform > Pages > Edit, expiry 1 year, saved as repo secret `CLOUDFLARE_API_TOKEN`. Account ID `2e5bef97d31f8048a95d39221f12f214` (not secret; becomes repo variable `CLOUDFLARE_ACCOUNT_ID`).
- Supabase Authentication > URL Configuration: Site URL and redirect list exactly `https://minifighunt.com/`, no wildcard.
- MVP 2: custom SMTP account before anyone but the owner can sign in.
- Supabase keys are in `.env` (2026-10-31); a database password or access token may also be needed for migrations. Telegram bot token and chat id: repo-root `.env` and a NAS copy. Key names unverified: a deny rule blocks reading `.env`.

## V2-06 cutover state (2026-11-07)
Done: (a) env secret set, (b) Pages project `minifighunt` created, (d) `admin-people` redeployed (CORS: both origins 204, other 403), (e) release PR #38 merged, master run all 4 jobs success, `minifighunt.pages.dev` 200. (f) domain attached via API with the wrangler OAuth token (`POST /accounts/<id>/pages/projects/minifighunt/domains`); owner added CNAME `@` to `minifighunt.pages.dev` (proxied); domain `active`; `https://minifighunt.com/` 200 with all five headers (CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy). (c) Supabase URL config: owner confirmed. `telegram-alert` redeployed v3 (SITE_URL minifighunt.com). (g) owner: sign-in and `#admin` work on PC. `www`: proxied record + Redirect Rule, `https://www.minifighunt.com/abc?q=1` 301 to `https://minifighunt.com/abc?q=1`; `http://www` still 522 until SSL/TLS > Edge Certificates > Always Use HTTPS is on. Android showed NXDOMAIN (www missing then; negative TTL 1800 s). Then telegram-alert deploy, (g), (h).

## V2-06 owner steps (Cloudflare Pages, origin https://minifighunt.com)
Branch `feature/V2-06-cloudflare-pages`. Code ready; nothing deployed, no Supabase setting touched. Order matters.
1. (a) GitHub environment `cloudflare-pages`, limited to branch `master`, holds secret `CLOUDFLARE_API_TOKEN` (the agent creates the environment; move the secret from repo secrets into it and delete the repo-level copy). Token: Custom token, permission Account > Cloudflare Pages > Edit, this account only, no zone or DNS permissions, expiry 1 year. Never the Global API Key.
2. (b) Create the Pages project once (CI cannot create it): name `minifighunt`, production branch `master`. `npx wrangler pages project create minifighunt --production-branch=master` or dashboard Workers & Pages > Create > Pages > Direct Upload.
3. (c) Supabase Authentication > URL Configuration: Site URL `https://minifighunt.com/`; Redirect URLs exactly `https://minifighunt.com/` and `https://adisch79.github.io/lego-minifigures-sets/`. No wildcard.
4. (d) Deploy `admin-people` now (accepts both origins during cutover): `npx --yes supabase functions deploy admin-people --remote=iagnfgedasxkqqjbsoeg --yes`. Deploy `telegram-alert` only after step (f) (its SITE_URL points at the new domain): `npx --yes supabase functions deploy telegram-alert --remote=iagnfgedasxkqqjbsoeg --yes`.
5. (e) Merge the release PR into master. The `deploy-cloudflare` job publishes to `minifighunt.pages.dev`; the GitHub Pages deploy still runs.
6. (f) Dashboard Workers & Pages > minifighunt > Custom domains: attach `minifighunt.com` (DNS record is added automatically). `www` only as a 301 redirect to `https://minifighunt.com/`, never a second serving domain. Then deploy `telegram-alert` (see d).
7. (g) Smoke: `node scripts/smoke_auth.mjs`, then `send <email>` and `verify-link '<link>' <other-email>` (redirect check expects `https://minifighunt.com/`); open `https://minifighunt.com/#admin`. Header gate, required before (h): `curl -sI https://minifighunt.com/ | grep -i "content-security\|strict-transport\|nosniff\|referrer\|permissions-policy"` must show all five.
8. (h) Done 2026-11-07: PR #39 into dev, release PR #40 merged (master run: build, deploy-cloudflare success; apex 200). GitHub Pages unpublished by agent (`gh api -X DELETE .../pages`; old URL 404). `admin-people` redeployed by agent: minifighunt.com 204, adisch79.github.io 403. Owner removed the GitHub URL from the Supabase redirect list and turned on Always Use HTTPS (2026-11-07). V2-06 then done; next story per backlog. Original text: Only after (g) passes: GitHub repo Settings > Pages > Unpublish site; remove the GitHub URL from the Supabase redirect list and `https://adisch79.github.io` from `ALLOWED_ORIGINS` in `supabase/functions/admin-people/logic.ts` (redeploy); redirect `minifighunt.pages.dev/*` to `https://minifighunt.com/` with a Cloudflare Bulk Redirect. Follow-up PR deletes the `deploy` job and `pages-origin-guard` (the guard protects `adisch79.github.io` until then).

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
