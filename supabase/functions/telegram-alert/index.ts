// Edge Function: send one Telegram message for a new "wanted" mark (V2-04).
// Caller: the database trigger via pg_net, with header x-alert-secret. Body: alert key only.
// Secrets (Supabase function secrets, never in code or logs):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ALERT_HOOK_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// SOURCE: https://supabase.com/docs/guides/functions/secrets
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildMessage, parseAlertKey, secretsMatch } from './logic.ts';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });

  // Shared secret first: an unauthenticated caller learns nothing about configuration.
  // A missing secret answers 401 like a wrong one; the detail is logged server-side only.
  const hookSecret = Deno.env.get('ALERT_HOOK_SECRET');
  if (!hookSecret) {
    console.error('telegram-alert: config missing');
    return json(401, { error: 'unauthorized' });
  }
  if (!(await secretsMatch(req.headers.get('x-alert-secret'), hookSecret))) {
    return json(401, { error: 'unauthorized' });
  }

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  const supaUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !chatId || !supaUrl || !serviceKey) {
    console.error('telegram-alert: missing configuration');
    return json(500, { error: 'config' });
  }

  let key;
  try {
    key = parseAlertKey(await req.json());
  } catch {
    key = null;
  }
  if (!key) return json(400, { error: 'bad body' });

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Claim first: only one caller can flip sent_at from null, so no double send.
  // If anything then fails, the claim is released so a re-mark can retry.
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: cErr } = await db
    .from('wanted_alerts').update({ sent_at: claimedAt })
    .eq('user_id', key.user_id).eq('kind', key.kind).eq('target_id', key.target_id)
    .is('sent_at', null)
    .select('user_id');
  if (cErr) { console.error('telegram-alert: claim failed'); return json(500, { error: 'db' }); }
  if (!claimed || claimed.length === 0) return json(200, { status: 'already sent or no alert' });

  // Releases only our own claim: the sent_at must still equal the value we wrote.
  const release = async () => {
    try {
      const { error } = await db
        .from('wanted_alerts').update({ sent_at: null })
        .eq('user_id', key.user_id).eq('kind', key.kind).eq('target_id', key.target_id)
        .eq('sent_at', claimedAt);
      if (error) console.error('telegram-alert: could not clear claim');
      return error ?? null;
    } catch {
      console.error('telegram-alert: could not clear claim');
      return true;
    }
  };

  let sent = false;
  let status = 500;
  try {
    const { data: profile } = await db
      .from('profiles').select('display_name').eq('user_id', key.user_id).maybeSingle();

    // No parse_mode: plain text. The token is part of the URL, so errors never log the URL.
    let res: Response | null = null;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: buildMessage(profile?.display_name, key),
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      console.error('telegram-alert: telegram request failed');
    }
    if (res && res.ok) {
      sent = true;
    } else {
      if (res) console.error(`telegram-alert: telegram answered ${res.status}`);
      status = 502;
    }
  } catch {
    console.error('telegram-alert: unexpected failure');
  } finally {
    if (!sent) {
      const relErr = await release();
      if (relErr) status = 500;
    }
  }
  if (sent) return json(200, { status: 'sent' });
  return status === 502 ? json(502, { error: 'telegram' }) : json(500, { error: 'db' });
});
