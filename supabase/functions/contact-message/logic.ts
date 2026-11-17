// Pure request logic for the contact-message Edge Function (V2-15). No Deno or network APIs
// here: every side effect comes in through Deps, so node --test can drive it.
// Erasable TypeScript syntax only. Design: docs/design/V2-15-about-contact.md.

// SOURCE: docs/decisions.md 2026-11-07 (minifighunt.com, Cloudflare Pages, single origin); same as admin-people.
export const ALLOWED_ORIGIN = 'https://minifighunt.com';
export const ALLOWED_ORIGINS: readonly string[] = [ALLOWED_ORIGIN];
export const isAllowedOrigin = (origin: string | null): origin is string => origin !== null && ALLOWED_ORIGINS.includes(origin);
// SOURCE: docs/design/V2-05-admin.md, "Writes": allowed request headers (same as admin-people).
export const ALLOWED_HEADERS = 'authorization, apikey, content-type, x-client-info';
// SOURCE: docs/design/V2-15-about-contact.md, "Edge Function": body read capped at 16 KB.
export const MAX_BODY_BYTES = 16384;
// SOURCE: RFC 5321 section 4.5.3.1.3 (path limit 256 octets, so address 254); design: max 254 chars.
export const MAX_EMAIL_CHARS = 254;
// SOURCE: docs/design/V2-15-about-contact.md, "Contact form": name max 80, message 1 to 2000 code points.
export const MAX_NAME_CHARS = 80;
export const MAX_MESSAGE_CHARS = 2000;
// SOURCE: docs/design/V2-15-about-contact.md, "Turnstile": hostname must be minifighunt.com, action "contact".
export const TURNSTILE_HOSTNAMES: readonly string[] = ['minifighunt.com'];
export const TURNSTILE_ACTION = 'contact';
// SOURCE: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// SOURCE: DEFAULT (no owner source), logged in docs/decisions.md: siteverify call gives up after 5 s and fails closed.
export const SITEVERIFY_TIMEOUT_MS = 5000;
// PENDING PROBE: header choice not verified yet
// SOURCE: UNKNOWN until the gateway probe of V2-15 PR 2 (docs/design/V2-15-about-contact.md, "ip_hash").
export const IP_HEADER = 'cf-connecting-ip';
// Bucket for requests with no usable IP header (design: one shared bucket under the same limit).
export const UNKNOWN_IP = 'unknown';
// SOURCE: DEFAULT: longest IPv6 text form is 45 chars; anything longer is not an address.
const MAX_IP_CHARS = 64;

export type ErrorCode = 'invalid' | 'captcha' | 'rate_limited' | 'internal';

export type CaptchaResult = { success?: boolean; hostname?: string; action?: string } | null;
export type ClientIp = { value: string; trusted: boolean };

export type Deps = {
  configured: () => boolean; // TURNSTILE_SECRET_KEY and CONTACT_IP_SALT both set
  verifyCaptcha: (token: string, remoteip: string | null) => Promise<CaptchaResult>; // throws on network error or timeout
  hashIp: (ip: string) => Promise<string>; // HMAC-SHA-256 with CONTACT_IP_SALT
  submit: (name: string, email: string, message: string, ipHash: string) => Promise<string>; // rpc contact_submit
  log: (message: string) => void; // fixed strings only, never body, email, IP or token
};

export type Req = {
  method: string;
  origin: string | null;
  contentType?: string | null;
  contentLength?: number | null; // declared Content-Length, when present
  bodyText: string;
  ip: ClientIp;
};

export type Res = { status: number; headers: Record<string, string>; body: unknown };

// The ONLY place that picks the client IP. Missing, blank or oversized header: shared "unknown" bucket,
// not trusted (so no remoteip goes to siteverify).
export function clientIp(headers: { get(name: string): string | null }): ClientIp {
  const raw = headers.get(IP_HEADER);
  const v = raw === null ? '' : raw.trim();
  if (v === '' || v.length > MAX_IP_CHARS) return { value: UNKNOWN_IP, trusted: false };
  return { value: v, trusted: true };
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': ALLOWED_HEADERS,
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin',
  };
}

