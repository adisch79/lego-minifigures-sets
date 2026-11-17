# V2-09 Open sign-up: design

Backlog row: docs/backlog.md (V2-09). Reviews 2026-11-16: design-reviewer (4 blocking), security-reviewer (1 blocking). Decisions: docs/decisions.md 2026-11-16.

## Behaviour
- Anyone can create an account with the email link or code. No allowlist check.
- Admin page lists every auth user (not only allowlist rows), and the wanted wall shows every user.
- Admin "Remove" is renamed "Delete account": deletes the user and data. The person may sign up again (owner pick).
- Sign-in and sign-up require a Cloudflare Turnstile token (`captchaToken` in `signInWithOtp` options).

## Database (new migration `v2_09_open_signup`)
- Drop BOTH triggers `enforce_allowlist_on_insert` and `enforce_allowlist_on_email_update`.
- KEEP `block_email_change` (stops moving an account to another address).
- KEEP `private.enforce_allowlist()` and `public.allowlist` table (rollback path; schema.test.js:211).
- New `admin_people_list()` over `auth.users` left join profiles/admins/marks, same admin check, `security definer`, `search_path=''`, same revoke/grant as v2_05. Rewrite `admin_wanted_list` without the allowlist join.
- Rollback comment in the migration header (verbatim SQL): backfill `insert into public.allowlist select lower(email) from auth.users on conflict do nothing`, recreate both triggers, then app `shouldCreateUser: false`, Supabase sign-up flag off.

## App and function
- app/src/auth.ts:91 `shouldCreateUser: true`; pass `captchaToken`; keep a uniform answer (anti-enumeration); `signup_disabled` handling stays until the flag flips.
- admin-people `remove`: delete user only, no allowlist write. Decide whether `add` stays (default: drop the invite UI; admins no longer invite).
- Copy: "If this address is invited" (Account.tsx), "Invite/Invited collectors" (Admin.tsx, adminLogic.ts), stale comment auth.ts:78.
- v2_08 re-enable block: comment that Telegram alerts need a global cap before re-enabling (any stranger could get 20 messages/hour each).

## Owner steps at release (exact text delivered with the PR)
1. Turnstile site key + secret (Cloudflare dashboard).
1a. Set `VITE_TURNSTILE_SITE_KEY` in the Cloudflare Pages build env, redeploy, check the widget loads on the sign-in form. Only then put the secret into Supabase Auth > Attack Protection and switch captcha on (captcha on before the widget ships blocks every sign-in, existing users included).
2. Custom SMTP (V2-16) with its own hourly cap; SPF/DKIM for the sender domain.
3. Auth rate limits for emails per hour and OTP per IP: values to be set and recorded with SOURCE at release (UNKNOWN now).
4. "Confirm signup" email template includes `{{ .Token }}` (new users get this template, not "Magic link").
5. "Allow new users to sign up" ON, last, and only after steps 1-3 are done and the rate-limit values are recorded with SOURCE.
6. Smoke test with a fresh address: link path and code path.
