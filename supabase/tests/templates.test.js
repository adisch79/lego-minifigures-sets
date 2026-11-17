// V2-16: guards for the branded auth email templates (no Supabase host, no banned card art, images exist).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')
const FILES = ['magic_link.html', 'confirmation.html']

// Images are served from app/public/img, a git-ignored copy of the committed site/img
// (app/scripts/copy-images.mjs). Either location proves the file ships.
function imageExists(rel) {
  return [resolve(repo, 'app/public', rel), resolve(repo, 'site', rel)].some((p) => existsSync(p))
}

for (const name of FILES) {
  const html = readFileSync(resolve(here, '../templates', name), 'utf8')
  test(`${name}: keeps the 6-digit code and the token hash link`, () => {
    assert.ok(html.includes('{{ .Token }}'))
    assert.ok(html.includes('{{ .TokenHash }}'))
    assert.ok(html.includes('{{ .SiteURL }}'))
    assert.ok(html.includes('type=email'))
  })
  test(`${name}: no Supabase host and no ConfirmationURL`, () => {
    assert.ok(!html.includes('supabase.co'))
    assert.ok(!html.includes('ConfirmationURL'))
  })
  test(`${name}: no double slash after SiteURL`, () => {
    assert.ok(!/\{\{ \.SiteURL \}\}\//.test(html))
  })
  test(`${name}: no card image (bag art carries the LEGO logo)`, () => {
    assert.ok(!/minifighunt\.com\/cards\//.test(html))
    assert.ok(!/\/cards\/\d+\.png/.test(html))
  })
  test(`${name}: every site image URL maps to an existing file`, () => {
    const urls = [...html.matchAll(/https:\/\/minifighunt\.com\/(img\/[^"')\s]+)/g)].map((m) => m[1])
    assert.ok(urls.length >= 3, 'expected at least three figure images')
    for (const rel of urls) assert.ok(imageExists(rel), `missing file for ${rel}`)
  })
}
