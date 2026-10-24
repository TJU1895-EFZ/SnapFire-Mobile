/**
 * History modal — shows past match results from IndexedDB.
 */

import { useMemo, useState } from 'react'
import { formatClock, formatDateTime, formatPercent } from '@mobile/utils/format'
import { computePlayerStats } from '@mobile/utils/stats'
import type { MatchResult } from '@shared/types'

interface Props {
  matches: MatchResult[]
  selfId: string
  onClose: () => void
}

export function HistoryModal({ matches, selfId, onClose }: Props): React.JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const stats = useMemo(
    () => computePlayerStats(matches, selfId),
    [matches, selfId]
  )

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>战绩</h2>
          <button className="ghost-button" onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>

        {/* Summary */}
        <div style={styles.summary}>
          <div style={styles.stat}>
            <div style={styles.statValue}>{stats.matches}</div>
            <div style={styles.statLabel}>总场次</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>{stats.wins}</div>
            <div style={styles.statLabel}>胜场</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>{stats.kills}</div>
            <div style={styles.statLabel}>击杀</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>{formatPercent(stats.accuracy, 0)}</div>
            <div style={styles.statLabel}>命中率</div>
          </div>
        </div>

        {/* Match list */}
        <div style={styles.list}>
          {matches.length === 0 && (
            <div style={styles.empty}>暂无比赛记录</div>
          )}
          {matches.map((m) => {
            const isExpanded = expandedId === m.matchId
            return (
              <div key={m.matchId}>
                <div style={styles.matchRow} onClick={() => setExpandedId(isExpanded ? null : m.matchId)}>
                  <span style={{
                    ...styles.winnerBadge,
                    background: m.winner === 'red' ? 'var(--red)' : m.winner === 'blue' ? 'var(--blue)' : 'var(--team-neutral)'
                  }}>
                    {m.winner === 'red' ? '红' : m.winner === 'blue' ? '蓝' : '平'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.matchScore}>
                      <span style={{ color: 'var(--red)' }}>{m.score.red}</span>
                      <span style={{ opacity: 0.3 }}> : </span>
                      <span style={{ color: 'var(--blue)' }}>{m.score.blue}</span>
                    </div>
                    <div style={styles.matchMeta}>
                      {formatDateTime(m.startedAt)} · {formatClock(m.durationMin * 60 * 1000)}
                    </div>
                  </div>
                  <span style={{ opacity: 0.4 }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
                {isExpanded && (
                  <div style={styles.expanded}>
                    {m.players.map((p) => (
                      <div key={p.id} style={styles.playerStat}>
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: p.team === 'red' ? 'var(--red)' : 'var(--blue)',
                          flexShrink: 0
                        }} />
                        <span style={{ flex: 1, fontSize: 13 }}>
                          {p.name}
                          {p.id === selfId ? '（你）' : ''}
                        </span>
                        <span style={{ fontSize: 12 }}>
                          {p.kills}杀 / {p.deaths}死 / {formatPercent(p.accuracy, 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'var(--bg-secondary)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    width: '100%',
    maxWidth: 480,
    maxHeight: '86dvh',
    overflow: 'auto',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom))'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--bg-secondary)',
    zIndex: 1
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0
  },
  closeBtn: {
    fontSize: 18,
    padding: 4
  },
  summary: {
    display: 'flex',
    gap: 0,
    padding: '16px'
  },
  stat: {
    flex: 1,
    textAlign: 'center' as const,
    borderRight: '1px solid rgba(255,255,255,0.06)'
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--accent)'
  },
  statLabel: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    marginTop: 2
  },
  list: {
    padding: '0 16px'
  },
  empty: {
    textAlign: 'center' as const,
    padding: '32px 0',
    opacity: 0.4,
    fontSize: 14
  },
  matchRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer'
  },
  winnerBadge: {
    width: 24,
    height: 24,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    marginRight: 10,
    flexShrink: 0
  },
  matchScore: {
    fontSize: 18,
    fontWeight: 600
  },
  matchMeta: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: 2
  },
  expanded: {
    padding: '8px 0 12px'
  },
  playerStat: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 0',
    gap: 8
  }
}
