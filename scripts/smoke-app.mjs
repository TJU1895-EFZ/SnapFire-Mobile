#!/usr/bin/env node
/**
 * Browser smoke test: production build + LAN HTTPS proxy + mock room server.
 *
 * Exercises the real UI: home → room entry → lobby → enrollment modal →
 * countdown → battle (camera + target select + fire) → results → home.
 *
 * Requires:
 *   - npm run build
 *   - a certificate in certs/ (npm run lan:cert / lan:cert:selfsigned)
 *   - Microsoft Edge or Chrome (set BROWSER_PATH to override)
 *
 * Usage: npm run smoke:app
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { chromium } from 'playwright-core'

const ROOT_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)))
const ARTIFACTS = join(ROOT_DIR, 'artifacts')
const PROXY_PORT = Number(process.env.SMOKE_APP_PORT || 9445)
const PROXY_URL = `https://127.0.0.1:${PROXY_PORT}`
const ROOM_CODE = '1234'

const BROWSER_CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean)

const browserPath = BROWSER_CANDIDATES.find((candidate) => existsSync(candidate))
if (!browserPath) {
  console.error(
    '\n[smoke:app] 未找到 Edge/Chrome。请设置 BROWSER_PATH 指向浏览器可执行文件。\n'
  )
  process.exit(1)
}

mkdirSync(ARTIFACTS, { recursive: true })

// ── Mock desktop room server ───────────────────────────────────────────────

const clients = new Set()
const players = new Map()
let phase = 'lobby'
let countdownEndsAt = null
let matchEndsAt = null
let result = null
let joinedId = null
let countdownTimer = null
const shots = []

function makePlayer(id, name, team, options = {}) {
  return {
    id,
    name,
    team,
    ready: options.ready ?? false,
    connected: true,
    appearanceReady: options.appearanceReady ?? true,
    isHost: options.isHost ?? false,
    hp: 100,
    alive: true,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    respawnAt: null,
    invulnerableUntil: null
  }
}

function roomState() {
  return {
    roomCode: ROOM_CODE,
    hostId: 'host-desktop',
    phase,
    players: [...players.values()].map((player) => ({ ...player })),
    settings: { durationMin: 5, killLimit: 10 },
    score: { red: 10, blue: 4 },
    matchStartedAt: phase === 'playing' ? Date.now() - 30_000 : null,
    matchEndsAt,
    remainingMs: matchEndsAt ? Math.max(0, matchEndsAt - Date.now()) : null,
    countdownEndsAt,
    serverNow: Date.now(),
    killFeed: [],
    result
  }
}

function send(socket, message) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
}

function broadcast(message) {
  for (const socket of clients) send(socket, message)
}

function broadcastRoom() {
  broadcast({ type: 'room', room: roomState() })
}

function startMatch() {
  phase = 'countdown'
  countdownEndsAt = Date.now() + 1200
  matchEndsAt = null
  result = null
  for (const player of players.values()) {
    player.hp = 100
    player.alive = true
    player.kills = 0
    player.deaths = 0
    player.shots = 0
    player.hits = 0
  }
  broadcast({ type: 'match-start', room: roomState() })
  broadcastRoom()
  countdownTimer = setTimeout(() => {
    if (phase !== 'countdown') return
    phase = 'playing'
    countdownEndsAt = null
    matchEndsAt = Date.now() + 5 * 60_000
    broadcastRoom()
  }, 1300)
}

function endMatch() {
  phase = 'ended'
  countdownEndsAt = null
  matchEndsAt = Date.now()
  const list = [...players.values()]
  result = {
    matchId: `smoke-${Date.now()}`,
    mode: 'urban',
    startedAt: Date.now() - 60_000,
    endedAt: Date.now(),
    durationMin: 5,
    killLimit: 10,
    winner: 'red',
    score: { red: 10, blue: 4 },
    players: list.map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      kills: player.team === 'red' ? 10 : 4,
      deaths: player.team === 'red' ? 4 : 10,
      shots: 20,
      hits: 10,
      accuracy: 0.5
    }))
  }
  broadcast({ type: 'match-end', result })
  broadcastRoom()
}

const backend = new WebSocketServer({ host: '127.0.0.1', port: 0 })
await new Promise((resolvePort, reject) => {
  backend.once('listening', resolvePort)
  backend.once('error', reject)
})
const backendPort = backend.address().port

backend.on('connection', (socket) => {
  clients.add(socket)

  socket.on('message', (raw) => {
    let message
    try {
      message = JSON.parse(String(raw))
    } catch {
      return
    }

    switch (message.type) {
      case 'join': {
        joinedId = message.playerId
        players.set(
          joinedId,
          makePlayer(joinedId, message.name || 'Mobile', 'red', {
            appearanceReady: true
          })
        )
        if (!players.has('host-desktop')) {
          players.set(
            'host-desktop',
            makePlayer('host-desktop', 'Desktop Host', 'blue', {
              isHost: true,
              ready: true
            })
          )
        }
        if (!players.has('bot-alpha')) {
          players.set(
            'bot-alpha',
            makePlayer('bot-alpha', 'Bot Alpha', 'blue', { ready: true })
          )
        }
        send(socket, {
          type: 'welcome',
          selfId: joinedId,
          isHost: false,
          room: roomState(),
          gallery: []
        })
        broadcastRoom()
        break
      }
      case 'set-team': {
        const player = players.get(joinedId)
        if (player) {
          player.team = message.team
          player.ready = false
          broadcastRoom()
        }
        break
      }
      case 'set-ready': {
        const player = players.get(joinedId)
        if (player) {
          player.ready = Boolean(message.ready)
          broadcastRoom()
        }
        break
      }
      case 'set-appearance': {
        const player = players.get(joinedId)
        if (player) {
          player.appearanceReady = true
          player.ready = false
          broadcastRoom()
        }
        break
      }
      case 'set-name': {
        const player = players.get(joinedId)
        if (player) {
          player.name = String(message.name || player.name)
          broadcastRoom()
        }
        break
      }
      case 'shot': {
        shots.push(message.targetId ?? null)
        send(socket, {
          type: 'shot-result',
          hit: false,
          targetId: message.targetId ?? undefined,
          reason: message.targetId ? 'target-dead' : 'no-target'
        })
        break
      }
      case 'leave': {
        const player = players.get(joinedId)
        if (player) player.connected = false
        broadcastRoom()
        break
      }
      case 'ping':
        send(socket, { type: 'pong', t: message.t })
        break
      default:
        break
    }
  })

  socket.on('close', () => {
    clients.delete(socket)
  })
})

// ── LAN proxy ──────────────────────────────────────────────────────────────

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

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms))
}

async function waitForNode(predicate, timeoutMs = 10_000, label = 'condition') {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return
    await wait(100)
  }
  throw new Error(`timeout waiting for ${label}`)
}

async function waitForProxy() {
  const started = Date.now()
  while (Date.now() - started < 10_000) {
    try {
      // NODE_TLS_REJECT_UNAUTHORIZED=0 above trusts the self-signed test cert.
      const response = await fetch(`${PROXY_URL}/`)
      if (response.ok) return
    } catch {
      // retry
    }
    await wait(200)
  }
  throw new Error('LAN proxy did not start')
}

// ── Browser test ───────────────────────────────────────────────────────────

let browser = null
let exitCode = 0
const pageErrors = []
const consoleErrors = []
const visionLogs = []

function cleanup() {
  if (countdownTimer) clearTimeout(countdownTimer)
  try {
    proxy.kill('SIGTERM')
  } catch {
    // ignore
  }
  backend.close()
}

try {
  // The proxy uses a self-signed test certificate; fetch from Node needs this.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  await waitForProxy()
  await wait(300)

  browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--ignore-certificate-errors',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage'
    ]
  })

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1
  })
  await context.grantPermissions(['camera'], { origin: PROXY_URL })
  const page = await context.newPage()

  page.on('pageerror', (error) => pageErrors.push(String(error)))
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() === 'error') consoleErrors.push(text)
    if (text.includes('[vision]')) visionLogs.push(text)
  })

  await page.goto(PROXY_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.getByRole('button', { name: /常规作战/ }).waitFor({ timeout: 20_000 })
  await page.screenshot({ path: join(ARTIFACTS, '01-home.png') })

  // ── Long March introduction and scene list ───────────────────────────
  await page
    .getByRole('button', { name: /长征胜利\s*90\s*周年纪念/ })
    .click()
  await page.getByText('历史背景：被迫的战略转移').waitFor({ timeout: 10_000 })
  await page.getByText(/还需等待 \d+ 秒/).waitFor({ timeout: 5_000 })
  const nextButton = page.getByRole('button', { name: '下一步' })
  assert.equal(await nextButton.isDisabled(), true, 'next must stay locked')
  await page.screenshot({ path: join(ARTIFACTS, '01a-long-march-intro.png') })

  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll('button')].find((item) =>
        item.textContent?.includes('下一步')
      )
      return button instanceof HTMLButtonElement && !button.disabled
    },
    { timeout: 15_000 }
  )
  await nextButton.click()
  await page.getByRole('button', { name: /历史场景/ }).waitFor({ timeout: 10_000 })
  await page.screenshot({ path: join(ARTIFACTS, '01b-long-march-menu.png') })

  await page.getByRole('button', { name: /历史场景/ }).click()
  await page.getByText('湘江战役').first().waitFor({ timeout: 10_000 })
  await page.screenshot({ path: join(ARTIFACTS, '01c-long-march-battles.png') })
  await page.getByRole('button', { name: '← 返回' }).click()
  await page.getByRole('button', { name: /历史场景/ }).waitFor({ timeout: 10_000 })
  await page.getByRole('button', { name: '← 返回' }).click()
  await page.getByRole('button', { name: /常规作战/ }).waitFor({ timeout: 10_000 })

  // ── Regular combat: four modes, then team battle → urban ─────────────
  await page.getByRole('button', { name: /常规作战/ }).click()
  await page.getByRole('button', { name: /单人/ }).waitFor({ timeout: 10_000 })
  await page.getByRole('button', { name: /单人/ }).click()
  await page.getByText('单人模式暂未开放，敬请期待').waitFor({ timeout: 5_000 })
  await page.screenshot({ path: join(ARTIFACTS, '01d-combat-menu.png') })

  await page.getByRole('button', { name: /团战/ }).click()
  await page.getByRole('button', { name: /巷战/ }).waitFor({ timeout: 10_000 })
  await page.getByRole('button', { name: /野战/ }).click()
  await page.getByText('野战模式暂未开放，敬请期待').waitFor({ timeout: 5_000 })
  await page.screenshot({ path: join(ARTIFACTS, '01e-team-menu.png') })

  await page.getByRole('button', { name: /巷战/ }).click()
  await page.getByText('加入房间').first().waitFor({ timeout: 10_000 })

  await page.locator('#host-address').fill(`127.0.0.1:${PROXY_PORT}`)
  await page.locator('#room-code').fill(ROOM_CODE)
  await page.getByRole('button', { name: '加入', exact: true }).click()

  await page.getByText(`房间 ${ROOM_CODE}`).first().waitFor({ timeout: 10_000 })
  await page.getByText('Bot Alpha').first().waitFor({ timeout: 10_000 })
  await page.screenshot({ path: join(ARTIFACTS, '02-lobby.png') })

  // Enrollment modal: camera should open, then close without saving.
  await page.getByRole('button', { name: /建档/ }).first().click()
  await page.getByText('人脸与衣着建档').waitFor({ timeout: 10_000 })
  await page.waitForFunction(
    () => {
      const video = document.querySelector('.enroll-camera video')
      return video instanceof HTMLVideoElement && video.readyState >= 2 && video.videoWidth > 0
    },
    { timeout: 20_000 }
  )
  await page.screenshot({ path: join(ARTIFACTS, '03-enrollment.png') })
  await page.getByRole('button', { name: '关闭' }).click()
  await page.getByText('赛前建档').waitFor({ timeout: 10_000 })

  // Start the match from the mock host.
  startMatch()

  await page.getByText('比赛开始').waitFor({ timeout: 10_000 })
  const trigger = page.locator('[aria-label^="开火"]')
  await trigger.waitFor({ timeout: 20_000 })
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[aria-label^="开火"]')
      return button instanceof HTMLButtonElement && !button.disabled
    },
    { timeout: 20_000 }
  )
  await page.waitForFunction(
    () => {
      const video = document.querySelector('.battle-root video')
      return video instanceof HTMLVideoElement && video.readyState >= 2 && video.videoWidth > 0
    },
    { timeout: 20_000 }
  )

  await page.screenshot({ path: join(ARTIFACTS, '04a-battle-rifle.png') })

  const target = page.locator('[data-target-id="bot-alpha"]')
  await target.waitFor({ timeout: 10_000 })
  await target.click()
  await trigger.click()

  await waitForNode(() => shots.length > 0, 12_000, 'shot message')
  assert.equal(shots[0], 'bot-alpha', 'manual target should be sent to the server')

  // Rifle -> pistol: the HUD changes and a tap still sends one shot.
  const weaponButton = page.locator('[aria-label^="切换武器"]')
  await weaponButton.click()
  await page.getByText('手枪 · 单发').waitFor({ timeout: 5_000 })
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[aria-label^="开火"]')
      return button instanceof HTMLButtonElement && !button.disabled
    },
    { timeout: 5_000 }
  )
  await wait(500)
  await page.screenshot({ path: join(ARTIFACTS, '04b-battle-pistol.png') })
  const beforePistol = shots.length
  await trigger.click()
  await waitForNode(
    () => shots.length > beforePistol,
    12_000,
    'pistol shot'
  )
  assert.equal(shots.at(-1), 'bot-alpha', 'pistol shot should keep the manual target')
  await page.screenshot({ path: join(ARTIFACTS, '04c-battle-pistol-fired.png') })

  // Pistol -> rifle, then hold the trigger: full-auto must send a burst.
  await weaponButton.click()
  await page.getByText('步枪 · 连发').waitFor({ timeout: 5_000 })
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[aria-label^="开火"]')
      return button instanceof HTMLButtonElement && !button.disabled
    },
    { timeout: 5_000 }
  )
  await wait(500)
  const beforeAuto = shots.length
  const triggerBox = await trigger.boundingBox()
  assert.ok(triggerBox, 'trigger should have a bounding box')
  await page.mouse.move(
    triggerBox.x + triggerBox.width / 2,
    triggerBox.y + triggerBox.height / 2
  )
  await page.mouse.down()
  await wait(2200)
  await page.mouse.up()
  await waitForNode(
    () => shots.length - beforeAuto >= 2,
    12_000,
    'automatic burst'
  )
  assert.ok(
    shots.slice(beforeAuto).every((id) => id === 'bot-alpha'),
    'every burst shot should keep the manual target'
  )
  await page.screenshot({ path: join(ARTIFACTS, '04-battle.png') })

  endMatch()
  await page.getByText('全员战绩').waitFor({ timeout: 10_000 })
  await page.getByText('等待房主返回大厅').waitFor({ timeout: 10_000 })
  await page.screenshot({ path: join(ARTIFACTS, '05-results.png') })

  await page.getByRole('button', { name: '离开房间' }).click()
  await page.getByRole('button', { name: /巷战/ }).waitFor({ timeout: 10_000 })

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`)

  console.log('\n[smoke:app] OK')
  console.log(`  target sent: ${shots[0]}`)
  console.log(`  vision logs: ${visionLogs.length ? visionLogs.join(' | ') : '(none)'}`)
  if (consoleErrors.length) {
    console.log(`  console errors (non-fatal): ${consoleErrors.join(' | ')}`)
  }
  console.log(`  screenshots: ${ARTIFACTS}`)
  console.log('')
} catch (error) {
  exitCode = 1
  console.error('\n[smoke:app] FAILED:', error)
  if (proxyOutput) console.error('\n--- proxy output ---\n' + proxyOutput)
  if (pageErrors.length) console.error('page errors:', pageErrors)
  if (consoleErrors.length) console.error('console errors:', consoleErrors)
  if (visionLogs.length) console.error('vision logs:', visionLogs)
} finally {
  if (browser) await browser.close().catch(() => undefined)
  cleanup()
  await wait(200)
}

process.exit(exitCode)
