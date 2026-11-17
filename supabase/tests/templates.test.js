// V2-16: guards for the branded auth email templates (no Supabase host, no banned card art, images exist).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')
test('apple-touch-icon exists', () => {
  assert.ok(imageExists('apple-touch-icon.png'))
})

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
    // The SOURCE comment links supabase.com/docs, so check the markup without comments.
    const markup = html.replace(/<!--[\s\S]*?-->/g, '')
    assert.ok(!markup.includes('supabase.co'))
    assert.ok(!markup.includes('ConfirmationURL'))
  })
  test(`${name}: no double slash after SiteURL`, () => {
    assert.ok(!/\{\{ \.SiteURL \}\}\//.test(html))
  })
  test(`${name}: no card image (bag art carries the LEGO logo)`, () => {
    assert.ok(!/minifighunt\.com\/cards\//.test(html))
    assert.ok(!/\/cards\/\d+\.png/.test(html))
  })
  test(`${name}: every site image URL maps to an existing file`, () => {
    const urls = [...html.matchAll(/https:\/\/minifighunt\.com\/((?:img|email)\/[^"')\s]+|apple-touch-icon\.png)/g)].map((m) => m[1])
    assert.ok(urls.length >= 4, 'expected three figure images and the app icon')
    for (const rel of urls) assert.ok(imageExists(rel), `missing file for ${rel}`)
  })
  test(`${name}: figure images are PNG (Outlook has no webp) and decorative`, () => {
    const figs = [...html.matchAll(/<img src="https:\/\/minifighunt\.com\/email\/([^"]+)"[^>]*>/g)]
    assert.equal(figs.length, 3)
    for (const m of figs) {
      assert.ok(m[1].endsWith('.png'), m[1])
      assert.ok(/ alt=""/.test(m[0]), 'figure image alt must be empty')
      assert.ok(/ width="120"/.test(m[0]))
    }
    assert.ok(!/\.webp/.test(html))
  })
  test(`${name}: every href starts with SiteURL or the production host`, () => {
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
    assert.ok(hrefs.length >= 2)
    for (const h of hrefs) {
      assert.ok(h.startsWith('{{ .SiteURL }}') || h.startsWith('https://minifighunt.com'), h)
    }
  })
}
