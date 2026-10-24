import { describe, expect, it } from 'vitest'
import { normalizeHostAddress } from './NetClient'

describe('normalizeHostAddress', () => {
  it('adds ws:// to a bare LAN address', () => {
    expect(normalizeHostAddress('192.168.1.20:17890', { secure: false })).toBe(
      'ws://192.168.1.20:17890'
    )
  })

  it('uses wss:// on a secure page', () => {
    expect(normalizeHostAddress('192.168.1.20:8443', { secure: true })).toBe(
      'wss://192.168.1.20:8443'
    )
  })

  it('upgrades http:// to wss:// on a secure page', () => {
    expect(normalizeHostAddress('http://192.168.1.20:8443', { secure: true })).toBe(
      'wss://192.168.1.20:8443'
    )
  })

  it('converts https:// to wss://', () => {
    expect(normalizeHostAddress('https://snapfire.local:8443/room?x=1#y')).toBe(
      'wss://snapfire.local:8443'
    )
  })

  it('strips a trailing slash and path from ws:// URLs', () => {
    expect(normalizeHostAddress('ws://192.168.1.20:17890/')).toBe(
      'ws://192.168.1.20:17890'
    )
  })

  it('defaults to the desktop port in an insecure context', () => {
    expect(normalizeHostAddress('192.168.1.20', { secure: false })).toBe(
      'ws://192.168.1.20:17890'
    )
  })

  it('defaults to 443 in a secure context without an explicit port', () => {
    // URL serialisation omits the default wss port (443).
    expect(normalizeHostAddress('192.168.1.20', { secure: true })).toBe(
      'wss://192.168.1.20'
    )
  })

  it('rejects empty input', () => {
    expect(() => normalizeHostAddress('   ')).toThrow()
  })

  it('rejects unsupported schemes', () => {
    expect(() => normalizeHostAddress('ftp://192.168.1.20')).toThrow()
  })
})
