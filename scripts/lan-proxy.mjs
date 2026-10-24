#!/usr/bin/env node
/**
 * SnapFire LAN HTTPS proxy.
 *
 * Phones refuse `getUserMedia` and service workers on plain-HTTP LAN origins,
 * and an HTTPS page cannot open an insecure `ws://` socket.  This process
 * solves both problems without touching the desktop build:
 *
 *   phone ──https/wss──> this proxy ──http/ws──> desktop LanServer (127.0.0.1)
 *                      └── serves dist/ (the PWA)
 *
 * Usage:
 *   npm run build
 *   npm run lan:cert      # once, generates certs/lan-{cert,key}.pem with mkcert
 *   npm run lan           # serves dist/ + proxies WebSocket to the desktop host
 *
 * Environment:
 *   LAN_PORT       HTTPS port (default 8443)
 *   LAN_HOST       bind address (default 0.0.0.0)
 *   LAN_ROOT       static root (default <repo>/dist)
 *   LAN_CERT       certificate path (default <repo>/certs/lan-cert.pem)
 *   LAN_KEY        private key path (default <repo>/certs/lan-key.pem)
 *   SNAPFIRE_WS    desktop LanServer host:port (default 127.0.0.1:17890)
 */

import { createServer } from 'node:https'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'
import net from 'node:net'

const ROOT_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)))
const STATIC_ROOT = resolve(process.env.LAN_ROOT || join(ROOT_DIR, 'dist'))
const CERT_FILE = resolve(process.env.LAN_CERT || join(ROOT_DIR, 'certs', 'lan-cert.pem'))
const KEY_FILE = resolve(process.env.LAN_KEY || join(ROOT_DIR, 'certs', 'lan-key.pem'))
const PORT = Number(process.env.LAN_PORT || 8443)
const HOST = process.env.LAN_HOST || '0.0.0.0'
const BACKEND = process.env.SNAPFIRE_WS || '127.0.0.1:17890'

const BACKEND_SEPARATOR = BACKEND.lastIndexOf(':')
const BACKEND_HOST = BACKEND_SEPARATOR > 0 ? BACKEND.slice(0, BACKEND_SEPARATOR) : BACKEND
const BACKEND_PORT = Number(
  BACKEND_SEPARATOR > 0 ? BACKEND.slice(BACKEND_SEPARATOR + 1) : 17890
)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

function fail(message) {
  console.error(`\n[lan] ${message}\n`)
  process.exit(1)
}

function lanAddresses() {
  const result = []
  const interfaces = networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      // 198.18.0.0/15 is used by some VPN/benchmark adapters and is not
      // reachable from a phone. Link-local addresses are not useful either.
      if (entry.address.startsWith('198.18.')) continue
      if (entry.address.startsWith('169.254.')) continue
      result.push(entry.address)
    }
  }
  return [...new Set(result)]
}

function cacheControl(pathname) {
  if (pathname.startsWith('/assets/')) {
    // Vite emits content-hashed file names.
    return 'public, max-age=31536000, immutable'
  }
  if (pathname.startsWith('/icons/') || pathname.startsWith('/models/')) {
    return 'public, max-age=604800'
  }
  return 'no-cache'
}

function safeFilePath(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null
  const candidate = resolve(STATIC_ROOT, `.${decoded}`)
  if (candidate !== STATIC_ROOT && !candidate.startsWith(STATIC_ROOT + sep)) {
    return null
  }
  return candidate
}

async function handleStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' })
    res.end('Method Not Allowed')
    return
  }

  let pathname
  try {
    pathname = new URL(req.url || '/', 'https://lan.local').pathname
  } catch {
    res.writeHead(400)
    res.end('Bad Request')
    return
  }

  const requestPath = pathname === '/' ? '/index.html' : pathname
  let filePath = safeFilePath(requestPath)

  if (!filePath) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  let stats = null
  try {
    stats = statSync(filePath)
  } catch {
    stats = null
  }

  if (stats?.isDirectory()) {
    filePath = join(filePath, 'index.html')
    try {
      stats = statSync(filePath)
    } catch {
      stats = null
    }
  }

  // SPA fallback: unknown extension-less paths return the shell.
  if (!stats && !extname(requestPath)) {
    const acceptsHtml = String(req.headers.accept || '').includes('text/html')
    if (acceptsHtml) {
      filePath = join(STATIC_ROOT, 'index.html')
      try {
        stats = statSync(filePath)
      } catch {
        stats = null
      }
    }
  }

  if (!stats || !stats.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
    return
  }

  const extension = extname(filePath).toLowerCase()
  const headers = {
    'Content-Type': MIME[extension] || 'application/octet-stream',
    'Content-Length': stats.size,
    'Cache-Control': cacheControl(pathname),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  }
  if (pathname === '/service-worker.js') {
    headers['Cache-Control'] = 'no-cache'
    headers['Service-Worker-Allowed'] = '/'
  }

  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return
  }

  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500)
    res.end()
  })
  stream.pipe(res)
}

