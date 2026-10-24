import { createRoot } from 'react-dom/client'
import { App } from './App'
import '/src/styles/global.css'

createRoot(document.getElementById('root')!).render(<App />)

// ── Register Service Worker ────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Service worker registration failed — non-critical for V1.
    })
  })
}
