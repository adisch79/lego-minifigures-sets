// Unit tests for the pure logic of the contact-message function (V2-15).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleRequest, clientIp, IP_HEADER, ALLOWED_ORIGINS, MAX_BODY_BYTES, normalizeEmail, cleanName, cleanMessage,
} from './logic.ts';

const ORIGIN = 'https://minifighunt.com';

function world(over = {}) {
  const w = {
    logs: [], submits: [], captchaCalls: [],
    captcha: { success: true, hostname: 'minifighunt.com', action: 'contact' },
    captchaThrows: false, submitResult: 'ok', submitThrows: false,
    configured: true,
    ...over,
  };
  w.deps = {
    configured: () => w.configured,
    verifyCaptcha: async (token, remoteip) => {
      w.captchaCalls.push({ token, remoteip });
      if (w.captchaThrows) throw new Error('timeout');
      return w.captcha;
    },
    hashIp: async (ip) => `hash(${ip})`,
    submit: async (name, email, message, ipHash) => {
      w.submits.push({ name, email, message, ipHash });
      if (w.submitThrows) throw new Error('db');
      return w.submitResult;
    },
    log: (m) => w.logs.push(m),
  };
  return w;
}

const good = { name: 'Ann', email: 'Ann@Example.invalid', message: 'Hello there', captchaToken: 'tok' };
const KNOWN_IP = { value: '203.0.113.7', trusted: true };
const post = (w, body, over = {}) => handleRequest({
  method: 'POST', origin: ORIGIN, contentType: 'application/json',
  bodyText: typeof body === 'string' ? body : JSON.stringify(body), ip: KNOWN_IP, ...over,
}, w.deps);

test('clientIp: reads the single named header, trusted', () => {
  assert.equal(IP_HEADER, 'cf-connecting-ip');
  const h = new Headers({ [IP_HEADER]: ' 203.0.113.7 ' });
  assert.deepEqual(clientIp(h), { value: '203.0.113.7', trusted: true });
  // other headers are ignored
  assert.deepEqual(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.1' })), { value: 'unknown', trusted: false });
});

test('clientIp: missing, empty or oversized header goes to the shared unknown bucket', () => {
  assert.deepEqual(clientIp(new Headers()), { value: 'unknown', trusted: false });
  assert.deepEqual(clientIp(new Headers({ [IP_HEADER]: '   ' })), { value: 'unknown', trusted: false });
  assert.deepEqual(clientIp(new Headers({ [IP_HEADER]: 'x'.repeat(100) })), { value: 'unknown', trusted: false });
});

test('origin: other or missing origin refused 403, no CORS grant, nothing called', async () => {
  const w = world();
  for (const origin of ['https://evil.example', 'http://minifighunt.com', 'https://minifighunt.com.evil.example', null]) {
    const r = await post(w, good, { origin });
    assert.equal(r.status, 403);
    assert.equal(r.headers['access-control-allow-origin'], undefined);
  }
  assert.deepEqual(ALLOWED_ORIGINS, [ORIGIN]);
  assert.equal(w.captchaCalls.length, 0);
});

test('preflight: 204 with exact CORS headers, no auth needed', async () => {
  const w = world();
  const r = await post(w, '', { method: 'OPTIONS', contentType: null });
  assert.equal(r.status, 204);
  assert.equal(r.headers['access-control-allow-origin'], ORIGIN);
  assert.equal(r.headers['access-control-allow-headers'], 'authorization, apikey, content-type, x-client-info');
  assert.equal(r.headers['access-control-allow-methods'], 'POST, OPTIONS');
  assert.equal(r.headers.vary, 'Origin');
});

test('method: GET, PUT, DELETE refused 405 with uniform body', async () => {
  const w = world();
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const r = await post(w, good, { method });
    assert.equal(r.status, 405);
    assert.deepEqual(r.body, { error: 'invalid' });
  }
});

test('config: missing secret or salt fails closed 500 before any call', async () => {
  const w = world({ configured: false });
  const r = await post(w, good);
  assert.equal(r.status, 500);
  assert.deepEqual(r.body, { error: 'internal' });
  assert.equal(w.captchaCalls.length, 0);
  assert.equal(w.submits.length, 0);
});

test('content-type: non-JSON refused 400', async () => {
  for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', null]) {
    const r = await post(world(), good, { contentType });
    assert.equal(r.status, 400);
    assert.deepEqual(r.body, { error: 'invalid' });
  }
  const ok = await post(world(), good, { contentType: 'application/json; charset=utf-8' });
  assert.equal(ok.status, 200);
});

test('body cap: declared or actual size over 16 KB refused, constant is 16384', async () => {
  assert.equal(MAX_BODY_BYTES, 16384);
  const w = world();
  const r1 = await post(w, good, { contentLength: MAX_BODY_BYTES + 1 });
  assert.equal(r1.status, 413);
  const r2 = await post(w, 'x'.repeat(MAX_BODY_BYTES + 1));
  assert.equal(r2.status, 400);
  assert.equal(w.captchaCalls.length, 0);
});

test('body: bad JSON, array, null, non-object refused 400', async () => {
  for (const b of ['{nope', '[]', 'null', '"s"', '']) {
    const r = await post(world(), b);
    assert.equal(r.status, 400, b);
    assert.deepEqual(r.body, { error: 'invalid' });
  }
});

test('fields: email rules match admin-people normalizeEmail', () => {
  assert.equal(normalizeEmail(' A@B.C '), 'a@b.c');
  for (const e of ['', 'a', 'a@', '@b', 'a@b@c', 'a b@c', 'a\u0000@c', 'é@c.d', 5, null, 'a@' + 'b'.repeat(260)]) {
    assert.equal(normalizeEmail(e), null, String(e));
  }
});

