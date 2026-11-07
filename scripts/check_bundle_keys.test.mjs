// Run: node --test scripts/check_bundle_keys.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { findSecrets } from "./check_bundle_keys.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check_bundle_keys.mjs");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role) => `${b64({ alg: "HS256" })}.${b64({ role })}.sig`;

test("service_role JWT is found", () => {
  assert.deepEqual(findSecrets(`x="${jwt("service_role")}";`), ["service_role JWT"]);
});
test("anon JWT passes", () => {
  assert.deepEqual(findSecrets(`x="${jwt("anon")}";`), []);
});
test("sb_secret_ key is found", () => {
  assert.deepEqual(findSecrets("k=sb_secret_" + "a".repeat(20)), ["sb_secret_ key"]);
});
test("plain text passes", () => {
  assert.deepEqual(findSecrets("hello eyJ not a token"), []);
});
test("CLI exits 1 on a bad file, 0 on a clean dir", () => {
  const bad = mkdtempSync(join(tmpdir(), "bk-"));
  writeFileSync(join(bad, "a.js"), jwt("service_role"));
  assert.equal(spawnSync(process.execPath, [SCRIPT, bad]).status, 1);
  const ok = mkdtempSync(join(tmpdir(), "bk-"));
  writeFileSync(join(ok, "a.js"), jwt("anon"));
  assert.equal(spawnSync(process.execPath, [SCRIPT, ok]).status, 0);
});
