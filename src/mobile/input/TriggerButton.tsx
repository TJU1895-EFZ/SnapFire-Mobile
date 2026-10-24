/**
 * Virtual trigger — bottom-right corner.
 *
 * Fires once per press.  Pointer events cover both touch and mouse, and the
 * button sits inside the safe area on notched phones.
 */

import { useCallback, useState } from 'react'

interface Props {
  onFire: () => void
  disabled?: boolean
}

const SIZE = 76

export function TriggerButton({ onFire, disabled }: Props): React.JSX.Element {
  const [pressed, setPressed] = useState(false)

  const handleDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      if (disabled) return
      setPressed(true)
      onFire()
    },
    [disabled, onFire]
  )

  const handleUp = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    setPressed(false)
  }, [])

  return (
    <button
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onPointerLeave={() => setPressed(false)}
      onContextMenu={(event) => event.preventDefault()}
      disabled={disabled}
      style={{
        position: 'fixed',
        right: 'max(20px, env(safe-area-inset-right))',
        bottom: 'max(20px, env(safe-area-inset-bottom))',
        width: SIZE,
        height: SIZE,
        zIndex: 500,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: pressed ? 'rgba(240,160,48,0.9)' : 'rgba(240,160,48,0.32)',
        border: `2px solid ${pressed ? '#fff' : 'rgba(240,160,48,0.65)'}`,
        boxShadow: pressed
          ? '0 0 22px rgba(240,160,48,0.65)'
          : '0 0 14px rgba(240,160,48,0.18)',
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.07s ease, background 0.07s ease',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        pointerEvents: disabled ? 'none' : 'auto',
        opacity: disabled ? 0.35 : 1
      }}
      aria-label="开火"
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ opacity: pressed ? 1 : 0.85 }}
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        <circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none" />
      </svg>
    </button>
  )
}
