#!/usr/bin/env node
/**
 * Generates the HTTPS certificate used by scripts/lan-proxy.mjs.
 *
 * Preferred: mkcert (https://github.com/FiloSottile/mkcert).  mkcert creates
 * a local CA that can be installed once on each phone, so the browser trusts
 * the LAN certificate without warnings.
 *
 * Fallback: --self-signed uses OpenSSL.  It works for desktop testing, but a
 * phone must install the generated certificate as a trusted CA manually.
 *
 * Usage:
 *   npm run lan:cert
 *   npm run lan:cert:selfsigned
 *   node scripts/make-certs.mjs --force
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'

const ROOT_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CERT_DIR = join(ROOT_DIR, 'certs')
const CERT_FILE = join(CERT_DIR, 'lan-cert.pem')
const KEY_FILE = join(CERT_DIR, 'lan-key.pem')

const args = new Set(process.argv.slice(2))
const force = args.has('--force')
const selfSigned = args.has('--self-signed')

function lanAddresses() {
  const result = []
  const interfaces = networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      if (entry.address.startsWith('198.18.')) continue
      if (entry.address.startsWith('169.254.')) continue
      result.push(entry.address)
    }
  }
  return [...new Set(result)]
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    stdio: 'inherit',
    cwd: ROOT_DIR,
    ...options
  })
}

function hasMkcert() {
  const result = spawnSync('mkcert', ['-version'], { stdio: 'ignore' })
  return result.status === 0
}

function main() {
  mkdirSync(CERT_DIR, { recursive: true })

  if (existsSync(CERT_FILE) && existsSync(KEY_FILE) && !force) {
    console.log(`\n[cert] 证书已存在：\n  ${CERT_FILE}\n  ${KEY_FILE}\n`)
    console.log('      如需重新生成，请加 --force。\n')
    return
  }

  const addresses = lanAddresses()
  const hosts = ['localhost', '127.0.0.1', '::1', ...addresses]

  if (!selfSigned && hasMkcert()) {
    console.log('\n[cert] 使用 mkcert 生成局域网证书…')
    const result = run('mkcert', [
      '-cert-file',
      CERT_FILE,
      '-key-file',
      KEY_FILE,
      ...hosts
    ])
    if (result.status !== 0) process.exit(result.status ?? 1)

    const caRoot = spawnSync('mkcert', ['-CAROOT'], { encoding: 'utf8' })
    const caPath = (caRoot.stdout || '').trim()
    console.log('\n[cert] 完成。')
    if (caPath) {
      console.log(`\n  mkcert 根证书：${join(caPath, 'rootCA.pem')}`)
      console.log('  手机首次使用前，需要把 rootCA.pem 安装为受信任的 CA：')
      console.log('    Android: 设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书')
      console.log('             （部分机型还需在“信任的凭据 → 用户”中启用）')
      console.log('    iOS: 设置 → 通用 → VPN与设备管理 安装描述文件，')
      console.log('         再到 设置 → 通用 → 关于本机 → 证书信任设置 中启用完全信任')
    }
    console.log(
      '\n  如果只想让本机浏览器信任，可运行：mkcert -install\n'
    )
    return
  }

  if (!selfSigned) {
    console.error(
      '\n[cert] 未找到 mkcert。\n\n' +
        '  推荐安装 mkcert 后再运行：\n' +
        '    Windows: winget install FiloSottile.mkcert\n' +
        '    macOS:   brew install mkcert\n' +
        '    Linux:   见 https://github.com/FiloSottile/mkcert\n\n' +
        '  或者临时生成自签名证书（手机需要手动信任）：\n' +
        '    npm run lan:cert:selfsigned\n'
    )
    process.exit(1)
  }

  const openssl = spawnSync('openssl', ['version'], { stdio: 'ignore' })
  if (openssl.status !== 0) {
    console.error('\n[cert] 未找到 openssl，无法生成自签名证书。\n')
    process.exit(1)
  }

  const san = [
    'DNS:localhost',
    'IP:127.0.0.1',
    ...addresses.map((address) => `IP:${address}`)
  ].join(',')

  console.log('\n[cert] 使用 OpenSSL 生成自签名证书（仅建议调试用）…')
  const result = run('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-days',
    '365',
    '-nodes',
    '-keyout',
    KEY_FILE,
    '-out',
    CERT_FILE,
    '-subj',
    '/CN=SnapFire LAN',
    '-addext',
    `subjectAltName=${san}`
  ])
  if (result.status !== 0) process.exit(result.status ?? 1)

  console.log('\n[cert] 完成（自签名）。')
  console.log('  手机需要安装并信任这个证书：')
  console.log(`    ${CERT_FILE}`)
  console.log(
    '  iOS/Android 对自签名证书较严格，正式使用仍建议安装 mkcert 后重新生成。\n'
  )
}

main()
