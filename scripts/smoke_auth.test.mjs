// Tests for smoke_auth.mjs against an in-process mock of Supabase Auth. No network, no real keys.
// Run: node --test scripts/smoke_auth.test.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "smoke_auth.mjs");
const FAKE_KEY = "FAKE-ANON-VALUE";
const FAKE_TOKEN = "FAKE-TOKEN-VALUE";
const FAKE_HASH = "FAKE-HASH-VALUE";
// Same shape as the emailed link. The host is reserved: opening it would fail the run.
// SOURCE: https://supabase.com/docs/guides/auth/auth-email-templates
const linkOf = (type, hash = FAKE_HASH, redirect = "https://adisch79.github.io/lego-minifigures-sets/") =>
  `https://project-ref.invalid/auth/v1/verify?token=${hash}&type=${type}&redirect_to=${redirect}`;

// locked = true behaves like a correctly configured project; false like one with signups on.
// "throttled" answers mail and signup calls with 429; "outage" answers user and data calls with 503.
function handler(locked) {
  return (req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const send = (status, body) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };
      const url = req.url;
      if (locked === "throttled" && ["/auth/v1/otp", "/auth/v1/signup", "/auth/v1/user"].includes(url)) {
        return send(429, { error_code: "over_email_send_rate_limit" });
      }
      if (locked === "outage" && (url === "/auth/v1/user" || url.startsWith("/rest/v1/"))) return send(503, {});
      if (url === "/auth/v1/settings") {
        return send(200, {
          disable_signup: Boolean(locked),
          external: { email: true, anonymous_users: !locked, phone: false, google: !locked },
        });
      }
      if (url === "/auth/v1/verify") {
        const body = JSON.parse(raw);
        if (body.token_hash) {
          // Real rule: token_hash goes with type only. SOURCE: supabase/auth internal/api/verify.go
          const exact = body.token_hash === FAKE_HASH && !body.token && !body.email && !body.redirect_to;
          return exact ? send(200, { access_token: FAKE_TOKEN }) : send(400, { error_code: "validation_failed" });
        }
        return send(200, { access_token: FAKE_TOKEN });
      }
      if (url === "/auth/v1/otp") {
        const unlisted = JSON.parse(raw).email.endsWith(".invalid");
        return unlisted && locked ? send(422, { error_code: "otp_disabled" }) : send(200, {});
      }
      if (url === "/auth/v1/signup") {
        return locked ? send(422, { error_code: "signup_disabled" }) : send(500, { error_code: "unexpected_failure" });
      }
      if (url === "/auth/v1/user") return locked ? send(500, { error_code: "unexpected_failure" }) : send(200, {});
      if (url.startsWith("/rest/v1/allowlist")) return locked ? send(401, { code: "42501" }) : send(200, [{ email: "x" }]);
      if (url.startsWith("/rest/v1/admins")) return locked ? send(403, { code: "42501" }) : send(200, [{ user_id: "x" }]);
      if (url.startsWith("/rest/v1/profiles")) return send(200, [{ user_id: "x" }]);
      return send(404, {});
    });
  };
}

async function runScript(locked, args, envText) {
  const server = createServer(handler(locked));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const envFile = join(tmpdir(), `smoke-auth-test-${process.pid}-${port}.env`);
  const text = envText ?? `SUPABASE_URL=http://127.0.0.1:${port}/\r\nSUPABASE_ANON_KEY="${FAKE_KEY}"\r\n`;
  writeFileSync(envFile, text);
  try {
    return await new Promise((resolve) => {
      const child = spawn(process.execPath, [SCRIPT, ...args], {
        env: { ...process.env, SMOKE_ENV_FILE: envFile },
      });
      let output = "";
      child.stdout.on("data", (d) => (output += d));
      child.stderr.on("data", (d) => (output += d));
      child.on("close", (code) => resolve({ code, output }));
    });
  } finally {
    unlinkSync(envFile);
    server.close();
  }
}

test("locked project passes every check without mail", async () => {
  const { code, output } = await runScript(true, []);
  assert.equal(code, 0, output);
  assert.match(output, /ALL PASSED/);
  assert.doesNotMatch(output, /FAIL/);
});

test("open project fails the settings and refusal checks", async () => {
  const { code, output } = await runScript(false, []);
  assert.equal(code, 1, output);
  for (const name of [
    "signups off",
    "anonymous off",
    "no other providers on",
    "unlisted address OTP refused",
    "password signup refused",
    "anon cannot read allowlist",
  ]) {
    assert.match(output, new RegExp(`FAIL  ${name}`));
  }
});

test("verify mode passes on a locked project", async () => {
  const { code, output } = await runScript(true, ["verify", "a@example.com", "123456", "b@example.com"]);
  assert.equal(code, 0, output);
  assert.match(output, /PASS {2}code signs in/);
  assert.match(output, /PASS {2}email change refused/);
});

