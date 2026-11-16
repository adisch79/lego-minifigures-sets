# V2-15 About page (contact + coffee): design

Backlog row: docs/backlog.md (V2-15). Owner pick: C "The collector's story" (decisions.md 2026-11-16).
Mockup: branch feature/V2-15-mockups 5c0cbcb, `mockups/V2-15/c.html`, `c.png`, `c-390.png`, sheet `sheet.png`.
Earlier decisions: coffee link later, "Coming soon" while empty; contact is a form, no address on the page;
backend = Supabase Edge Function + table, Turnstile, no new third-party host (decisions.md 2026-11-16);
Ko-fi is the donation provider (V2-17, decisions.md 2026-11-17).

## Delivery in two PRs (depth first, demo after PR 1)
- **PR 1 `feature/V2-15-about-page`:** About page, header About link, footer links, coffee chapter, contact form UI.
  Form submit calls the endpoint from PR 2; until PR 2 is live the form shows "The contact form opens soon"
  (disabled) because `VITE_CONTACT_ENABLED` is unset.
- **PR 2 `feature/V2-15-contact-backend`:** migration, Edge Function `contact-message`, admin "Messages" list,
  then `VITE_CONTACT_ENABLED=1` in the Pages env at release.

## Page (PR 1)
- Route `#about`. Chapter anchors `#about/support` and `#about/write` scroll to the chapter (the hash router
  owns `#`, so no plain `#support`). Header: "About" link next to Sign in (mockup C frame 01). Footer on every
  page: "Fan-made site, not affiliated with the LEGO Group" + links About, Contact (`#about/write`),
  Buy me a coffee (`#about/support`).
- Layout per c.png: dark story column left ("One collector. Every figure.", story text, stats, figure cut-outs);
  right column chapters 01 Support the site, 02 Write to me. At 390 px the columns stack (c-390.png).
- Stats (series count, figure count, year range) are computed from the loaded catalog, never typed in.
- Figure images: cut-outs already in `site/img/` only. No bag art, no LEGO logo (Fair Play, decisions.md V2-16).
- Copy: from c.html, with "Buy me a coffee" wording kept as the button text and "Ko-fi" named in the small print.

## Coffee chapter (PR 1)
- `KOFI_URL` constant in one module, `''` now. SOURCE: OWNER-SUPPLIED (pending Ko-fi account, V2-17).
- Empty: button disabled, label "Coming soon", note "The payment page is being set up." Set: a normal link,
  `target="_blank" rel="noopener noreferrer"`, note "Opens a secure payment page in a new tab".
- Unit test covers both states.

## Contact form (UI in PR 1, wired in PR 2)
- Fields: name (optional, max 80), email (required, for the reply, max 254, basic shape check),
  message (required, 1 to 2000 characters, counter "n / 2000"), Turnstile widget (reuse `Turnstile.tsx`).
- States: idle, sending (button disabled), sent ("Thanks, <name>. Message received." + "Send another message"),
  rate limited ("Too many messages from here. Try again later."), error ("Could not send. Try again.").
- Privacy line under the form: "Your email is used only to answer you. It is not shown, shared or added to a list."
- No message text or email in console logs.

## Backend (PR 2)
### Table (migration `v2_15_contact_messages`)
- `public.contact_messages`: `id bigint identity pk`, `created_at timestamptz default now()`, `name text`
  (check length <= 80), `email text not null` (<= 254), `message text not null` (1..2000), `ip_hash text not null`,
  `read_at timestamptz`.
- RLS on, no policies; `revoke all` from `anon`, `authenticated`. Only the service role writes.
- Admin RPCs, `security definer`, `search_path = ''`, same admin check and revoke/grant pattern as v2_05:
  `admin_contact_list()` (newest first, limit 200), `admin_contact_mark_read(id)`, `admin_contact_delete(id)`.
- Retention: rows older than 365 days deleted by the same function on each insert
  (`delete ... where created_at < now() - interval '365 days'`). Default, logged in decisions.md.

### Edge Function `contact-message` (verify_jwt = false, anonymous callers)
- Same structure as admin-people: `index.ts` (wiring) + `logic.ts` (pure, tested in `logic.test.js`).
- POST only; CORS and Origin check against the site origins (reuse the admin-people allowlist logic);
  body read capped at 8 KB; JSON parse; field validation as above (server is the authority).
- Turnstile: server-side siteverify with secret `TURNSTILE_SECRET_KEY` (function secret, same value as the
  Auth captcha secret), check `success` and `hostname` in the site hosts.
  SOURCE: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Rate limit, counted in the table: per IP hash at most 3 messages per hour; global at most 50 per day.
  Both values DEFAULT (no owner source), logged in decisions.md, constants carry `SOURCE: DEFAULT, decisions.md`.
- `ip_hash` = SHA-256 of (`CONTACT_IP_SALT` secret + client IP from `cf-connecting-ip`, else first
  `x-forwarded-for`). Raw IP is never stored or logged.
- Responses: 200 `{ok:true}`; 400 `{error:"invalid"}`; 403 `{error:"captcha"}`; 429 `{error:"rate_limited"}`;
  500 `{error:"internal"}`. Logs carry the error class only, never the body, email or IP.
- No mail is sent. Forward to the owner's mailbox comes with custom SMTP (V2-16).

### Admin page
- New "Messages" section: date, name, email, message (text only, rendered as text, never HTML), unread dot,
  buttons "Mark read" and "Delete". Uses the RPCs above with the signed-in admin's session.

## Tests
- App: route `#about` renders; chapter anchors scroll; coffee button both states; form validation, counter,
  every state; footer present on home, series, about; stats come from catalog.
- Function `logic.test.js`: method, origin, body cap, each field rule, captcha fail, hostname mismatch,
  per-IP and global limits, no PII in logs, uniform error bodies.
- Supabase tests: table not readable or writable by anon/authenticated; RPCs refuse non-admins; retention delete.

## Release (PR 2, owner steps delivered as exact commands with the PR)
1. `supabase db push` (migration v2_15).
2. `supabase secrets set TURNSTILE_SECRET_KEY=<same as Auth captcha> CONTACT_IP_SALT=<random>`.
3. `supabase functions deploy contact-message --no-verify-jwt`.
4. Pages env `VITE_CONTACT_ENABLED=1`, redeploy; send one test message; see it on the admin page.

## Not in this story
- Ko-fi account and link (owner, V2-17). Mail forward (V2-16 SMTP). Affiliate links (new story, V2-17).
