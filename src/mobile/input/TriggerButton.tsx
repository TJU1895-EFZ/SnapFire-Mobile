/**
 * Virtual trigger — bottom-right corner.
 *
 * Reports press and release separately so the battle screen can run a
 * full-auto burst (rifle) or a single shot (pistol). Pointer capture keeps a
 * finger that slides off the button from leaving the burst running.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FireMode } from '@mobile/game/weapons'

interface Props {
  onPressStart: () => void
  onPressEnd: () => void
  mode: FireMode
  disabled?: boolean
}

const SIZE = 76

export function TriggerButton({
  onPressStart,
  onPressEnd,
  mode,
  disabled
}: Props): React.JSX.Element {
  const [pressed, setPressed] = useState(false)
  const activePointerRef = useRef<number | null>(null)

  const handleDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      if (disabled || activePointerRef.current !== null) return
      activePointerRef.current = event.pointerId
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Pointer capture is best-effort; pointerup still ends the burst.
      }
      setPressed(true)
      onPressStart()
    },
    [disabled, onPressStart]
  )

  const handleUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      if (
        activePointerRef.current !== null &&
        event.pointerId !== activePointerRef.current
      ) {
        return
      }
      activePointerRef.current = null
      setPressed(false)
      onPressEnd()
    },
    [onPressEnd]
  )

  // Death, phase changes and weapon switches disable the trigger from outside.
  useEffect(() => {
    if (disabled && activePointerRef.current !== null) {
      activePointerRef.current = null
      setPressed(false)
      onPressEnd()
    }
  }, [disabled, onPressEnd])

  return (
    <button
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleUp}
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
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
      aria-label={mode === 'auto' ? '开火（按住连发）' : '开火'}
    >
      <svg
        width="28"
        height="28"
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
      <span
        style={{
          fontSize: 9,
          lineHeight: 1,
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.8)'
        }}
      >
        {mode === 'auto' ? '连发' : '单发'}
      </span>
    </button>
  )
}
