// Copies the single committed image set site/img -> app/public/img (git-ignored)
// so dev and build serve the paths used in public/catalog.json ("img/<id>/<file>").
// Also copies site/email (PNG copies for the auth mails, served at /email/).
// Run automatically via the predev and prebuild npm scripts.
import { cp, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../site/img')
const dest = resolve(here, '../public/img')

try {
  await stat(src)
} catch {
  console.error(`copy-images: source folder missing: ${src}`)
  process.exit(1)
}

await rm(dest, { recursive: true, force: true })
await cp(src, dest, { recursive: true })
console.log(`copy-images: ${src} -> ${dest}`)

const emailSrc = resolve(here, '../../site/email')
const emailDest = resolve(here, '../public/email')
await rm(emailDest, { recursive: true, force: true })
await cp(emailSrc, emailDest, { recursive: true })
console.log(`copy-images: ${emailSrc} -> ${emailDest}`)
