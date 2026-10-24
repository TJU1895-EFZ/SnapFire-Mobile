import { useEffect } from 'react'
import type { AppearanceData, RoomPublicState, Team } from '@shared/types'

interface Props {
  room: RoomPublicState
  selfId: string
  isHost: boolean
  appearance: AppearanceData | null
  onEnroll: () => void
  onSyncAppearance: () => void
  onReady: (ready: boolean) => void
  onTeam: (team: Team) => void
  onLeave: () => void
}

export function LobbyScreen({
  room,
  selfId,
  isHost,
  appearance,
  onEnroll,
  onSyncAppearance,
  onReady,
  onTeam,
  onLeave
}: Props): React.JSX.Element {
  const self = room.players.find((player) => player.id === selfId) ?? null
  const connected = room.players.filter((player) => player.connected)
  const redCount = connected.filter((player) => player.team === 'red').length
  const blueCount = connected.filter((player) => player.team === 'blue').length
  const teamsReady = redCount > 0 && blueCount > 0
  const allEnrolled = connected.length > 0 && connected.every((player) => player.appearanceReady)
  const allReady =
    connected.length > 0 &&
    connected.every((player) => player.isHost || player.ready)
  const canStart = teamsReady && allEnrolled && allReady && connected.length >= 2

  // Warm the detection models up while players are waiting.  The dynamic
  // import keeps Human out of the initial bundle.
  useEffect(() => {
    let cancelled = false
    void import('@mobile/vision/human')
      .then((module) => {
        if (!cancelled) void module.warmupHuman()
      })
      .catch((error) => console.warn('[lobby] model preload failed', error))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="screen">
      <div className="screen__inner">
        <header className="screen__header">
          <div>
            <h2 className="screen__heading">房间 {room.roomCode}</h2>
            <p className="tiny muted">
              红 {redCount} / 蓝 {blueCount} · 最多 3v3
            </p>
          </div>
          <button className="ghost-button" onClick={onLeave}>
            离开
          </button>
        </header>

        <section className="card">
          <h3 className="card__title">玩家列表</h3>
          {room.players.length === 0 && (
            <p className="tiny muted">等待玩家加入…</p>
          )}
          {room.players.map((player) => (
            <div
              key={player.id}
              className={`player-row${player.connected ? '' : ' player-row--offline'}`}
            >
              <span
                className={`team-dot team-dot--${
                  player.team === 'red' ? 'red' : player.team === 'blue' ? 'blue' : 'none'
                }`}
              />
              <span className="grow truncate">
                {player.name}
                {player.id === selfId ? '（你）' : ''}
              </span>
              {player.isHost && <span className="pill pill--warning">房主</span>}
              <span className={`pill ${player.appearanceReady ? 'pill--success' : 'pill--error'}`}>
                {player.appearanceReady ? '已建档' : '未建档'}
              </span>
              <span
                className={`pill ${
                  !player.connected
                    ? 'pill--error'
                    : player.ready || player.isHost
                      ? 'pill--success'
                      : ''
                }`}
              >
                {!player.connected
                  ? '离线'
                  : player.isHost
                    ? '房主'
                    : player.ready
                      ? '已准备'
                      : '未准备'}
              </span>
            </div>
          ))}
        </section>

        {self && !self.team && (
          <section className="card">
            <h3 className="card__title">选择队伍</h3>
            <div className="button-row">
              <button
                className="secondary-button grow"
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                onClick={() => onTeam('red')}
              >
                红队
              </button>
              <button
                className="secondary-button grow"
                style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}
                onClick={() => onTeam('blue')}
              >
                蓝队
              </button>
            </div>
          </section>
        )}

        <section className="card">
          <h3 className="card__title">赛前建档</h3>
          <div className="stat-row">
            <span>本人状态</span>
            <strong style={{ color: self?.appearanceReady ? 'var(--success)' : 'var(--warning)' }}>
              {self?.appearanceReady ? '已建档' : '未建档'}
            </strong>
          </div>
          <p className="tiny muted" style={{ margin: '8px 0 12px' }}>
            建档时采集正面和背面的人脸/衣着特征。原始照片只保存在本机，房间内只同步特征。
          </p>
          <div className="button-row">
            <button className="primary-button grow" onClick={onEnroll}>
              {self?.appearanceReady || appearance ? '重新建档' : '去建档'}
            </button>
            {appearance && (
              <button className="secondary-button" onClick={onSyncAppearance}>
                同步建档
              </button>
            )}
          </div>
        </section>

        {self?.team && (
          <button
            className={self.ready ? 'secondary-button' : 'primary-button'}
            style={{ width: '100%', minHeight: 50 }}
            onClick={() => onReady(!self.ready)}
          >
            {self.ready ? '取消准备' : '准备'}
          </button>
        )}

        <section className="card">
          <h3 className="card__title">开局条件</h3>
          <ChecklistItem ok={connected.length >= 2} label="至少 2 名玩家" />
          <ChecklistItem ok={teamsReady} label="红蓝两队都至少 1 人" />
          <ChecklistItem ok={allEnrolled} label="所有玩家完成建档" />
          <ChecklistItem ok={allReady} label="非房主玩家已准备" />
          <p className="tiny muted" style={{ marginTop: 10 }}>
            {isHost
              ? canStart
                ? '条件已满足，请在桌面端点击开始比赛。'
                : '条件满足后，在桌面端点击开始比赛。'
              : canStart
                ? '等待房主开始比赛…'
                : '等待其他玩家准备/建档…'}
          </p>
        </section>

        <section className="card">
          <h3 className="card__title">比赛设置（房主决定）</h3>
          <div className="stat-row">
            <span>时长</span>
            <strong>{room.settings.durationMin} 分钟</strong>
          </div>
          <div className="stat-row">
            <span>击杀上限</span>
            <strong>{room.settings.killLimit} 杀</strong>
          </div>
        </section>
      </div>
    </div>
  )
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }): React.JSX.Element {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <strong style={{ color: ok ? 'var(--success)' : 'var(--warning)' }}>
        {ok ? '✓' : '○'}
      </strong>
    </div>
  )
}
