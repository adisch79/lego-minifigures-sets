// CI guard for the shared origin adisch79.github.io (decisions.md 2026-11-06).
// Fails when any repo of the owner other than the allowed one has GitHub Pages,
// or a repo named adisch79.github.io exists.
// Usage: gh api --paginate --slurp users/adisch79/repos | node scripts/check_pages_origin.mjs
import { fileURLToPath } from "node:url";

export const OWNER = "adisch79";
export const ALLOWED = "lego-minifigures-sets";
export const USER_SITE = "adisch79.github.io";

// Accepts a repo array or an array of pages (from --slurp); returns violation strings.
export function findViolations(input) {
  const repos = (Array.isArray(input) ? input : []).flat();
  const out = [];
  for (const r of repos) {
    if (!r || typeof r.name !== "string") continue;
    if (r.name.toLowerCase() === USER_SITE) out.push(`${r.name}: user-site repo exists`);
    else if (r.has_pages === true && r.name !== ALLOWED) out.push(`${r.name}: GitHub Pages enabled`);
  }
  return out;
}

async function main() {
  let raw = "";
  for await (const c of process.stdin) raw += c;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("check_pages_origin: input is not valid JSON");
    process.exit(2);
  }
  if (!Array.isArray(data) || data.length === 0) {
    console.error("check_pages_origin: empty repo list, refusing to pass");
    process.exit(2);
  }
  const v = findViolations(data);
  if (v.length) {
    console.error("Shared origin violated:\n" + v.join("\n"));
    process.exit(1);
  }
  console.log(`OK: ${data.flat().length} repos checked, only ${ALLOWED} may publish Pages`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
