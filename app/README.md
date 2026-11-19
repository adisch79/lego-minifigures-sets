# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Sign-in settings

Create `app/.env.local` (git-ignored via `*.local`) with the two names `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`, and fill both values from the Supabase dashboard, Project Settings, API (project URL and anon key). In CI they are repo variables, not secrets. With either empty the site works without sign-in. The service-role key must never get a `VITE_` name: it would ship in the bundle.

## Open sign-up and Turnstile (V2-09)
`VITE_TURNSTILE_SITE_KEY` (public site key) switches on the Turnstile widget on the sign-in form and adds challenges.cloudflare.com to the meta CSP. Unset: no widget, no captcha token (local dev, tests). SOURCE: https://developers.cloudflare.com/turnstile/

Release order (wrong order blocks every sign-in):
1. Create the Turnstile site in Cloudflare.
2. Set `VITE_TURNSTILE_SITE_KEY` in the Cloudflare Pages build environment.
3. Build and deploy, then check the widget shows on the sign-in form.
4. Only then put the Turnstile secret into Supabase Auth > Attack Protection and enable captcha.
Full checklist: docs/design/V2-09-open-signup.md (on dev after the docs merge).