test("verify mode fails when an email change is accepted", async () => {
  const { code, output } = await runScript(false, ["verify", "a@example.com", "123456", "b@example.com"]);
  assert.equal(code, 1, output);
  assert.match(output, /FAIL {2}email change refused/);
  assert.match(output, /FAIL {2}user cannot read admins/);
});

test("verify-link mode signs in with only the hash and type, and never opens the link", async () => {
  for (const type of ["magiclink", "email", "signup"]) {
    const { code, output } = await runScript(true, ["verify-link", linkOf(type), "b@example.com"]);
    assert.equal(code, 0, output);
    assert.match(output, /PASS {2}link signs in/);
    assert.match(output, /PASS {2}email change refused/);
    assert.match(output, /PASS {2}user cannot read admins/);
    assert.match(output, /PASS {2}user reads own profile only/);
  }
});

test("verify-link mode fails when the link returns to the default Site URL", async () => {
  const link = linkOf("magiclink", FAKE_HASH, "http://localhost:3000");
  const { code, output } = await runScript(true, ["verify-link", link, "b@example.com"]);
  assert.equal(code, 1, output);
  assert.match(output, /FAIL {2}link returns to the live site/);
  assert.match(output, /PASS {2}link signs in/);
});

test("verify-link mode fails when the server refuses the hash", async () => {
  const { code, output } = await runScript(true, ["verify-link", linkOf("magiclink", "WRONG"), "b@example.com"]);
  assert.equal(code, 1, output);
  assert.match(output, /FAIL {2}link signs in/);
  assert.doesNotMatch(output, /email change refused/);
});

test("verify-link mode fails when an email change is accepted", async () => {
  const { code, output } = await runScript(false, ["verify-link", linkOf("magiclink"), "b@example.com"]);
  assert.equal(code, 1, output);
  assert.match(output, /FAIL {2}email change refused/);
});

test("verify-link mode exits 2 on a bad link, without echoing it", async () => {
  const bad = [
    "not-a-url-SECRET",
    "https://x.invalid/auth/v1/verify?type=magiclink&note=SECRET",
    "https://x.invalid/auth/v1/verify?token=SECRET",
    "https://x.invalid/auth/v1/verify?token=SECRET&type=recovery",
  ];
  for (const link of bad) {
    const { code, output } = await runScript(true, ["verify-link", link, "b@example.com"]);
    assert.equal(code, 2, output);
    assert.ok(!output.includes("SECRET"));
  }
  assert.equal((await runScript(true, ["verify-link", linkOf("magiclink")])).code, 2);
});

test("a 429 never passes as a refusal", async () => {
  const noMail = await runScript("throttled", []);
  assert.equal(noMail.code, 1, noMail.output);
  for (const name of ["unlisted address OTP refused", "password signup refused", "anonymous sign-in refused"]) {
    assert.match(noMail.output, new RegExp(`FAIL  ${name}`));
  }
  const link = await runScript("throttled", ["verify-link", linkOf("magiclink"), "b@example.com"]);
  assert.equal(link.code, 1, link.output);
  assert.match(link.output, /FAIL {2}email change refused/);
});

test("an outage never passes as a refusal or as no access", async () => {
  const noMail = await runScript("outage", []);
  assert.equal(noMail.code, 1, noMail.output);
  assert.match(noMail.output, /FAIL {2}anon cannot read allowlist/);
  const link = await runScript("outage", ["verify-link", linkOf("magiclink"), "b@example.com"]);
  assert.equal(link.code, 1, link.output);
  assert.match(link.output, /FAIL {2}email change refused/);
  assert.match(link.output, /FAIL {2}user cannot read admins/);
});

test("send mode reports a sent code", async () => {
  const { code, output } = await runScript(true, ["send", "a@example.com"]);
  assert.equal(code, 0, output);
  assert.match(output, /PASS {2}listed address gets a code/);
});

test("missing keys and bad arguments exit 2", async () => {
  assert.equal((await runScript(true, [], "OTHER=1\n")).code, 2);
  assert.equal((await runScript(true, ["send"])).code, 2);
});

test("output never contains the key, the token or the code", async () => {
  const runs = await Promise.all([
    runScript(true, []),
    runScript(false, []),
    runScript(true, ["verify", "a@example.com", "123456", "b@example.com"]),
    runScript(true, ["verify-link", linkOf("magiclink"), "b@example.com"]),
  ]);
  for (const { output } of runs) {
    assert.ok(!output.includes(FAKE_KEY));
    assert.ok(!output.includes(FAKE_TOKEN));
    assert.ok(!output.includes("123456"));
    assert.ok(!output.includes(FAKE_HASH));
  }
});
