import { useMemo, useState } from 'react'
import type { HistoryData, ProfileData } from '@shared/types'
import { formatPercent } from '@mobile/utils/format'
import { computePlayerStats } from '@mobile/utils/stats'

interface Props {
  profile: ProfileData
  history: HistoryData
  onCombat: () => void
  onSettings: () => void
  onHistory: () => void
  onNameChange: (name: string) => Promise<void> | void
}

export function HomeScreen({
  profile,
  history,
  onCombat,
  onSettings,
  onHistory,
  onNameChange
}: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const stats = useMemo(
    () => computePlayerStats(history.matches, profile.id),
    [history.matches, profile.id]
  )

  const save = async (): Promise<void> => {
    const clean = name.trim().slice(0, 16)
    if (!clean) {
      setError('昵称不能为空')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onNameChange(clean)
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存昵称失败')
    } finally {
      setSaving(false)
    }
  }

  const cancel = (): void => {
    setName(profile.name)
    setError(null)
    setEditing(false)
  }

  return (
    <div className="screen">
      <div className="screen__inner">
        <header className="screen__header">
          <div>
            <h1 className="screen__title">SNAPFIRE</h1>
            <p className="screen__subtitle">Mobile · Mixed Reality Combat</p>
          </div>
          <span className="pill pill--warning">LAN</span>
        </header>

        <section className="card">
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={name}
                  maxLength={16}
                  onChange={(event) => setName(event.target.value)}
                  style={{ flex: 1 }}
                  autoFocus
                  aria-label="昵称"
                />
                <button
                  className="primary-button"
                  onClick={() => void save()}
                  disabled={saving}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
                <button className="ghost-button" onClick={cancel} disabled={saving}>
                  取消
                </button>
              </div>
              {error && <div className="notice notice--error">{error}</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="avatar">
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="grow">
                <div style={{ fontSize: 18, fontWeight: 600 }} className="truncate">
                  {profile.name}
                </div>
                <div className="tiny muted">本地身份 · 无需登录</div>
              </div>
              <button
                className="ghost-button"
                onClick={() => {
                  setName(profile.name)
                  setEditing(true)
                }}
              >
                编辑
              </button>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card__title">战绩总览</h2>
          <div className="stat-grid">
            <StatTile label="总场次" value={String(stats.matches)} />
            <StatTile label="胜率" value={formatPercent(stats.winRate)} />
            <StatTile label="击杀" value={String(stats.kills)} />
            <StatTile label="死亡" value={String(stats.deaths)} />
            <StatTile label="命中率" value={formatPercent(stats.accuracy)} />
            <StatTile label="命中 / 射击" value={`${stats.hits} / ${stats.shots}`} />
          </div>
        </section>

        <button
          className="primary-button"
          style={{ width: '100%', minHeight: 56, fontSize: 18, marginTop: 4 }}
          onClick={onCombat}
        >
          团战 · 加入局域网房间
        </button>

        <div className="button-row">
          <button
            className="secondary-button grow"
            style={{ padding: '12px 0' }}
            onClick={onHistory}
          >
            战绩
          </button>
          <button
            className="secondary-button grow"
            style={{ padding: '12px 0' }}
            onClick={onSettings}
          >
            设置
          </button>
        </div>

        <p className="tiny muted center" style={{ marginTop: 4 }}>
          手机端只加入房间，创建房间请在桌面版完成。
        </p>
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="stat-tile">
      <div className="stat-tile__value">{value}</div>
      <div className="stat-tile__label">{label}</div>
    </div>
  )
}
