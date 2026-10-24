/**
 * Touch target-selection state.
 *
 * Firing is handled by TriggerButton; this hook only keeps the manual target
 * selection shared between the selector and the battle screen.
 */

import { useCallback, useState } from 'react'

export interface TouchInputState {
  /** Selected target player ID, or `null`. */
  selectedTargetId: string | null
  /** Select/deselect a target. */
  onSelectTarget: (id: string | null) => void
}

export function useTouchInput(): TouchInputState {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)

  const onSelectTarget = useCallback((id: string | null) => {
    setSelectedTargetId(id)
  }, [])

  return { selectedTargetId, onSelectTarget }
}
