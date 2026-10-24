/**
 * Target selector — vertical slide panel on the left edge of the screen.
 *
 * Shows enemy players.  Swipe up/down to scroll, tap or release to confirm
 * selection.  Collapsible: tap the edge handle to expand/collapse.
 */

import { useCallback, useRef, useState } from 'react'
import type { PlayerPublic } from '@shared/types'

interface Props {
  enemies: PlayerPublic[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function TargetSelector({ enemies, selectedId, onSelect }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const scrollStartRef = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    scrollStartRef.current = scrollRef.current?.scrollTop ?? 0
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!scrollRef.current) return
    const dy = startYRef.current - e.touches[0].clientY
    scrollRef.current.scrollTop = scrollStartRef.current + dy
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(selectedId === id ? null : id)
    },
    [selectedId, onSelect]
  )

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  if (enemies.length === 0 && !expanded) {
    return <ExpandHandle expanded={expanded} onClick={handleToggle} />
  }

  return (
    <>
      <ExpandHandle expanded={expanded} onClick={handleToggle} />
      {expanded && (
        <div
          style={styles.container}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          <div style={styles.title}>目标</div>
          {enemies.length === 0 ? (
            <div style={styles.empty}>未检测到敌人</div>
          ) : (
            <div ref={scrollRef} style={styles.list}>
              {enemies.map((p) => {
                const isSelected = selectedId === p.id
                return (
                  <button
                    key={p.id}
                    style={{
                      ...styles.item,
                      background: isSelected ? 'var(--accent-dim)' : 'transparent',
                      borderColor: isSelected ? 'var(--accent)' : 'transparent'
                    }}
                    onClick={() => handleSelect(p.id)}
                  >
                    <span style={{
                      ...styles.teamDot,
                      background: p.team === 'red' ? 'var(--red)' : 'var(--blue)'
                    }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
                    {p.alive ? (
                      <span style={{ fontSize: 11, color: 'var(--success)' }}>●</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--error)' }}>○</span>
                    )}
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

function ExpandHandle({ expanded, onClick }: { expanded: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      style={{
        position: 'fixed',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 16,
        height: 48,
        background: 'rgba(255,255,255,0.08)',
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 400,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        border: 'none'
      }}
      onClick={onClick}
      aria-label={expanded ? '收起目标面板' : '展开目标面板'}
    >
      <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {expanded ? <path d="M2 1l5 5-5 5" /> : <path d="M6 1L1 6l5 5" />}
      </svg>
    </button>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    left: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'var(--bg-panel)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: '8px 0',
    zIndex: 450,
    minWidth: 140,
    maxWidth: 180
  },
  title: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    padding: '0 10px 6px',
    borderBottom: '1px solid rgba(255,255,255,0.04)'
  },
  list: {
    maxHeight: 200,
    overflowY: 'auto',
    padding: '4px 0'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    width: '100%',
    borderRadius: 4,
    transition: 'background 0.1s'
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: 8,
    flexShrink: 0
  },
  empty: {
    padding: '12px 10px',
    fontSize: 12,
    opacity: 0.4,
    textAlign: 'center' as const
  }
}
