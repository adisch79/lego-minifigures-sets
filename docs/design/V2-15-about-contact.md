# V2-15 About page (contact + coffee): design

Backlog row: docs/backlog.md (V2-15). Security review 2026-11-16: 3 blocking, 6 should-fix, 4 nits, all folded in. Design review 2026-11-16: no blocking, 10 should-fix, folded in. Owner pick: C "The collector's story" (decisions.md 2026-11-16).
Mockup: branch feature/V2-15-mockups 5c0cbcb, `mockups/V2-15/c.html`, `c.png`, `c-390.png`, sheet `sheet.png`.
Earlier decisions: coffee link later, "Coming soon" while empty; contact is a form, no address on the page;
backend = Supabase Edge Function + table, Turnstile, no new third-party host (decisions.md 2026-11-16);
Ko-fi is the donation provider (V2-17, decisions.md 2026-11-17).

## Delivery in two PRs (depth first, demo after PR 1)
- **PR 1 `feature/V2-15-about-page`:** About page, header About link, footer links, coffee chapter, contact form UI.
  PR 1 also owns the client call module `contactApi.ts` (POST to `functions/v1/contact-message`, maps
  200/400/403/429/500 to UI states), tested with a mocked fetch. The form is enabled only when BOTH
  `VITE_CONTACT_ENABLED` and `VITE_TURNSTILE_SITE_KEY` are set; otherwise it shows "The contact form opens soon"
  (disabled) and the Turnstile script is not loaded.
- **PR 2 `feature/V2-15-contact-backend`:** migration, Edge Function `contact-message`, admin "Messages" list,
  then `VITE_CONTACT_ENABLED=1` in the Pages env at release. Order: V2-09 released (at least its owner step 1,
  Turnstile keys) before PR 2 goes live. The admin "Messages" UI needs 3 mockups (CLAUDE.md section 10) before PR 2
  is built.

## Page (PR 1)
- Route `#about`. Chapter anchors `#about/support` and `#about/write` scroll to the chapter (the hash router
  owns `#`, so no plain `#support`). Router: `parseRoute` in app/src/series.ts:22, Route type series.ts:4; add
  `{page:'about', chapter?: 'support'|'write'}`; `#about/` and unknown chapters open the page top; flip
  series.test.ts:56 (today `#about` returns home). `pageKey` (App.tsx:333) stays `'about'` for every chapter so the
  page-change effect (App.tsx:378-393) does not refocus h1 per chapter; the chapter scroll runs after that effect
  and also on a hash change while already on About. Add About to the title effect (App.tsx:395-406). Header: "About" link next to Sign in (mockup C frame 01). Footer on every
  page: "Fan-made site, not affiliated with the LEGO Group" + links About, Contact (`#about/write`),
  Buy me a coffee (`#about/support`).
- Layout per c.png: dark story column left ("One collector. Every figure.", story text, stats, figure cut-outs);
  right column chapters 01 Support the site, 02 Write to me. At 390 px the columns stack (c-390.png).
- Stats (series count, figure count, year range) reuse `Stats` (App.tsx:77) on the loaded catalog, never typed
  in. While loading or after a load error the stats row is hidden (no `Math.min(...[])` = Infinity).
- Figure images: cut-outs already in `site/img/` only. No bag art, no LEGO logo (Fair Play, decisions.md V2-16).
- Copy: from c.html, with "Buy me a coffee" wording kept as the button text and "Ko-fi" named in the small print.

## Coffee chapter (PR 1)
- `KOFI_URL` constant in one module, `''` now. SOURCE: OWNER-SUPPLIED (pending Ko-fi account, V2-17).
- Empty: button disabled, label "Coming soon", note "The payment page is being set up." Set: a normal link,
  `target="_blank" rel="noopener noreferrer"`, note "Opens a secure payment page in a new tab".
- Unit test covers both states.

## Contact form (UI in PR 1, wired in PR 2)
- Fields: name (optional, max 80, no control characters), email (required, for the reply, max 254,
  same rules as `normalizeEmail` in admin-people logic.ts: ASCII, no whitespace or control characters),
  message (required, 1 to 2000 code points, control characters other than 
 and 	 rejected,
  counter "n / 2000" counts code points like the server and the DB), Turnstile widget (reuse `Turnstile.tsx`,
  with `action="contact"`).
- States: idle, sending (button disabled), sent ("Thanks, <name>. Message received." + "Send another message"),
  rate limited ("Too many messages from here. Try again later."), error ("Could not send. Try again.").
- Privacy line under the form: "Your email is used only to answer you. It is not shown, shared or added to a list.
  Messages are kept for up to a year. To stop spam, a scrambled form of your network address is kept for one hour."
- No message text or email in console logs.

## Backend (PR 2)
### Table (migration `v2_15_contact_messages`, applied by pasting into the SQL Editor, never `db push`)
- `public.contact_messages`: `id bigint identity pk`, `created_at timestamptz default now()`, `name text`
  (check length <= 80), `email text not null` (<= 254), `message text not null` (1..2000), `ip_hash text` (nullable, see next sentence),
  `read_at timestamptz`. `ip_hash` is nullable and set to null once its 1-hour window ends (inside `contact_submit`).
  Indexes on `(ip_hash, created_at)` and `(created_at)`.
- RLS on, no policies; `revoke all` on the table and its sequence from `anon`, `authenticated`.
- Write path: one RPC `contact_submit(p_name, p_email, p_message, p_ip_hash)`, `security definer`,
  `search_path = ''`, EXECUTE revoked from `public, anon, authenticated`, granted to `service_role` only.
  In one transaction: `pg_advisory_xact_lock`, check both limits, insert, null old `ip_hash` values, retention
  delete. Returns `ok` or `rate_limited`. The function never writes the table directly (no count-then-insert race).
