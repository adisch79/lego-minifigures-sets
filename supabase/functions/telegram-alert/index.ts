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

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  const hookSecret = Deno.env.get('ALERT_HOOK_SECRET');
  const supaUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !chatId || !hookSecret || !supaUrl || !serviceKey) {
    console.error('telegram-alert: missing configuration');
    return json(500, { error: 'config' });
  }

  if (!(await secretsMatch(req.headers.get('x-alert-secret'), hookSecret))) {
    return json(401, { error: 'unauthorized' });
  }

  let key;
  try {
    key = parseAlertKey(await req.json());
  } catch {
    key = null;
  }
  if (!key) return json(400, { error: 'bad body' });

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Re-read: the alert row must exist and be unsent. The body is never trusted for content.
  const { data: alert, error: aErr } = await db
    .from('wanted_alerts')
    .select('sent_at')
    .eq('user_id', key.user_id).eq('kind', key.kind).eq('target_id', key.target_id)
    .maybeSingle();
  if (aErr) { console.error('telegram-alert: alert read failed'); return json(500, { error: 'db' }); }
  if (!alert) return json(404, { error: 'no alert' });
  if (alert.sent_at) return json(200, { status: 'already sent' });

  const { data: profile } = await db
    .from('profiles').select('display_name').eq('user_id', key.user_id).maybeSingle();

  // No parse_mode: plain text. The token is part of the URL, so errors never log the URL.
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(profile?.display_name, key),
        disable_web_page_preview: true,
      }),
    });
  } catch {
    console.error('telegram-alert: telegram request failed');
    return json(502, { error: 'telegram' });
  }
  if (!res.ok) {
    console.error(`telegram-alert: telegram answered ${res.status}`);
    return json(502, { error: 'telegram' });
  }

  // Only a sent message is marked; the update is guarded so a repeat call stays a no-op.
  const { error: uErr } = await db
    .from('wanted_alerts').update({ sent_at: new Date().toISOString() })
    .eq('user_id', key.user_id).eq('kind', key.kind).eq('target_id', key.target_id)
    .is('sent_at', null);
  if (uErr) console.error('telegram-alert: could not mark sent');
  return json(200, { status: 'sent' });
});
