/**
 * Service Worker for SnapFire Mobile PWA.
 *
 * Strategy:
 *  - AI model files: CacheFirst (never change after deploy).
 *  - Static assets (HTML, CSS, JS): NetworkFirst with stale-while-revalidate.
 *  - Icons: CacheFirst.
 */

const CACHE_NAME = 'snapfire-v1'
const MODEL_CACHE = 'models-v1'
const ICON_CACHE = 'icons-v1'

// ── Install: precache the shell ────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json'
      ]).catch(() => {})
    })
  )
  self.skipWaiting()
})

// ── Activate: claim clients + clean old caches ─────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== MODEL_CACHE && n !== ICON_CACHE)
          .map((n) => caches.delete(n))
      )
    })
  )
  self.clients.claim()
})

// ── Fetch: serve from cache or network ─────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // AI model files — cache first.
  if (url.pathname.startsWith('/models/')) {
    event.respondWith(modelFetch(event.request))
    return
  }

  // Icons — cache first.
  if (url.pathname.startsWith('/icons/')) {
    event.respondWith(iconFetch(event.request))
    return
  }

  // Everything else — network first, fallback to cache.
  event.respondWith(networkFirst(event.request, CACHE_NAME))
})

// ── Fetch strategies ───────────────────────────────────────────────────────

async function modelFetch(request) {
  const cache = await caches.open(MODEL_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached || new Response('Not found', { status: 404 })
  }
}

async function iconFetch(request) {
  const cache = await caches.open(ICON_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached || new Response('Not found', { status: 404 })
  }
}

async function networkFirst(request, cacheName) {
  try {
    const networkResp = await fetch(request)
    if (networkResp.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResp.clone())
    }
    return networkResp
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') {
      return caches.match('/index.html')
    }
    return new Response('Offline', { status: 503 })
  }
}
