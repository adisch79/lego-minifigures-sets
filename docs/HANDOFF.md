# HANDOFF

## Current state (updated 2026-11-18, MVP 2.1: V2-09/15/16 on dev, not released; NEXT V2-18)
- **Live:** https://minifighunt.com/ on Cloudflare Pages (V2-06, 2026-11-07); `www` 301 to apex. GitHub Pages switched off. Releases: V2-04+V2-05 PR #35, V2-06 PR #38 ([backlog](backlog.md)).

## Next step: MVP 2.1 owner fixes, ONE AT A TIME (updated 2026-11-08)
Owner rule (memory `feedback-one-fix-at-a-time`): each message covers exactly one fix (what changed, proof, the one thing the owner does). Wait for the owner's answer before the next. Never report several fixes together.
Queue (backlog MVP 2.1):
1. **V2-08 alerts pause.** DONE 2026-11-08 (live). Re-enable SQL: header of `supabase/migrations/20261108000000_v2_08_pause_wanted_alerts.sql`; do NOT re-enable before a global cap (open sign-up).
2. **V2-07 rename to Minifig Hunt.** DONE, live (PR #46).
3. **V2-10 admin link.** DONE on dev (PR #47).
4. **V2-12 site icon.** DONE on dev (PR #48).
5. **V2-11 card layout v5.** DONE on dev (PR #51, d0467f3). History: [archive/handoff-2026-11-17.md](archive/handoff-2026-11-17.md).
6. **V2-13 front photos.** DONE on dev (PR #53, 2bbbac7). Gaps: 71049 no front photos, 71014 9 of 16, 8909 9.
7. **V2-14 mock user.** DONE 2026-11-16 (owner confirmed sign-in as non-admin). Was: owner adds `adisch79+user@gmail.com` in https://minifighunt.com/#admin and signs in with it in a private window (not needed after V2-09).
8. **V2-09 open sign-up.** DONE on dev 2026-11-16: PR #54 merged (9cf5715). Design + both reviews + QA pass (app 228, supabase 82, pytest 102). NOT live: needs release into master, then `supabase db push` (migration 20261116000000), redeploy `admin-people`, then owner steps in order (docs/design/V2-09-open-signup.md: Turnstile key in Pages env + deploy + widget check, captcha secret in Supabase, custom SMTP (V2-16), rate limits with SOURCE, Confirm signup template with {{ .Token }}, sign-up ON last). NEXT: item 9 V2-15.
9. **V2-15 contact + coffee pages.** DONE on dev: PR #55 (About page C, form UI) b409371, PR #56 (contact-message Edge Function, contact_messages table, admin Messages A) 1dc5945. NOT live: release, `supabase db push`, deploy `contact-message`, Turnstile secret. Coffee link 'Coming soon' until Ko-fi (V2-17). History: [archive/handoff-2026-11-18.md](archive/handoff-2026-11-18.md).
10. **V2-16 branded auth emails.** DONE on dev: PR #57 1cd8d73, owner signed off 2026-11-18. Templates `supabase/templates/`, paste steps `supabase/README.md`. Email links `{{ .SiteURL }}?token_hash=...&type=email`; app shows 'Continue sign-in' before verifyOtp (decisions.md). NOT live: release, owner pastes both templates + subjects in Supabase dashboard (Site URL `https://minifighunt.com/`), sender name needs SMTP + DNS.
11. **V2-17 business model**: owner DECIDED 2026-11-17 (Ko-fi, affiliate sign-ups, ask LEGO). Ko-fi slot already on dev (`app/src/kofi.ts`, empty = 'Coming soon'). 2026-11-18: owner steps written: [V2-17-owner-steps.md](V2-17-owner-steps.md) (Ko-fi, Amazon Associates, LEGO.com via LinkShare, LEGO question text). WAITING on owner: Ko-fi link, Amazon store ID, LEGO affiliate result, LEGO answer.
12. **V2-18 Fair Play disclaimer** (Ready, S): site has no 'not endorsed' footer and no registered mark. NEXT to build. Then V2-19 affiliate links (blocked on owner answers).
Docs PR #42 merged. Untracked leftover `mockups/V2-11/tmp/` in worktree agent-a11b373be5017f407 (delete was denied).
Previous next-step text (V2-04/05/06, all done): [archive/handoff-2026-11-07.md](archive/handoff-2026-11-07.md).

## Owner-needed
- MVP 2: custom SMTP account before anyone but the owner can sign in.
- Supabase keys are in `.env` (2026-10-31); a database password or access token may also be needed for migrations. Telegram bot token and chat id: repo-root `.env` and a NAS copy. Key names unverified: a deny rule blocks reading `.env`.

## Rules worth keeping at hand
- Agent merges feature PRs into dev after code-reviewer and qa pass on the final diff (`gh pr merge <n> --merge`). The auto classifier refuses it otherwise.
- Re-render cards: `python scripts/build_cards.py <ids>` (no args builds only missing cards).
- Figure images: `img.bricklink.com/ItemImage/SN/0/<code>-<n>.png`. 71049 has no code and keeps v1 images.
- Logos: only files with real alpha (memory `feedback-asset-search`).

## Tests (2026-11-18 wrap, dev 1cd8d73)
`npx vitest run` in `app/`: 358 pass, `npx tsc --noEmit` clean. `npm test` in `supabase/`: 133 pass. `python -m pytest tests`: 102 pass. Local `dev` branch is stale: test against `origin/dev` (worktree `.claude/worktrees/qa-dev`).

## Open questions
- V2-16 follow-up nits (review of 3f27c2b): `invalidTokenLink` module flag never reset on useAuth remount (auth.ts:86-98,196); code sign-in does not clear an old token-link failure (auth.ts:231-233); `stripDismissed` never reset (Account.tsx:41-45); no test for success-after-failure.
- V2-09 default: admin collectors list drops rows with no email (email-only sign-in, cannot happen today).
- Ages unreadable for 8909, 8805, 8684; no age is printed on their cards.
- One unreproduced `app/` vitest failure in 6 QA runs (2026-11-02): possibly flaky, name lost.
- Later, optional: `workflow_dispatch` for manual redeploy; deploy-job concurrency `{group: pages, cancel-in-progress: false}`; series page hero in mockup D still uses the bag image.
- `scripts/build_cards.py` review items deferred: Chrome stderr hidden on failure (line 144), hardcoded Chrome path (line 18). Weakest card images, replace if better ones appear: 600x450 grids on stands (71023, 71007, 71002, 71000, 8833, 8831), white-background cut-outs (8683, 8684, 8805, 8804, 8827).

## Docs
[backlog](backlog.md) · [decisions](decisions.md) · [context cost](context-cost.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md) · history up to 2026-11-03: [archive/handoff-2026-11-03.md](archive/handoff-2026-11-03.md) · done V1-07/V2-01/V2-02 notes: [archive/handoff-2026-11-09.md](archive/handoff-2026-11-09.md)
