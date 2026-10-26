import type { CombatMode, MatchResult } from '@shared/types'
import { formatPercent } from '@mobile/utils/format'
import { teamLabel } from '@mobile/utils/teamLabels'

interface Props {
  result: MatchResult
  selfId: string
  isHost: boolean
  mode: CombatMode
  onReturnLobby: () => void
  onLeave: () => void
}

export function ResultsScreen({
  result,
  selfId,
  isHost,
  mode,
  onReturnLobby,
  onLeave
}: Props): React.JSX.Element {
  const self = result.players.find((player) => player.id === selfId) ?? null
  const winnerLabel =
    result.winner === 'draw'
      ? '平局'
      : `${teamLabel(result.winner, mode)}获胜`
  const winnerColor =
    result.winner === 'red'
      ? 'var(--red)'
      : result.winner === 'blue'
        ? 'var(--blue)'
        : 'var(--text-secondary)'

  return (
    <div className="screen">
      <div className="screen__inner">
        <h2 className="screen__heading center" style={{ color: winnerColor }}>
          {winnerLabel}
        </h2>

        <div className="card center" style={{ padding: '18px 16px' }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.06em'
            }}
          >
            <span style={{ color: 'var(--red)' }}>{result.score.red}</span>
            <span style={{ opacity: 0.3, margin: '0 10px' }}>:</span>
            <span style={{ color: 'var(--blue)' }}>{result.score.blue}</span>
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            {teamLabel('red', mode)} {result.score.red} : {result.score.blue}{' '}
            {teamLabel('blue', mode)}
          </div>
          <div className="tiny muted">
            {result.durationMin} 分钟 · {result.killLimit} 杀上限
          </div>
        </div>

        {self && (
          <section className="card">
            <h3 className="card__title">你的战绩</h3>
            <div className="stat-grid">
              <Tile label="击杀" value={String(self.kills)} />
              <Tile label="死亡" value={String(self.deaths)} />
              <Tile label="命中率" value={formatPercent(self.accuracy)} />
              <Tile label="命中 / 射击" value={`${self.hits} / ${self.shots}`} />
            </div>
          </section>
        )}

        <section className="card">
          <h3 className="card__title">全员战绩</h3>
          {result.players.map((player) => (
            <div key={player.id} className="player-row">
              <span className={`team-dot team-dot--${player.team}`} />
              <span className="grow truncate">
                {player.name}
                {player.id === selfId ? '（你）' : ''}
              </span>
              <span className="tiny muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {player.kills}/{player.deaths} · {formatPercent(player.accuracy)}
              </span>
            </div>
          ))}
        </section>

        {isHost ? (
          <button
            className="primary-button"
            style={{ width: '100%', minHeight: 50 }}
            onClick={onReturnLobby}
          >
            返回大厅
          </button>
        ) : (
          <div className="notice notice--info center">
            等待房主返回大厅…
          </div>
        )}

        <button className="ghost-button" onClick={onLeave}>
          离开房间
        </button>
      </div>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="stat-tile">
      <div className="stat-tile__value">{value}</div>
      <div className="stat-tile__label">{label}</div>
    </div>
  )
}
