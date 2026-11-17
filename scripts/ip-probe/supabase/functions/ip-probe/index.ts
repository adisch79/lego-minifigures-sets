// Throwaway V2-15 probe: which client IP headers survive the Supabase gateway.
// Returns header NAMES and booleans only, never header values. Deleted after use.
const SPOOF = "203.0.113.77"; // RFC 5737 TEST-NET-3 address, sent by the caller as a fake client IP
const CANDIDATES = [
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-real-ip",
  "true-client-ip",
  "x-client-ip",
  "forwarded",
  "cf-connecting-ipv6",
  "x-envoy-external-address",
];

Deno.serve((req) => {
  const names = [...req.headers.keys()].sort();
  const report: Record<string, unknown> = {};
  for (const h of CANDIDATES) {
    const v = req.headers.get(h);
    if (v === null) {
      report[h] = { present: false };
      continue;
    }
    const parts = v.split(",").map((s) => s.trim());
    report[h] = {
      present: true,
      equalsSpoof: v.trim() === SPOOF,
      containsSpoof: v.includes(SPOOF),
      entries: parts.length,
      spoofIndex: parts.indexOf(SPOOF),
      lastIsSpoof: parts[parts.length - 1] === SPOOF,
    };
  }
  return new Response(JSON.stringify({ names, report }, null, 1), {
    headers: { "content-type": "application/json" },
  });
});
