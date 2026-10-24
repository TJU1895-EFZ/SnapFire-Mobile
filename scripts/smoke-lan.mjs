#!/usr/bin/env node
/**
 * End-to-end smoke test for scripts/lan-proxy.mjs.
 *
 * Requires `npm run build` and a certificate in certs/ (see lan:cert).
 * Starts a throw-away WebSocket backend, then verifies:
 *   - HTTPS serves the built app, models and service worker headers
 *   - path traversal is rejected
 *   - wss:// upgrades are proxied to the plain-WS backend
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

// The smoke test trusts the locally generated certificate only.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const ROOT_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PROXY_PORT = Number(process.env.SMOKE_PORT || 9443)
const PROXY_URL = `https://127.0.0.1:${PROXY_PORT}`

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(predicate, timeoutMs = 8000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return
    await wait(150)
  }
  throw new Error('timed out waiting for the proxy')
}

async function main() {
  const backend = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await new Promise((resolve, reject) => {
    backend.once('listening', resolve)
    backend.once('error', reject)
  })
  const backendPort = backend.address().port
  backend.on('connection', (socket) => {
    socket.on('message', (data) => socket.send(data))
  })

  const proxy = spawn(process.execPath, [join(ROOT_DIR, 'scripts', 'lan-proxy.mjs')], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      LAN_HOST: '127.0.0.1',
      LAN_PORT: String(PROXY_PORT),
      SNAPFIRE_WS: `127.0.0.1:${backendPort}`
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let proxyOutput = ''
  proxy.stdout.on('data', (chunk) => {
    proxyOutput += chunk
  })
  proxy.stderr.on('data', (chunk) => {
    proxyOutput += chunk
  })

  const cleanup = () => {
    try {
      proxy.kill('SIGTERM')
    } catch {
      // ignore
    }
    backend.close()
  }

  try {
    await waitFor(async () => {
      try {
        const response = await fetch(`${PROXY_URL}/`)
        return response.ok
      } catch {
        return false
      }
    })

    const index = await fetch(`${PROXY_URL}/`)
    assert.equal(index.status, 200)
    const html = await index.text()
    assert.match(html, /<div id="root">/)

    const model = await fetch(`${PROXY_URL}/models/blazeface.json`)
    assert.equal(model.status, 200)
    const modelJson = await model.json()
    assert.ok(modelJson, 'model JSON should parse')

    const worker = await fetch(`${PROXY_URL}/service-worker.js`)
    assert.equal(worker.status, 200)
    assert.equal(worker.headers.get('service-worker-allowed'), '/')

    const traversal = await fetch(`${PROXY_URL}/%2e%2e%2fpackage.json`)
    assert.ok(
      traversal.status === 403 || traversal.status === 404,
      `path traversal should be rejected (got ${traversal.status})`
    )

    const ws = new WebSocket(`wss://127.0.0.1:${PROXY_PORT}/`, {
      rejectUnauthorized: false
    })
    await new Promise((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    })
    const echoed = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WS echo timed out')), 4000)
      ws.once('message', (data) => {
        clearTimeout(timer)
        resolve(String(data))
      })
      ws.send('snapfire-ping')
    })
    assert.equal(echoed, 'snapfire-ping')
    ws.close()

    console.log('\n[smoke] LAN proxy OK: HTTPS, models, service worker, WSS proxy\n')
  } catch (error) {
    console.error('\n[smoke] failed:', error)
    if (proxyOutput) console.error('\n--- proxy output ---\n' + proxyOutput)
    process.exitCode = 1
  } finally {
    cleanup()
    await wait(150)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
