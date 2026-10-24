/**
 * SnapFire Mobile service worker.
 *
 * - App shell + icons are precached, so the home screen opens offline.
 * - Vite's content-hashed /assets/ files are cache-first (immutable).
 * - AI models are cache-first on first use (they are large, ~12 MB).
 * - Navigations are network-first with an offline shell fallback, so a new
 *   deployment is picked up as soon as the phone is online.
 */

const VERSION = 'v3'
const SHELL_CACHE = `snapfire-shell-${VERSION}`
const ASSET_CACHE = `snapfire-assets-${VERSION}`
const MODEL_CACHE = `snapfire-models-${VERSION}`
const ICON_CACHE = `snapfire-icons-${VERSION}`
const KNOWN_CACHES = new Set([
  SHELL_CACHE,
  ASSET_CACHE,
  MODEL_CACHE,
  ICON_CACHE
])

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

const OFFLINE_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SnapFire Mobile</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#07090a;color:#e0e0e0;font-family:system-ui,sans-serif;text-align:center;padding:24px}
h1{letter-spacing:.18em;font-size:26px}p{color:#8a9199;font-size:13px;line-height:1.6}
button{margin-top:16px;padding:10px 22px;border:0;border-radius:6px;background:#f0a030;
color:#000;font-weight:600;font-size:14px}
</style></head><body><div>
<h1>SNAPFIRE</h1><p>当前离线，且首页尚未缓存。<br>连接局域网后刷新即可。</p>
<button onclick="location.reload()">重新加载</button>
</div></body></html>`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('snapfire-') && !KNOWN_CACHES.has(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Never cache the worker itself or HMR-like endpoints.
  if (url.pathname === '/service-worker.js') return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event, request, SHELL_CACHE, '/index.html'))
    return
  }

  if (url.pathname.startsWith('/models/')) {
    event.respondWith(cacheFirst(event, request, MODEL_CACHE))
    return
  }
  if (url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(event, request, ICON_CACHE))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event, request, ASSET_CACHE))
    return
  }

  event.respondWith(staleWhileRevalidate(event, request, ASSET_CACHE))
})

async function cacheFirst(event, request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (isCacheable(response)) {
      event.waitUntil(cache.put(request, response.clone()))
    }
    return response
  } catch {
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}

async function networkFirst(event, request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timer)
    if (isCacheable(response)) {
      event.waitUntil(cache.put(request, response.clone()))
    }
    return response
  } catch {
    clearTimeout(timer)
    const cached = await cache.match(request)
    if (cached) return cached
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl)
      if (fallback) return fallback
    }
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
}

async function staleWhileRevalidate(event, request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        event.waitUntil(cache.put(request, response.clone()))
      }
      return response
    })
    .catch(() => null)

  if (cached) return cached
  const response = await network
  return (
    response ||
    new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  )
}

function isCacheable(response) {
  return Boolean(response && response.ok && response.type === 'basic' && response.status !== 206)
}
