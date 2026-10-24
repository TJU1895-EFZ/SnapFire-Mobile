import { useState } from 'react'

interface Props {
  initialAddress: string
  busy: boolean
  error: string | null
  onJoin: (address: string, code: string) => void
  onBack: () => void
}

export function RoomEntryScreen({
  initialAddress,
  busy,
  error,
  onJoin,
  onBack
}: Props): React.JSX.Element {
  const [address, setAddress] = useState(initialAddress)
  const [code, setCode] = useState('')
  const https = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const placeholder = https ? '192.168.1.20:8443' : '192.168.1.20:17890'

  const canJoin = address.trim().length >= 3 && code.length === 4 && !busy

  const submit = (): void => {
    if (!canJoin) return
    onJoin(address.trim(), code)
  }

  return (
    <div className="screen">
      <div className="screen__inner">
        <button
          className="ghost-button"
          style={{ alignSelf: 'flex-start' }}
          onClick={onBack}
          disabled={busy}
        >
          ← 返回
        </button>

        <h2 className="screen__heading">加入房间</h2>

        <div className="notice notice--info">
          先在桌面版创建房间，然后用手机连接同一 Wi-Fi。
          {initialAddress ? ' 当前页面已预填房主地址。' : ''}
        </div>

        <section className="card">
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="field-label" htmlFor="host-address">
                房主地址
              </label>
              {typeof window !== 'undefined' && window.location.protocol === 'https:' && (
                <button
                  className="ghost-button tiny"
                  style={{ minHeight: 24, padding: '0 4px' }}
                  onClick={() => setAddress(window.location.host)}
                >
                  使用当前页面地址
                </button>
              )}
            </div>
            <input
              id="host-address"
              style={{ width: '100%' }}
              placeholder={placeholder}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field-label" htmlFor="room-code">
              房间号（4 位）
            </label>
            <input
              id="room-code"
              style={{
                width: '100%',
                textAlign: 'center',
                letterSpacing: 10,
                fontSize: 22,
                fontVariantNumeric: 'tabular-nums'
              }}
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
            />
          </div>

          {error && (
            <div className="notice notice--error" style={{ marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button
            className="primary-button"
            style={{ width: '100%', minHeight: 50 }}
            disabled={!canJoin}
            onClick={submit}
          >
            {busy ? '连接中…' : '加入'}
          </button>
        </section>

        <p className="tiny muted">
          连接失败请检查：手机与电脑是否同一局域网、房主地址/端口是否正确、
          Windows 防火墙是否放行。使用局域网代理时，直接填写当前页面地址即可。
        </p>
      </div>
    </div>
  )
}
