#!/usr/bin/env node
// Live smoke test of the Supabase auth settings for V2-01 (docs/design/V2-01-schema.md).
// Auth settings live outside migrations, so this checks the real project.
//
// Reads SUPABASE_URL and SUPABASE_ANON_KEY from the git-ignored repo-root .env.
// Uses the public anon key only. Never prints keys, codes or tokens.
//
// Usage:
//   node scripts/smoke_auth.mjs                 checks that send no mail
//   node scripts/smoke_auth.mjs send <email>    mails a sign-in code or link to a listed address
//   node scripts/smoke_auth.mjs verify <email> <code> <other-email>
//       signs in with the code, then checks that an email change is refused.
//       Auth mails <other-email> before refusing, so use an address you control.
//   node scripts/smoke_auth.mjs verify-link '<link>' <other-email>
//       same checks for a link-only email. Copy the link without opening it: opening uses it up.
//       Quote the link: it contains &. The script reads the link and never requests it.
//
// Warning: the refusal checks really try to sign up. On a project with signups on, they
// create an anonymous user and a user for smoke-unlisted@example.invalid. Delete both.
//
// Exit code: 0 all passed, 1 a check failed, 2 could not run.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Test override: SMOKE_ENV_FILE points at another env file.
const ENV_FILE = process.env.SMOKE_ENV_FILE || join(ROOT, ".env");
// Reserved TLD, can never receive mail. SOURCE: https://www.rfc-editor.org/rfc/rfc2606
const UNKNOWN_ADDRESS = "smoke-unlisted@example.invalid";
// Link types expected for a sign-in mail. An existing user whose address is not yet
// confirmed gets "signup". SOURCE: https://supabase.com/docs/guides/auth/auth-email-templates
// and supabase/auth internal/api/verify.go
const LINK_TYPES = ["magiclink", "email", "signup"];
// The live app (V2-06: Cloudflare Pages custom domain). Without a redirect in the request, the link falls back to the project's Site URL.
// SOURCE: docs/decisions.md 2026-11-07 (origin minifighunt.com)
const SITE_URL = "https://minifighunt.com/";

