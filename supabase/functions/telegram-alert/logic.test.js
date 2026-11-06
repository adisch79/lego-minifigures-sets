// Unit tests for the pure helpers of the telegram-alert function.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidTarget, parseAlertKey, linkFor, buildMessage, whoLabel, secretsMatch } from './logic.ts';

const U = '12345678-aaaa-4bbb-8ccc-1234567890ab';

test('id validation matches the marks constraints', () => {
  assert.ok(isValidTarget('series', '71053'));
  assert.ok(isValidTarget('figure', '71053-12'));
  for (const [k, t] of [['series', '71053-1'], ['figure', '71053'], ['series', '123'],
    ['figure', '71053-12345'], ['x', '71053'], ['series', '71053/../'], ['series', 71053], ['figure', "1234-1'"]]) {
    assert.equal(isValidTarget(k, t), false, `${k} ${t}`);
  }
});

test('parseAlertKey takes exactly the key', () => {
  assert.deepEqual(parseAlertKey({ user_id: U, kind: 'series', target_id: '71053' }),
    { user_id: U, kind: 'series', target_id: '71053' });
  assert.equal(parseAlertKey({ user_id: U, kind: 'series', target_id: '71053', text: 'x' }), null);
  assert.equal(parseAlertKey({ user_id: 'nope', kind: 'series', target_id: '71053' }), null);
  assert.equal(parseAlertKey({ user_id: U, kind: 'series' }), null);
  assert.equal(parseAlertKey(null), null);
  assert.equal(parseAlertKey([]), null);
});

test('link: figure maps to parent series', () => {
  const base = 'https://adisch79.github.io/lego-minifigures-sets/#series/';
  assert.equal(linkFor('71053'), base + '71053');
  assert.equal(linkFor('71053-4'), base + '71053');
});

test('message: plain text with who, what, link', () => {
  const m = buildMessage('Ann', { user_id: U, kind: 'figure', target_id: '71053-4' });
  assert.equal(m, 'Ann wants figure 71053-4\nhttps://adisch79.github.io/lego-minifigures-sets/#series/71053');
});

test('who: display name cleaned, else short id', () => {
  assert.equal(whoLabel(null, U), 'user 12345678');
  assert.equal(whoLabel('   ', U), 'user 12345678');
  assert.equal(whoLabel('A\nB\u0007', U), 'A B');
  assert.equal(whoLabel('x'.repeat(80), U).length, 50);
});

test('secretsMatch', async () => {
  assert.equal(await secretsMatch('abc', 'abc'), true);
  assert.equal(await secretsMatch('abd', 'abc'), false);
  assert.equal(await secretsMatch('abcd', 'abc'), false);
  assert.equal(await secretsMatch('', 'abc'), false);
  assert.equal(await secretsMatch(null, 'abc'), false);
  assert.equal(await secretsMatch('', ''), false);
});

test('who: bidi and zero-width chars are stripped', () => {
  assert.equal(whoLabel('A\u202eB\u200bC\u2066D\u2069E\ufeffF\u200f', U), 'ABCDEF');
  assert.equal(whoLabel('\u202e\u200b', U), 'user 12345678');
  assert.ok(!buildMessage('Eve\u202e', { user_id: U, kind: 'series', target_id: '71053' }).includes('\u202e'));
});

test('who: U+061C, line/paragraph separators and invisible operators are stripped', () => {
  assert.equal(whoLabel('A؜B C D⁠E⁡F⁤G', U), 'ABCDEFG');
});

test('who: truncation keeps surrogate pairs whole', () => {
  const name = '\u{1F600}'.repeat(60);
  const out = whoLabel(name, U);
  assert.equal(Array.from(out).length, 50);
  assert.equal(out, '\u{1F600}'.repeat(50));
});
