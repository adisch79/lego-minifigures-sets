// Fail when a built bundle carries a service_role JWT or an sb_secret_ key.
// Usage: node scripts/check_bundle_keys.mjs <dist-dir>
// Run: node --test scripts/check_bundle_keys.test.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// SOURCE: RFC 7519 (JWT = base64url header.payload.signature; both JSON parts start with "eyJ" = '{"').
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./g;
const SECRET_RE = /sb_secret_[A-Za-z0-9_-]{16,}/;

export function findSecrets(text) {
  const hits = [];
  if (SECRET_RE.test(text)) hits.push("sb_secret_ key");
  for (const m of text.matchAll(JWT_RE)) {
    const payload = m[0].split(".")[1];
    try {
      const json = Buffer.from(payload, "base64url").toString("utf8");
      if (/"role"\s*:\s*"service_role"/.test(json)) hits.push("service_role JWT");
    } catch {
      // not decodable: ignore
    }
  }
  return hits;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: check_bundle_keys.mjs <dist-dir>");
    process.exit(2);
  }
  let bad = 0;
  for (const f of walk(dir)) {
    const hits = findSecrets(readFileSync(f, "latin1"));
    if (hits.length) {
      console.error(`${f}: ${hits.join(", ")}`);
      bad = 1;
    }
  }
  process.exit(bad);
}
