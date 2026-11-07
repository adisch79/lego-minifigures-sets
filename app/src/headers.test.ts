import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Run from app/ (vitest cwd). The Cloudflare Pages _headers file is static, so this test pins its security contract.
const text = readFileSync('public/_headers', 'utf8')
const header = (name: string): string => {
  const m = text.match(new RegExp(String.raw`^\s+${name}:\s*(.+)$`, 'mi'))
  if (!m) throw new Error(`missing header ${name}`)
  return m[1].trim()
}

describe('public/_headers', () => {
  it('applies to every path', () => {
    expect(text).toMatch(/^\/\*\s*$/m)
  })
  it('CSP forbids framing, plugins and foreign scripts', () => {
    const csp = header('Content-Security-Policy')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).not.toMatch(/script-src[^;]*unsafe/)
  })
  it('CSP connect-src allows only self and the Supabase project', () => {
    const connect = header('Content-Security-Policy').match(/connect-src ([^;]+)/)![1].trim().split(/\s+/)
    expect(connect).toEqual(["'self'", 'https://iagnfgedasxkqqjbsoeg.supabase.co'])
  })
  it('CSP img-src has no external host (all images are bundled)', () => {
    expect(header('Content-Security-Policy')).toMatch(/img-src 'self' data:(;|$)/)
  })
  it('sets HSTS, nosniff and Referrer-Policy', () => {
    expect(header('Strict-Transport-Security')).toMatch(/^max-age=\d{7,}/)
    expect(header('X-Content-Type-Options')).toBe('nosniff')
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
})
