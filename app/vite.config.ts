/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Injects a CSP meta tag at build time. connect-src gets the Supabase origin only when configured.
function cspPlugin(supabaseUrl: string | undefined): Plugin {
  const origin = (() => {
    try {
      return supabaseUrl ? new URL(supabaseUrl).origin : ''
    } catch {
      return ''
    }
  })()
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self'${origin ? ` ${origin}` : ''}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// base './' keeps asset URLs relative so the build works under a Pages sub-path.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: './',
    plugins: [react(), cspPlugin(env.VITE_SUPABASE_URL)],
    test: {
      environment: 'jsdom',
    },
  }
})