- Admin RPCs, `security definer`, `search_path = ''`, same admin check and revoke/grant pattern as v2_05:
  `admin_contact_list()` (`stable`, newest first, limit 200), `admin_contact_mark_read(id)` and
  `admin_contact_delete(id)` (`volatile`: they write). Migration file `2026111x000000_v2_15_contact_messages.sql`.
  Grants spelled out: `revoke execute on function public.admin_contact_list(), public.admin_contact_mark_read(bigint),
  public.admin_contact_delete(bigint) from public, anon, authenticated;` then `grant execute ... to authenticated`;
  the admin check inside each function.
- Retention: rows older than 365 days deleted inside `contact_submit` on each insert
  (`delete ... where created_at < now() - interval '365 days'`). Default, logged in decisions.md.
  With no new messages, old rows stay until the next insert; accepted.

### Edge Function `contact-message` (verify_jwt = false, anonymous callers)
- Same structure as admin-people: `index.ts` (wiring) + `logic.ts` (pure, tested in `logic.test.js`).
- config.toml: `[functions.contact-message] verify_jwt = false`, comment: Turnstile plus the limits are the gate.
- POST only; CORS and Origin check against the site origins (reuse the admin-people allowlist logic);
  body read capped at 16 KB (2000 code points can be 8000 bytes, plus a Turnstile token); JSON parse; field validation as above (server is the authority).
- Turnstile: server-side siteverify with secret `TURNSTILE_SECRET_KEY` (function secret, same value as the
  Auth captcha secret), check `success`, `hostname` in (`minifighunt.com`; local dev uses Cloudflare test keys) and `action == "contact"` (a token from
  the sign-in widget is refused). Network error or timeout: fail closed with 403.
- The Origin check only blocks other web pages; non-browser clients can fake it. Turnstile and the limits are
  the abuse controls.
  SOURCE: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Rate limit, enforced atomically in `contact_submit`: per IP hash at most 3 messages per hour; global at most 50 per day.
  Both values DEFAULT (no owner source), logged in decisions.md, constants carry `SOURCE: DEFAULT, decisions.md`.
- `ip_hash` = HMAC-SHA-256(`CONTACT_IP_SALT` secret, client IP). Client IP source is UNKNOWN until a probe:
  first step of PR 2 deploys a throwaway function that logs only header names and whether a spoofed
  `cf-connecting-ip` / `x-forwarded-for` value survives the Supabase gateway (never values). Use only a header the
  gateway sets or overwrites (or the right-most entry it appends); record the answer with a SOURCE. A request with
  no usable IP header goes into one shared "unknown" bucket under the same limit. If none is trustworthy, drop the per-IP limit,
  keep the global cap, and record that in decisions.md. `remoteip` goes to siteverify only with a trusted IP.
- Raw IP is never stored or logged by this function (the Supabase platform's own edge logs are outside our control).
- Responses: 200 `{ok:true}`; 400 `{error:"invalid"}`; 403 `{error:"captcha"}`; 429 `{error:"rate_limited"}`;
  500 `{error:"internal"}`. Logs carry the error class only, never the body, email or IP.
- No mail is sent. Forward to the owner's mailbox comes with custom SMTP (V2-16).

### Admin page
- New "Messages" section: date, name, email, message (rendered as React text, no `dangerouslySetInnerHTML`;
  bidi override characters U+202A-202E and U+2066-2069 stripped on display; any `mailto:` link uses
  `encodeURIComponent`), unread dot,
  buttons "Mark read" and "Delete". Uses the RPCs above with the signed-in admin's session.

## Tests
- App: fresh Turnstile token (resetKey bump, Turnstile.tsx:55) after every submit incl. errors and 429;
  disabled "opens soon" state with no Turnstile script; coffee link `rel`/`target` when set; stats hidden while
  loading; route `#about` renders; chapter anchors scroll; coffee button both states; form validation, counter,
  every state; footer present on home, series, about; stats come from catalog.
- Function `logic.test.js`: method, origin, body cap, each field rule (control characters, code-point count),
  captcha fail, siteverify timeout fails closed, hostname and action mismatch, rate_limited mapping,
  no PII in logs, uniform error bodies, OPTIONS preflight and CORS allow-headers for anonymous callers,
  non-JSON Content-Type, missing `CONTACT_IP_SALT` or `TURNSTILE_SECRET_KEY` fails closed (500), missing IP header.
- Supabase tests: table and sequence not readable or writable by anon/authenticated; anon gets an error on every
  RPC; admin RPCs refuse non-admins; `contact_submit` only for service_role; per-IP and global limits;
  `ip_hash` nulled after 1 hour; retention deletes only rows older than 365 days. schema.test.js:293 (functions
  `authenticated` may execute) gains the 3 admin RPCs. Admin demo data (adminDemo.ts) gains a Messages fixture.

## Release (PR 2, owner steps delivered as exact commands with the PR)
1. Paste migration v2_15 into the Supabase SQL Editor (project rule, supabase/README.md; never `db push`).
2. `supabase secrets set TURNSTILE_SECRET_KEY=<same as Auth captcha> CONTACT_IP_SALT=<random>`.
3. `supabase functions deploy contact-message --no-verify-jwt --project-ref iagnfgedasxkqqjbsoeg`.
4. Pages env `VITE_CONTACT_ENABLED=1`, redeploy; send one test message; see it on the admin page.

## Not in this story
- Ko-fi account and link (owner, V2-17). Mail forward (V2-16 SMTP). Affiliate links (new story, V2-17).
