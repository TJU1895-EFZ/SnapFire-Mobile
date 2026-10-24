import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from '@mobile/components/ErrorBoundary'
import '/src/styles/global.css'
import '/src/styles/screens.css'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

// ── PWA service worker ─────────────────────────────────────────────────────
// Only register in production builds.  During `vite dev` a service worker
// would cache network-first responses and make iteration confusing.

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.warn('[pwa] service worker registration failed', error)
    })
  })
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  // A worker left over from a previous production preview on the same origin
  // would serve stale assets during development.
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) void registration.unregister()
    })
    .catch(() => undefined)
}
