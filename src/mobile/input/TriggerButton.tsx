/**
 * Virtual trigger button — bottom-right corner of the screen.
 *
 * Semi-transparent circular button.  Pressing it fires the onFire callback.
 * Visual feedback: scales up and brightens on press.
 */

import { useCallback, useRef, useState } from 'react'

interface Props {
  onFire: () => void
  disabled?: boolean
}

export function TriggerButton({ onFire, disabled }: Props): React.JSX.Element {
  const [pressed, setPressed] = useState(false)
  const size = 72
  const half = size / 2

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()
      setPressed(true)
      onFire()
    },
    [onFire]
  )

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    setPressed(false)
  }, [])

  return (
    <button
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      disabled={disabled}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: size,
        height: size,
        borderRadius: '50%',
        background: pressed
          ? 'rgba(240,160,48,0.85)'
          : 'rgba(240,160,48,0.35)',
        border: `2px solid ${pressed ? '#fff' : 'rgba(240,160,48,0.6)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: pressed ? 'scale(0.9)' : 'scale(1)',
        transition: 'transform 0.08s ease, background 0.08s ease',
        zIndex: 500,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        pointerEvents: disabled ? 'none' : 'auto'
      }}
      aria-label="开火"
    >
      {/* Crosshair icon */}
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" style={{ opacity: pressed ? 1 : 0.8 }}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        <circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none" />
      </svg>
    </button>
  )
}