test('fields: name optional, max 80 code points, no control characters', () => {
  assert.equal(cleanName(undefined), '');
  assert.equal(cleanName(''), '');
  assert.equal(cleanName('  Ann  '), 'Ann');
  assert.equal(cleanName('a'.repeat(80)), 'a'.repeat(80));
  assert.equal(cleanName('a'.repeat(81)), null);
  assert.equal(cleanName('\u{1F9F1}'.repeat(80)), '\u{1F9F1}'.repeat(80)); // 80 code points, 160 UTF-16 units
  assert.equal(cleanName('a\nb'), null);
  assert.equal(cleanName('a\u0000b'), null);
  assert.equal(cleanName('a\u007fb'), null);
  assert.equal(cleanName(5), null);
});

test('fields: message 1..2000 code points, only newline and tab allowed as controls', () => {
  assert.equal(cleanMessage('hi'), 'hi');
  assert.equal(cleanMessage('a\nb\tc'), 'a\nb\tc');
  assert.equal(cleanMessage(''), null);
  assert.equal(cleanMessage('   '), null);
  assert.equal(cleanMessage('a'.repeat(2000)), 'a'.repeat(2000));
  assert.equal(cleanMessage('a'.repeat(2001)), null);
  assert.equal(cleanMessage('\u{1F9F1}'.repeat(2000)), '\u{1F9F1}'.repeat(2000));
  assert.equal(cleanMessage('\u{1F9F1}'.repeat(2001)), null);
  assert.equal(cleanMessage('a\rb'), null);
  assert.equal(cleanMessage('a\u0000b'), null);
  assert.equal(cleanMessage('a\u009fb'), null);
  assert.equal(cleanMessage(7), null);
});

test('request: invalid field returns 400 before captcha is spent', async () => {
  for (const patch of [{ email: 'nope' }, { message: '' }, { name: 'a\nb' }, { captchaToken: '' }, { captchaToken: 5 }, { captchaToken: undefined }]) {
    const w = world();
    const r = await post(w, { ...good, ...patch });
    assert.equal(r.status, 400, JSON.stringify(patch));
    assert.deepEqual(r.body, { error: 'invalid' });
    assert.equal(w.captchaCalls.length, 0);
    assert.equal(w.submits.length, 0);
  }
});

test('captcha: failure, hostname mismatch, action mismatch all 403 captcha', async () => {
  for (const captcha of [
    { success: false, hostname: 'minifighunt.com', action: 'contact' },
    { success: true, hostname: 'evil.example', action: 'contact' },
    { success: true, hostname: 'minifighunt.com', action: 'signin' },
    { success: true, hostname: 'minifighunt.com' },
    { success: true, action: 'contact' },
    null,
  ]) {
    const w = world({ captcha });
    const r = await post(w, good);
    assert.equal(r.status, 403, JSON.stringify(captcha));
    assert.deepEqual(r.body, { error: 'captcha' });
    assert.equal(w.submits.length, 0);
  }
});

test('captcha: network error or timeout fails closed 403', async () => {
  const w = world({ captchaThrows: true });
  const r = await post(w, good);
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { error: 'captcha' });
  assert.equal(w.submits.length, 0);
});

test('captcha: remoteip sent only when the IP came from the trusted header', async () => {
  const a = world();
  await post(a, good);
  assert.deepEqual(a.captchaCalls, [{ token: 'tok', remoteip: '203.0.113.7' }]);
  const b = world();
  await post(b, good, { ip: { value: 'unknown', trusted: false } });
  assert.deepEqual(b.captchaCalls, [{ token: 'tok', remoteip: null }]);
});

test('success: 200 ok, normalized fields and hashed IP reach submit, raw IP never does', async () => {
  const w = world();
  const r = await post(w, good);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.deepEqual(w.submits, [{ name: 'Ann', email: 'ann@example.invalid', message: 'Hello there', ipHash: 'hash(203.0.113.7)' }]);
  assert.equal(r.headers['access-control-allow-origin'], ORIGIN);
});

test('success: missing IP header uses the shared unknown bucket', async () => {
  const w = world();
  const r = await post(w, good, { ip: { value: 'unknown', trusted: false } });
  assert.equal(r.status, 200);
  assert.equal(w.submits[0].ipHash, 'hash(unknown)');
});

test('success: omitted name stored as empty string', async () => {
  const w = world();
  const { name, ...noName } = good;
  await post(w, noName);
  assert.equal(w.submits[0].name, '');
});

test('rate_limited maps to 429', async () => {
  const w = world({ submitResult: 'rate_limited' });
  const r = await post(w, good);
  assert.equal(r.status, 429);
  assert.deepEqual(r.body, { error: 'rate_limited' });
});

test('unexpected submit result or throw maps to 500 internal', async () => {
  for (const over of [{ submitResult: 'weird' }, { submitThrows: true }]) {
    const w = world(over);
    const r = await post(w, good);
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: 'internal' });
  }
});

test('logs: error class only, never body, email, IP or token', async () => {
  const w = world({ captchaThrows: true });
  await post(w, good);
  const w2 = world({ submitThrows: true });
  await post(w2, good);
  const all = [...w.logs, ...w2.logs].join('|').toLowerCase();
  assert.ok(w.logs.length > 0 && w2.logs.length > 0);
  for (const secret of ['ann', 'hello', '203.0.113.7', 'tok', 'hash(']) assert.ok(!all.includes(secret), secret);
});

test('error bodies are uniform: only {error: code}', async () => {
  const w = world({ submitResult: 'rate_limited' });
  for (const r of [await post(w, good), await post(w, '{'), await post(w, good, { method: 'GET' })]) {
    assert.deepEqual(Object.keys(r.body), ['error']);
  }
});
