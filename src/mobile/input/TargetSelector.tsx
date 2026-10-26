/**
 * Target selector — vertical panel on the left edge.
 *
 * Swipe up/down over the list and release to select the player under the
 * finger (tap also works).  Tapping the selected player again clears the
 * selection.  The panel collapses to a slim handle.
 */

import { useCallback, useRef, useState } from 'react'
import type { CombatMode, PlayerPublic } from '@shared/types'
import { teamShortLabel } from '@mobile/utils/teamLabels'

interface Props {
  players: PlayerPublic[]
  selectedId: string | null
  mode: CombatMode
  onSelect: (id: string | null) => void
}

export function TargetSelector({
  players,
  selectedId,
  mode,
  onSelect
}: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const suppressClickRef = useRef(false)

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0]
    startRef.current = { x: touch.clientX, y: touch.clientY }
    draggingRef.current = false
    setHoverId(null)
  }, [])

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const start = startRef.current
    if (!start) return
    const touch = event.touches[0]
    if (
      !draggingRef.current &&
      Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8
    ) {
      draggingRef.current = true
    }
    if (!draggingRef.current) return

    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    const item = element?.closest<HTMLElement>('[data-target-id]')
    setHoverId(item?.dataset.targetId ?? null)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (draggingRef.current) {
      suppressClickRef.current = true
      // If the browser does not emit a click after the drag, clear the flag
      // so the next deliberate tap is not swallowed.
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 60)
      if (hoverId) onSelect(hoverId === selectedId ? null : hoverId)
    }
    startRef.current = null
    draggingRef.current = false
    setHoverId(null)
  }, [hoverId, onSelect, selectedId])

  const toggle = useCallback(
    (id: string) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      onSelect(id === selectedId ? null : id)
    },
    [onSelect, selectedId]
  )

  return (
    <>
      <button
        style={styles.handle}
        onClick={() => setExpanded((value) => !value)}
        aria-label={expanded ? '收起目标面板' : '展开目标面板'}
      >
        <svg
          width="8"
          height="12"
          viewBox="0 0 8 12"
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {expanded ? <path d="M2 1l5 5-5 5" /> : <path d="M6 1L1 6l5 5" />}
        </svg>
      </button>

      {expanded && (
        <div
          style={styles.container}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div style={styles.title}>目标 · 滑动选择</div>
          {players.length === 0 ? (
            <div style={styles.empty}>暂无玩家</div>
          ) : (
            <div style={styles.list}>
              {players.map((player) => {
                const selected = selectedId === player.id
                const hovered = hoverId === player.id
                return (
                  <button
                    key={player.id}
                    data-target-id={player.id}
                    style={{
                      ...styles.item,
                      background: selected
                        ? 'var(--accent-dim)'
                        : hovered
                          ? 'rgba(255,255,255,0.1)'
                          : 'transparent',
                      borderColor: selected ? 'var(--accent)' : 'transparent',
                      opacity: player.connected ? 1 : 0.45
                    }}
                    onClick={() => toggle(player.id)}
                  >
                    <span
                      className={`team-dot team-dot--${
                        player.team === 'red'
                          ? 'red'
                          : player.team === 'blue'
                            ? 'blue'
                            : 'none'
                      }`}
                    />
                    <span className="grow truncate" style={{ fontSize: 13 }}>
                      {player.name}
                    </span>
                    <span
                      className="tiny"
                      style={{
                        color:
                          player.team === 'red'
                            ? 'var(--red)'
                            : player.team === 'blue'
                              ? 'var(--blue)'
                              : 'var(--text-secondary)'
                      }}
                    >
                      {player.team ? teamShortLabel(player.team, mode) : '—'}
                    </span>
                    <span
                      className="tiny"
                      style={{ color: player.alive ? 'var(--success)' : 'var(--error)' }}
                    >
                      {player.alive ? '●' : '○'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  handle: {
    position: 'fixed',
    left: 'env(safe-area-inset-left)',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 18,
    height: 52,
    zIndex: 460,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.45)',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    borderLeft: 'none',
    touchAction: 'none',
    WebkitTapHighlightColor: 'transparent'
  },
  container: {
    position: 'fixed',
    left: 'calc(18px + env(safe-area-inset-left))',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 450,
    width: 172,
    maxWidth: '46vw',
    padding: '8px 0',
    borderRadius: 8,
    background: 'rgba(17,21,24,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(6px)',
    touchAction: 'none'
  },
  title: {
    padding: '0 10px 6px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontSize: 10,
    letterSpacing: '0.08em',
    color: 'var(--text-secondary)'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 4
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    minHeight: 36,
    padding: '7px 9px',
    border: '1px solid transparent',
    borderRadius: 5,
    textAlign: 'left',
    touchAction: 'none'
  },
  empty: {
    padding: '12px 10px',
    fontSize: 12,
    opacity: 0.45,
    textAlign: 'center'
  }
}