function handleUpgrade(req, socket, head) {
  if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    socket.destroy()
    return
  }

  let backend
  try {
    backend = net.connect(
      { host: BACKEND_HOST, port: BACKEND_PORT },
      () => {
        // Rebuild the request line and headers for the plain-WS backend.
        const lines = [`${req.method} ${req.url} HTTP/1.1`]
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          const name = req.rawHeaders[i]
          if (name.toLowerCase() === 'host') continue
          lines.push(`${name}: ${req.rawHeaders[i + 1]}`)
        }
        lines.push(`Host: ${BACKEND_HOST}:${BACKEND_PORT}`)
        backend.write(`${lines.join('\r\n')}\r\n\r\n`)
        if (head?.length) backend.write(head)
        backend.setNoDelay(true)
        socket.setNoDelay(true)
        socket.pipe(backend).pipe(socket)
      }
    )
  } catch (error) {
    console.warn(`[lan] websocket proxy setup failed: ${error.message}`)
    socket.destroy()
    return
  }

  backend.setTimeout(0)
  socket.setTimeout(0)
  backend.on('error', (error) => {
    console.warn(`[lan] websocket backend error: ${error.message}`)
    socket.destroy()
  })
  backend.on('close', () => socket.destroy())
  socket.on('error', () => backend.destroy())
  socket.on('close', () => backend.destroy())
}

async function main() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    fail(`LAN_PORT 无效：${process.env.LAN_PORT}`)
  }
  if (!Number.isInteger(BACKEND_PORT) || BACKEND_PORT < 1 || BACKEND_PORT > 65535) {
    fail(`SNAPFIRE_WS 端口无效：${BACKEND}`)
  }
  if (!existsSync(STATIC_ROOT)) {
    fail(
      `找不到静态目录：${STATIC_ROOT}\n请先运行：npm run build`
    )
  }
  if (!existsSync(CERT_FILE) || !existsSync(KEY_FILE)) {
    fail(
      `找不到证书：\n  ${CERT_FILE}\n  ${KEY_FILE}\n\n` +
        '请先运行：npm run lan:cert\n' +
        '（没有 mkcert 时可临时使用：npm run lan:cert:selfsigned）'
    )
  }

  const [cert, key] = await Promise.all([readFile(CERT_FILE), readFile(KEY_FILE)])

  const server = createServer(
    { cert, key, minVersion: 'TLSv1.2' },
    (req, res) => {
      handleStatic(req, res).catch((error) => {
        console.error('[lan] static handler failed', error)
        if (!res.headersSent) res.writeHead(500)
        res.end()
      })
    }
  )

  server.on('upgrade', handleUpgrade)
  server.on('clientError', (_error, socket) => {
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    } else {
      socket.destroy()
    }
  })
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      fail(`端口 ${PORT} 已被占用，请设置 LAN_PORT 换一个端口。`)
    }
    fail(`HTTPS 服务启动失败：${error.message}`)
  })

  server.listen(PORT, HOST, () => {
    const addresses = lanAddresses()
    console.log('')
    console.log('  SnapFire LAN — HTTPS + WSS proxy')
    console.log('  ─────────────────────────────────────────────')
    console.log(`  静态目录 : ${STATIC_ROOT}`)
    console.log(`  证书     : ${CERT_FILE}`)
    console.log(`  WebSocket: wss://<host>:${PORT}  →  ws://${BACKEND_HOST}:${BACKEND_PORT}`)
    console.log('')
    if (addresses.length === 0) {
      console.log(`  未找到局域网 IPv4 地址，请检查网络连接。`)
    } else {
      for (const address of addresses) {
        console.log(`  手机访问 : https://${address}:${PORT}`)
      }
    }
    console.log('')
    console.log('  提示：房间地址填写手机页面上的地址即可（默认已预填）。')
    console.log('  按 Ctrl+C 停止。')
    console.log('')
  })

  const shutdown = () => {
    console.log('\n[lan] 正在关闭…')
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 1500).unref()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => fail(error.stack || String(error)))