const reply = (origin: string, status: number, body: unknown): Res => ({
  status,
  headers: { ...corsHeaders(origin), 'content-type': 'application/json' },
  body,
});
const fail = (origin: string, status: number, code: ErrorCode): Res => reply(origin, status, { error: code });

// Same rules as admin-people normalizeEmail.
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length === 0 || e.length > MAX_EMAIL_CHARS) return null;
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(e)) return null;
  if (/[^!-~]/.test(e)) return null;
  const parts = e.split('@');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return null;
  return e;
}

const codePoints = (s: string): number => Array.from(s).length;

// Optional. Trimmed, max 80 code points, no control characters. '' when absent. null when invalid.
export function cleanName(raw: unknown): string | null {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') return null;
  const n = raw.trim();
  if (codePoints(n) > MAX_NAME_CHARS) return null;
  if (/[\u0000-\u001f\u007f-\u009f]/.test(n)) return null;
  return n;
}

// Required. 1..2000 code points after trim; control characters other than newline and tab rejected.
export function cleanMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim();
  if (m.length === 0 || codePoints(m) > MAX_MESSAGE_CHARS) return null;
  if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/.test(m)) return null;
  return m;
}

const isJson = (ct: string | null | undefined): boolean => !!ct && /^application\/json\s*(;|$)/i.test(ct.trim());

export async function handleRequest(req: Req, deps: Deps): Promise<Res> {
  if (!isAllowedOrigin(req.origin)) return { status: 403, headers: { vary: 'Origin' }, body: { error: 'origin' } };
  const o: string = req.origin;
  if (req.method === 'OPTIONS') return { status: 204, headers: corsHeaders(o), body: null };
  if (req.method !== 'POST') return fail(o, 405, 'invalid');
  if (!deps.configured()) {
    deps.log('contact-message: missing configuration');
    return fail(o, 500, 'internal');
  }
  if (typeof req.contentLength === 'number' && req.contentLength > MAX_BODY_BYTES) return fail(o, 413, 'invalid');
  if (!isJson(req.contentType)) return fail(o, 400, 'invalid');
  if (new TextEncoder().encode(req.bodyText).length > MAX_BODY_BYTES) return fail(o, 400, 'invalid');

  let body: unknown;
  try {
    body = JSON.parse(req.bodyText);
  } catch {
    return fail(o, 400, 'invalid');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(o, 400, 'invalid');
  const b = body as Record<string, unknown>;
  const name = cleanName(b.name);
  const email = normalizeEmail(b.email);
  const message = cleanMessage(b.message);
  const token = typeof b.token === 'string' ? b.token : '';
  if (name === null || email === null || message === null || token === '') return fail(o, 400, 'invalid');

  // Captcha: any failure, mismatch or network error is a closed door.
  let cap: CaptchaResult = null;
  try {
    cap = await deps.verifyCaptcha(token, req.ip.trusted ? req.ip.value : null);
  } catch {
    deps.log('contact-message: captcha check failed');
    return fail(o, 403, 'captcha');
  }
  if (!cap || cap.success !== true || cap.action !== TURNSTILE_ACTION
    || typeof cap.hostname !== 'string' || !TURNSTILE_HOSTNAMES.includes(cap.hostname)) {
    return fail(o, 403, 'captcha');
  }

  try {
    const result = await deps.submit(name, email, message, await deps.hashIp(req.ip.value));
    if (result === 'ok') return reply(o, 200, { ok: true });
    if (result === 'rate_limited') return fail(o, 429, 'rate_limited');
    deps.log('contact-message: unexpected result');
    return fail(o, 500, 'internal');
  } catch {
    deps.log('contact-message: store failed');
    return fail(o, 500, 'internal');
  }
}
