// Cloudflare Turnstile widget, explicit render, no npm package.
// SOURCE: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
// Only active when VITE_TURNSTILE_SITE_KEY is set; otherwise the sign-in form has no widget and no token.
import { useEffect, useRef, useState } from 'react'

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** The configured site key, read on each call so tests can stub the env. Empty string means disabled. */
export function turnstileSiteKey(): string {
  return ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '').trim()
}

let scriptPromise: Promise<TurnstileApi> | null = null

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = TURNSTILE_SCRIPT
      s.async = true
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
      s.onerror = () => {
        scriptPromise = null
        reject(new Error('turnstile script failed'))
      }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

/**
 * Renders the widget and reports the token (null when it expires or errors).
 * Change `resetKey` to remount the widget and get a fresh token, as a token works once.
 */
export function Turnstile({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  resetKey: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  // failed: script did not load or the widget reported an error; attempt remounts the widget on Retry.
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const onTokenRef = useRef(onToken)
  useEffect(() => {
    onTokenRef.current = onToken
  })

  useEffect(() => {
    let active = true
    let widgetId: string | null = null
    let api: TurnstileApi | null = null
    onTokenRef.current(null)
    loadScript()
      .then((t) => {
        if (!active || !hostRef.current) return
        api = t
        widgetId = t.render(hostRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            onTokenRef.current(null)
            if (active) setFailed(true)
          },
        })
      })
      .catch(() => {
        onTokenRef.current(null)
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (api && widgetId !== null) api.remove(widgetId)
    }
  }, [siteKey, resetKey, attempt])

  if (failed) {
    return (
      <p className="msg" role="alert">
        Verification could not load.{' '}
        <button
          type="button"
          className="linkish"
          onClick={() => {
            setFailed(false)
            setAttempt((n) => n + 1)
          }}
        >
          Retry
        </button>
      </p>
    )
  }
  return <div ref={hostRef} className="turnstile" />
}
