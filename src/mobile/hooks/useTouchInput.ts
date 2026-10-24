/**
 * Touch input hook — aggregates firing and target selection state.
 *
 * Used by the battle screen to decouple gesture handling from game logic.
 */

import { useCallback, useRef, useState } from 'react'

export interface TouchInputState {
  /** Whether the trigger button is currently pressed. */
  isFiring: boolean
  /** Selected target player ID, or `null`. */
  selectedTargetId: string | null
  /** Callback to fire the weapon. */
  onFire: () => void
  /** Callback to select/deselect a target. */
  onSelectTarget: (id: string | null) => void
}

/**
 * Manages the virtual trigger and target selector state.
 * The battle screen passes callbacks that fire side-effects (network send,
 * vision analysis, etc.).
 */
export function useTouchInput(): TouchInputState {
  const [isFiring, setIsFiring] = useState(false)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)

  const onFire = useCallback(() => {
    setIsFiring(true)
    // Brief pulse so the button can animate.
    setTimeout(() => setIsFiring(false), 80)
  }, [])

  const onSelectTarget = useCallback((id: string | null) => {
    setSelectedTargetId(id)
  }, [])

  return {
    isFiring,
    selectedTargetId,
    onFire,
    onSelectTarget
  }
}
