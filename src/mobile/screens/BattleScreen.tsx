/**
 * Battle screen — camera feed + Three.js weapon overlay + HUD + touch input.
 *
 * Renders:
 *  1. Full-screen <video> from getUserMedia (camera feed).
 *  2. Transparent WebGL canvas for the Three.js first-person weapon.
 *  3. DOM-based HUD (score, timer, HP, lock indicator).
 *  4. Touch input (TriggerButton + TargetSelector).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { BattleScene } from '@mobile/game/BattleScene'
import { audio } from '@mobile/game/audio'
import { useCamera } from '@mobile/hooks/useCamera'
import { useServerClock } from '@mobile/hooks/useServerClock'
import { useTouchInput } from '@mobile/hooks/useTouchInput'
import { TargetSelector } from '@mobile/input/TargetSelector'
import { TriggerButton } from '@mobile/input/TriggerButton'
import { VisionEngine } from '@mobile/vision/engine'
import { warmupHuman } from '@mobile/vision/human'
import type {
  DetectionQuality,
  GalleryEntry,
  MatchPhase,
  PlayerPublic,
  RoomPublicState,
  Team
} from '@shared/types'
import {
  COUNTDOWN_MS,
  INVULNERABLE_MS,
  MAX_HP,
  RESPAWN_MS
} from '@shared/types'

// ── Types ──────────────────────────────────────────────────────────────────

interface BattleProps {
  room: RoomPublicState
  selfId: string
  gallery: GalleryEntry[]
  quality: DetectionQuality
  onLeave: () => void
  onFireShot: (targetId: string | null) => boolean
}

// ── BattleScreen ───────────────────────────────────────────────────────────

export function BattleScreen({
  room,
  selfId,
  gallery,
  quality,
  onLeave,
  onFireShot
}: BattleProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const battleSceneRef = useRef<BattleScene | null>(null)
  const visionRef = useRef<VisionEngine | null>(null)
  const qualityRef = useRef<DetectionQuality>(quality)

  const { videoRef: camVideoRef, status: camStatus, start: startCamera } = useCamera({ autoStart: false })
  const touchInput = useTouchInput()
  const serverNow = useServerClock(room)

  const [phase, setPhase] = useState<MatchPhase>(room.phase)
  const [hp, setHp] = useState(MAX_HP)
  const [alive, setAlive] = useState(true)
  const [lockState, setLockState] = useState<'none' | 'unknown' | 'enemy' | 'teammate'>('none')
  const [lockName, setLockName] = useState('')
  const [lockTeam, setLockTeam] = useState<Team | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [matchTime, setMatchTime] = useState<number | null>(null)
  const [score, setScore] = useState(room.score)
  const [killFeed, setKillFeed] = useState<string[]>([])
  const [hitFlash, setHitFlash] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const self = room.players.find((p) => p.id === selfId) ?? null
  const enemies = room.players.filter((p) => p.team !== self?.team && p.team !== null)

  // ── Init Three.js + Vision ────────────────────────────────────────────

  useEffect(() => {
    qualityRef.current = quality

    // Warmup the vision model in the background.
    warmupHuman()

    // Init Three.js scene.
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new BattleScene(canvas)
    battleSceneRef.current = scene
    scene.start()

    // Init VisionEngine.
    const vision = new VisionEngine()
    vision.setQuality(qualityRef.current)
    vision.setSession(gallery, selfId)
    visionRef.current = vision

    // Start vision on the camera video element.
    vision.onResult((result) => {
      if (result.match) {
        setLockState(result.match.team === self?.team ? 'teammate' : 'enemy')
        setLockName(result.match.name)
        setLockTeam(result.match.team)
      } else {
        setLockState('none')
        setLockName('')
        setLockTeam(null)
      }
    })

    return () => {
      vision.stop()
      scene.dispose()
    }
  }, [gallery, selfId, self?.team])

  // Update quality when settings change.
  useEffect(() => {
    visionRef.current?.setQuality(quality)
  }, [quality])

  // ── Start camera ──────────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current ?? camVideoRef.current
    if (!video) {
      // Try starting the React camera hook.
      startCamera().catch((err) => setCameraError(err.message))
      return
    }
    if (camStatus === 'ready') {
      visionRef.current?.start(video)
    } else if (camStatus === 'error') {
      setCameraError('摄像头启动失败')
    }
  }, [camStatus, startCamera, camVideoRef])

  // ── Sync game state from room ─────────────────────────────────────────

  useEffect(() => {
    setPhase(room.phase)
    setScore(room.score)
    setKillFeed(room.killFeed.map((k) => `${k.killerName} → ${k.victimName}`))
    const selfPlayer = room.players.find((p) => p.id === selfId)
    if (selfPlayer) {
      setHp(selfPlayer.hp)
      setAlive(selfPlayer.alive)
    }

    // Countdown.
    if (room.countdownEndsAt) {
      const remaining = room.countdownEndsAt - serverNow
      if (remaining > 0) {
        setCountdown(Math.ceil(remaining / 1000))
      } else {
        setCountdown(null)
      }
    } else {
      setCountdown(null)
    }

    // Match timer.
    if (room.matchEndsAt && room.phase === 'playing') {
      const remaining = room.matchEndsAt - serverNow
      setMatchTime(remaining > 0 ? remaining : 0)
    } else {
      setMatchTime(null)
    }
  }, [room, serverNow, selfId])

  // ── Handle fire ───────────────────────────────────────────────────────

  const handleFire = useCallback(() => {
    if (!alive || phase !== 'playing') return

    // Determine target from vision match or selected target.
    let targetId: string | null = null
    if (lockState === 'enemy' && lockName) {
      const enemy = room.players.find((p) => p.name === lockName && p.team !== self?.team)
      if (enemy) targetId = enemy.id
    } else if (touchInput.selectedTargetId) {
      targetId = touchInput.selectedTargetId
    }

    const sent = onFireShot(targetId)
    if (sent) {
      audio.gunshot()
      battleSceneRef.current?.fire()
    }
  }, [alive, phase, lockState, lockName, touchInput.selectedTargetId, room.players, self?.team, onFireShot])

  // ── Resize handler ────────────────────────────────────────────────────

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (canvas) {
        battleSceneRef.current?.resize(canvas.clientWidth, canvas.clientHeight)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── HP bar color ──────────────────────────────────────────────────────

  const hpColor = hp > 60 ? 'var(--success)' : hp > 30 ? 'var(--warning)' : 'var(--error)'

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      {/* Camera video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={styles.video}
      />

      {/* Three.js overlay */}
      <canvas
        ref={canvasRef}
        style={styles.canvas}
      />

      {/* Camera error overlay */}
      {cameraError && (
        <div style={styles.errorOverlay}>
          <p style={{ color: 'var(--error)', fontSize: 16, marginBottom: 12 }}>{cameraError}</p>
          <button className="primary-button" onClick={() => startCamera()}>重试</button>
        </div>
      )}

      {/* HUD */}
      {phase !== 'countdown' && !cameraError && (
        <>
          {/* Top bar: score + timer */}
          <div style={styles.hudTop}>
            <div style={styles.score}>
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>{score.red}</span>
              <span style={{ opacity: 0.3, margin: '0 6px' }}>:</span>
              <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{score.blue}</span>
            </div>
            {matchTime !== null && (
              <div style={styles.timer}>{formatClock(matchTime)}</div>
            )}
          </div>

          {/* HP bar (bottom-left) */}
          <div style={styles.hpContainer}>
            <div style={styles.hpBar}>
              <div style={{ ...styles.hpFill, width: `${(hp / MAX_HP) * 100}%`, background: hpColor }} />
            </div>
            <span style={styles.hpText}>{hp}/{MAX_HP}</span>
          </div>

          {/* Lock indicator (top-right) */}
          {lockName && (
            <div style={{
              ...styles.lockIndicator,
              color: lockState === 'enemy' ? 'var(--error)' : lockState === 'teammate' ? 'var(--blue)' : 'var(--warning)'
            }}>
              <span style={{ fontSize: 10, opacity: 0.7 }}>
                {lockState === 'enemy' ? '敌' : lockState === 'teammate' ? '友' : '?'}
              </span>
              <span style={{ fontWeight: 600 }}>{lockName}</span>
            </div>
          )}

          {/* Kill feed (center-top) */}
          {killFeed.length > 0 && (
            <div style={styles.killFeed}>
              {killFeed.slice(-2).map((msg, i) => (
                <div key={i} style={{ opacity: 0.5 + i * 0.3, fontSize: 12 }}>{msg}</div>
              ))}
            </div>
          )}

          {/* Hit flash */}
          {hitFlash && <div style={styles.hitFlash} />}
        </>
      )}

      {/* Countdown overlay */}
      {countdown !== null && countdown > 0 && (
        <div style={styles.countdownOverlay}>
          <div style={styles.countdownNumber}>{countdown}</div>
          <div style={styles.countdownText}>比赛开始</div>
        </div>
      )}

      {/* Death overlay */}
      {!alive && phase === 'playing' && (
        <div style={styles.deathOverlay}>
          <div style={styles.deathText}>阵亡</div>
          <div style={styles.deathSub}>复活中...</div>
        </div>
      )}

      {/* Touch controls */}
      {phase === 'playing' && !cameraError && (
        <>
          <TargetSelector
            enemies={enemies}
            selectedId={touchInput.selectedTargetId}
            onSelect={touchInput.onSelectTarget}
          />
          <TriggerButton onFire={handleFire} disabled={!alive} />
        </>
      )}

      {/* Leave button */}
      <button
        className="ghost-button"
        style={styles.leaveBtn}
        onClick={onLeave}
      >
        离开
      </button>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    background: '#000'
  },
  video: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%'
  },
  errorOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.8)',
    zIndex: 2000
  },
  // HUD
  hudTop: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    zIndex: 100
  },
  score: {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: 'Bahnschrift, monospace'
  },
  timer: {
    fontSize: 16,
    opacity: 0.8,
    fontFamily: 'Bahnschrift, monospace'
  },
  hpContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  hpBar: {
    width: 120,
    height: 8,
    background: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    overflow: 'hidden'
  },
  hpFill: {
    height: '100%',
    transition: 'width 0.2s ease, background 0.2s ease'
  },
  hpText: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'Bahnschrift, monospace'
  },
  lockIndicator: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(0,0,0,0.4)',
    padding: '4px 8px',
    borderRadius: 4
  },
  killFeed: {
    position: 'absolute',
    top: 50,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  hitFlash: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255,0,0,0.2)',
    zIndex: 150,
    pointerEvents: 'none'
  },
  // Overlays
  countdownOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.4)',
    zIndex: 500
  },
  countdownNumber: {
    fontSize: 80,
    fontWeight: 700,
    color: 'var(--accent)',
    fontFamily: 'Bahnschrift, monospace'
  },
  countdownText: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 8
  },
  deathOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(100,0,0,0.3)',
    zIndex: 500
  },
  deathText: {
    fontSize: 48,
    fontWeight: 700,
    color: 'var(--error)',
    fontFamily: 'Bahnschrift, monospace'
  },
  deathSub: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 8
  },
  leaveBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 100,
    opacity: 0.5,
    fontSize: 12
  }
}
