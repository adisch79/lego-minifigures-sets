// Edge Function: public contact form (V2-15). Anonymous callers (verify_jwt = false in config.toml);
// Turnstile plus the database rate limits are the gate. Body: {name?, email, message, token}.
// Secrets (set with `supabase secrets set`): TURNSTILE_SECRET_KEY, CONTACT_IP_SALT.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// SOURCE: https://supabase.com/docs/guides/functions/secrets
// SOURCE: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  isAllowedOrigin, MAX_BODY_BYTES, handleRequest, clientIp, SITEVERIFY_URL, SITEVERIFY_TIMEOUT_MS,
} from './logic.ts';
import type { Deps } from './logic.ts';

// Reads at most `max` bytes of the body, then cancels the stream.
async function readCapped(req: Request, max: number): Promise<string> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  return new TextDecoder().decode(all.subarray(0, max));
}

const hex = (buf: ArrayBuffer): string => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req: Request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const ipSalt = Deno.env.get('CONTACT_IP_SALT');
  const configured = !!(url && serviceKey && turnstileSecret && ipSalt);

  const deps: Deps = {
    configured: () => configured,
    verifyCaptcha: async (token, remoteip) => {
      const form = new URLSearchParams({ secret: turnstileSecret ?? '', response: token });
      if (remoteip) form.set('remoteip', remoteip);
      const res = await fetch(SITEVERIFY_URL, {
        method: 'POST', body: form, signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error('siteverify status');
      return await res.json();
    },
    hashIp: async (ip) => {
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(ipSalt ?? ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      );
      return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip)));
    },
    submit: async (name, email, message, ipHash) => {
      const db = createClient(url ?? '', serviceKey ?? '', { auth: { persistSession: false } });
      const { data, error } = await db.rpc('contact_submit', {
        p_name: name, p_email: email, p_message: message, p_ip_hash: ipHash,
      });
      if (error) throw new Error('rpc failed');
      return String(data);
    },
    log: (message) => console.error(message),
  };

  const declared = req.headers.get('content-length');
  const contentLength = declared !== null && /^\d+$/.test(declared) ? Number(declared) : null;
  let bodyText = '';
  if (req.method === 'POST' && isAllowedOrigin(req.headers.get('origin')) && !(contentLength !== null && contentLength > MAX_BODY_BYTES)) {
    try {
      bodyText = await readCapped(req, MAX_BODY_BYTES + 1);
    } catch {
      bodyText = '';
    }
  }
  const res = await handleRequest({
    method: req.method,
    origin: req.headers.get('origin'),
    contentType: req.headers.get('content-type'),
    contentLength,
    bodyText,
    ip: clientIp(req.headers),
  }, deps);
  return new Response(res.body === null ? null : JSON.stringify(res.body), { status: res.status, headers: res.headers });
});
