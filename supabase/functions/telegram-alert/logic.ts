// Pure helpers for the telegram-alert Edge Function. No Deno or network APIs here,
// so node --test can import this file. Erasable TypeScript syntax only.

export const SITE_URL = 'https://minifighunt.com/';

// Same shapes as the CHECK constraint on public.marks (V2-01 migration).
const SERIES_RE = /^[0-9]{4,6}$/;
const FIGURE_RE = /^[0-9]{4,6}-[0-9]{1,4}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AlertKey = { user_id: string; kind: 'figure' | 'series'; target_id: string };

export function isValidTarget(kind: unknown, targetId: unknown): boolean {
  if (typeof targetId !== 'string') return false;
  if (kind === 'series') return SERIES_RE.test(targetId);
  if (kind === 'figure') return FIGURE_RE.test(targetId);
  return false;
}

// Body must be exactly the alert key: three known fields, valid shapes. Returns null if not.
export function parseAlertKey(body: unknown): AlertKey | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const keys = Object.keys(b).sort().join(',');
  if (keys !== 'kind,target_id,user_id') return null;
  if (typeof b.user_id !== 'string' || !UUID_RE.test(b.user_id)) return null;
  if (!isValidTarget(b.kind, b.target_id)) return null;
  return { user_id: b.user_id, kind: b.kind as 'figure' | 'series', target_id: b.target_id as string };
}

// Figure ids map to the parent series page.
export function seriesIdOf(targetId: string): string {
  return targetId.split('-')[0];
}

export function linkFor(targetId: string): string {
  return `${SITE_URL}#series/${seriesIdOf(targetId)}`;
}

// Name by display_name, else a short id. Never the email.
export function whoLabel(displayName: string | null | undefined, userId: string): string {
  // Bidi and zero-width chars are removed (they can spoof the text); control chars become spaces.
  const clean = (displayName ?? '')
    .replace(/[\u061c\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .trim();
  const clipped = Array.from(clean).slice(0, 50).join('');
  return clipped !== '' ? clipped : `user ${userId.slice(0, 8)}`;
}

// Plain text only: the sender sets no parse_mode.
export function buildMessage(displayName: string | null | undefined, key: AlertKey): string {
  const what = key.kind === 'series' ? `series ${key.target_id}` : `figure ${key.target_id}`;
  return `${whoLabel(displayName, key.user_id)} wants ${what}\n${linkFor(key.target_id)}`;
}

// Constant-time compare: hash both sides to equal length, then fold all bytes.
export async function secretsMatch(given: string | null | undefined, expected: string): Promise<boolean> {
  if (!expected || typeof given !== 'string') return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