function readEnv(file) {
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

let failures = 0;

function report(name, passed, detail) {
  if (!passed) failures++;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}  (${detail})`);
}

// Only the status and error code are returned to callers, never the body.
async function call(base, key, path, { method = "POST", body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // Not JSON: the status alone decides.
  }
  return { status: response.status, json };
}

const codeOf = (r) => (r.json && (r.json.error_code || r.json.code)) || "no code";

// A deliberate refusal is 4xx. A 429 proves nothing, and a 5xx means the request
// reached the database trigger, so the signup flag is not doing its job.
function reportRefused(name, r) {
  report(name, r.status >= 400 && r.status < 500 && r.status !== 429, `HTTP ${r.status}, ${codeOf(r)}`);
}

// Refused, or allowed with no rows. A 404, 429 or 5xx proves nothing about access.
function reportNoRows(name, r) {
  const empty = r.status === 200 && Array.isArray(r.json) && r.json.length === 0;
  report(name, empty || r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}

// A refusal from the block_email_change trigger reaches the client as this exact 500:
// see supabase/migrations/20261102000000_v2_01_schema.sql. Any other 5xx is an outage.
function reportEmailChangeRefused(r) {
  const fromTrigger = r.status === 500 && codeOf(r) === "unexpected_failure";
  const clientError = r.status >= 400 && r.status < 500 && r.status !== 429;
  report("email change refused", fromTrigger || clientError, `HTTP ${r.status}, ${codeOf(r)}`);
}

async function checksWithoutMail(base, key) {
  const settings = await call(base, key, "/auth/v1/settings", { method: "GET" });
  if (settings.status !== 200 || !settings.json) {
    report("read auth settings", false, `HTTP ${settings.status}`);
  } else {
    const s = settings.json;
    const external = s.external || {};
    report("signups off", s.disable_signup === true, `disable_signup=${s.disable_signup}`);
    report("email provider on", external.email === true, `email=${external.email}`);
    report("anonymous off", external.anonymous_users === false, `anonymous_users=${external.anonymous_users}`);
    report("phone off", external.phone === false, `phone=${external.phone}`);
    const oauth = Object.entries(external)
      .filter(([name, on]) => on === true && name !== "email")
      .map(([name]) => name);
    report("no other providers on", oauth.length === 0, oauth.join(",") || "none");
  }
  reportRefused(
    "unlisted address OTP refused",
    await call(base, key, "/auth/v1/otp", { body: { email: UNKNOWN_ADDRESS, create_user: false } })
  );
  reportRefused(
    "password signup refused",
    await call(base, key, "/auth/v1/signup", {
      body: { email: UNKNOWN_ADDRESS, password: `Smoke-${crypto.randomUUID()}` },
    })
  );
  reportRefused("anonymous sign-in refused", await call(base, key, "/auth/v1/signup", { body: {} }));
  reportNoRows("anon cannot read allowlist", await call(base, key, "/rest/v1/allowlist?select=email", { method: "GET" }));
}

// The link's "token" parameter holds the token hash, not the 6-digit code.
// SOURCE: https://supabase.com/docs/guides/auth/auth-email-templates
// Returns null on a bad link. Callers must not echo the link: it signs in.
function parseLink(link) {
  let params;
  try {
    params = new URL(link).searchParams;
  } catch {
    return null;
  }
  const tokenHash = params.get("token");
  const type = params.get("type");
  return tokenHash && LINK_TYPES.includes(type) ? { tokenHash, type, redirectTo: params.get("redirect_to") } : null;
}

async function checksSignedIn(base, key, token, otherEmail) {
  const change = await call(base, key, "/auth/v1/user", { method: "PUT", token, body: { email: otherEmail } });
  reportEmailChangeRefused(change);
  reportNoRows("user cannot read admins", await call(base, key, "/rest/v1/admins?select=user_id", { method: "GET", token }));
  const profiles = await call(base, key, "/rest/v1/profiles?select=user_id", { method: "GET", token });
  const own = Array.isArray(profiles.json) ? profiles.json.length : -1;
  report("user reads own profile only", own === 1, `HTTP ${profiles.status}, rows ${own}`);
}

async function main() {
  const [mode, email, code, otherEmail] = process.argv.slice(2);
  const env = readEnv(ENV_FILE);
  const base = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_ANON_KEY;
  if (!base || !key) {
    console.error("SUPABASE_URL or SUPABASE_ANON_KEY is missing from .env");
    process.exit(2);
  }

  if (!mode) {
    await checksWithoutMail(base, key);
  } else if (mode === "send" && email) {
    const r = await call(base, key, "/auth/v1/otp", { body: { email, create_user: false } });
    report("listed address gets a code", r.status === 200, `HTTP ${r.status}, ${codeOf(r)}`);
  } else if (mode === "verify" && email && code && otherEmail) {
    const r = await call(base, key, "/auth/v1/verify", { body: { type: "email", email, token: code } });
    const token = r.json && r.json.access_token;
    report("code signs in", r.status === 200 && Boolean(token), `HTTP ${r.status}, ${codeOf(r)}`);
    if (token) await checksSignedIn(base, key, token, otherEmail);
  } else if (mode === "verify-link" && process.argv[3] && process.argv[4]) {
    const [link, linkOtherEmail] = process.argv.slice(3);
    const parsed = parseLink(link);
    if (!parsed) {
      console.error(`Link has no token, or its type is not one of: ${LINK_TYPES.join(", ")}`);
      process.exitCode = 2;
      return;
    }
    report("link returns to the live site", parsed.redirectTo === SITE_URL, `redirect_to=${parsed.redirectTo}`);
    // token_hash goes with type only: the server refuses email or redirect_to beside it.
    // SOURCE: supabase/auth internal/api/verify.go
    const r = await call(base, key, "/auth/v1/verify", { body: { type: parsed.type, token_hash: parsed.tokenHash } });
    const token = r.json && r.json.access_token;
    report("link signs in", r.status === 200 && Boolean(token), `type ${parsed.type}, HTTP ${r.status}, ${codeOf(r)}`);
    if (token) await checksSignedIn(base, key, token, linkOtherEmail);
  } else {
    console.error("Usage: smoke_auth.mjs | send <email> | verify <email> <code> <other-email> | verify-link '<link>' <other-email>");
    process.exit(2);
  }

  console.log(failures === 0 ? "ALL PASSED" : `FAILED: ${failures}`);
  // exitCode, not exit(): exit() right after fetch aborts Node on Windows (UV_HANDLE_CLOSING).
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  // error.message only: fetch errors name the host, never the key.
  console.error(`Could not run: ${error.message}`);
  process.exitCode = 2;
});
