// Run: node --test scripts/check_pages_origin.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { findViolations } from "./check_pages_origin.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check_pages_origin.mjs");
const run = (obj) => spawnSync(process.execPath, [SCRIPT], { input: JSON.stringify(obj), encoding: "utf8" });

test("allowed repo with pages passes", () => {
  assert.deepEqual(findViolations([{ name: "lego-minifigures-sets", has_pages: true }, { name: "x", has_pages: false }]), []);
});
test("other repo with pages fails", () => {
  assert.equal(findViolations([{ name: "other", has_pages: true }]).length, 1);
});
test("user-site repo fails even without pages", () => {
  assert.equal(findViolations([{ name: "adisch79.github.io", has_pages: false }]).length, 1);
});
test("slurped pages are flattened", () => {
  assert.equal(findViolations([[{ name: "a", has_pages: false }], [{ name: "b", has_pages: true }]]).length, 1);
});
test("cli exit codes", () => {
  assert.equal(run([{ name: "a", has_pages: false }]).status, 0);
  assert.equal(run([{ name: "a", has_pages: true }]).status, 1);
  assert.equal(run([]).status, 2);
});
