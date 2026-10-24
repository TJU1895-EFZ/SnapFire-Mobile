import { useEffect, useRef, useState } from 'react'
import type { RoomPublicState } from '@shared/types'

/**
 * Keeps an estimate of the host's clock. All countdown / respawn / match-end
 * timestamps are produced by the host, so clients must not compare them with
 * their own wall clock directly.
 */
export function useServerClock(room: RoomPublicState | null): number {
  const offsetRef = useRef(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (room) offsetRef.current = room.serverNow - Date.now()
  }, [room])

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 150)
    return () => window.clearInterval(handle)
  }, [])

  return now + offsetRef.current
}
