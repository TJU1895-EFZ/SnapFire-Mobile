/**
 * Battle screen — camera feed + Three.js weapon overlay + HUD + touch input.
 *
 * Shot judging happens on the client: VisionEngine analyses the crosshair crop
 * when the trigger is pressed, and only a confident identity match is sent to
 * the server.  "Unknown" always means a miss, never a guess.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { BattleScene } from '@mobile/game/BattleScene'
import { TriggerLatch } from '@mobile/game/TriggerLatch'
import { audio } from '@mobile/game/audio'
import {
  DEFAULT_WEAPON,
  WEAPONS,
  nextWeapon,
  switchDuration,
  type WeaponId
} from '@mobile/game/weapons'
import { useCamera } from '@mobile/hooks/useCamera'
import { useServerClock } from '@mobile/hooks/useServerClock'
import { useTouchInput } from '@mobile/hooks/useTouchInput'
import { TargetSelector } from '@mobile/input/TargetSelector'
import { TriggerButton } from '@mobile/input/TriggerButton'
import { WeaponSwitch } from '@mobile/input/WeaponSwitch'
import { VisionEngine, type VisionFrameResult } from '@mobile/vision/engine'
import { warmupHuman } from '@mobile/vision/human'
import type {
  DetectionQuality,
  GalleryEntry,
  RoomPublicState,
  Team
} from '@shared/types'
import { MAX_HP } from '@shared/types'

interface BattleProps {
  room: RoomPublicState
  selfId: string
  gallery: GalleryEntry[]
  quality: DetectionQuality
  cameraDeviceId: string | null
  onLeave: () => void
  onFireShot: (targetId: string | null) => boolean
  onNotify: (
    message: string,
    kind?: 'info' | 'success' | 'error',
    ms?: number
  ) => void
}

type LockKind = 'none' | 'unknown' | 'enemy' | 'teammate'

interface LockState {
  kind: LockKind
  name: string
  team: Team | null
  confidence: number
}

const EMPTY_LOCK: LockState = { kind: 'none', name: '', team: null, confidence: 0 }

export function BattleScreen({
  room,
  selfId,
  gallery,
  quality,
  cameraDeviceId,
  onLeave,
  onFireShot,
  onNotify
}: BattleProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const battleSceneRef = useRef<BattleScene | null>(null)
  const visionRef = useRef<VisionEngine | null>(null)
  const selfTeamRef = useRef<Team | null>(null)
  const firingRef = useRef(false)
  const lastShotAtRef = useRef(0)
  const prevHpRef = useRef<number | null>(null)
  const weaponRef = useRef<WeaponId>(DEFAULT_WEAPON)
  const fireRef = useRef<() => Promise<void>>(async () => undefined)
  const latchRef = useRef<TriggerLatch | null>(null)
  const switchTimerRef = useRef<number | null>(null)

  if (latchRef.current === null) {
    const spec = WEAPONS[DEFAULT_WEAPON]
    latchRef.current = new TriggerLatch(
      () => fireRef.current(),
      spec.fireMode,
      spec.fireIntervalMs
    )
  }

  const { videoRef, status: camStatus, error: camError, resolution, start: startCamera } =
    useCamera({ autoStart: true, deviceId: cameraDeviceId })
  const { selectedTargetId, onSelectTarget } = useTouchInput()
  const serverNow = useServerClock(room)

  const [lock, setLock] = useState<LockState>(EMPTY_LOCK)
  const [hitFlash, setHitFlash] = useState(false)
  const [sceneError, setSceneError] = useState<string | null>(null)
  const [weapon, setWeapon] = useState<WeaponId>(DEFAULT_WEAPON)
  const [weaponSwitching, setWeaponSwitching] = useState(false)

  const self = room.players.find((player) => player.id === selfId) ?? null
  const selfTeam = self?.team ?? null
  const hp = self?.hp ?? MAX_HP
  const alive = self?.alive ?? true
  const phase = room.phase
  const targets = room.players.filter((player) => player.id !== selfId)

  selfTeamRef.current = selfTeam

  // ── Derived HUD values ─────────────────────────────────────────────────

  const countdownRemaining =
    phase === 'countdown' && room.countdownEndsAt
      ? Math.max(0, room.countdownEndsAt - serverNow)
      : 0
  const matchRemaining =
    phase === 'playing' && room.matchEndsAt
      ? Math.max(0, room.matchEndsAt - serverNow)
      : null
  const respawnRemaining =
    !alive && self?.respawnAt ? Math.max(0, self.respawnAt - serverNow) : 0
  const invulnerableRemaining = self?.invulnerableUntil
    ? Math.max(0, self.invulnerableUntil - serverNow)
    : 0

  // ── Hit flash ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (prevHpRef.current !== null && hp < prevHpRef.current) {
      setHitFlash(true)
      const timer = window.setTimeout(() => setHitFlash(false), 260)
      prevHpRef.current = hp
      return () => window.clearTimeout(timer)
    }
    prevHpRef.current = hp
    return undefined
  }, [hp])

  // ── Trigger semantics ──────────────────────────────────────────────────

  useEffect(() => {
    weaponRef.current = weapon
    const spec = WEAPONS[weapon]
    latchRef.current?.setMode(spec.fireMode, spec.fireIntervalMs)
  }, [weapon])

  useEffect(() => {
    const release = (): void => latchRef.current?.release()
    const onVisibility = (): void => {
      if (document.hidden) release()
    }
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onVisibility)
      latchRef.current?.dispose()
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current)
        switchTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!alive || phase !== 'playing') latchRef.current?.release()
  }, [alive, phase])

  useEffect(() => {
    battleSceneRef.current?.setLock(lock.kind)
  }, [lock.kind])

  // ── Three.js weapon ────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let scene: BattleScene
    try {
      scene = new BattleScene(canvas)
      scene.start()
      scene.resize(
        canvas.clientWidth || window.innerWidth,
        canvas.clientHeight || window.innerHeight
      )
    } catch (error) {
      console.warn('[battle] 3D scene unavailable', error)
      setSceneError('3D 枪械渲染不可用，识别射击仍可使用')
      return undefined
    }

    battleSceneRef.current = scene
    const resize = (): void => {
      scene.resize(
        canvas.clientWidth || window.innerWidth,
        canvas.clientHeight || window.innerHeight
      )
    }

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize)
      observer.observe(canvas)
    }
    window.addEventListener('resize', resize)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      scene.dispose()
      battleSceneRef.current = null
    }
  }, [])

  // ── Vision engine ──────────────────────────────────────────────────────

  const handleVision = useCallback((result: VisionFrameResult) => {
    if (!result.target) {
      setLock(EMPTY_LOCK)
      return
    }
    if (!result.match) {
      setLock({ kind: 'unknown', name: '', team: null, confidence: 0 })
      return
    }
    const mine = selfTeamRef.current
    setLock({
      kind: mine && result.match.team === mine ? 'teammate' : 'enemy',
      name: result.match.name,
      team: result.match.team,
      confidence: result.match.confidence
    })
  }, [])

  useEffect(() => {
    void warmupHuman()

    let vision: VisionEngine
    try {
      vision = new VisionEngine()
    } catch (error) {
      console.error('[battle] vision engine unavailable', error)
      onNotify('识别引擎初始化失败，本次战斗只能手动选择目标', 'error', 4200)
      return undefined
    }
    vision.setQuality(quality)
    vision.setSession(gallery, selfId)
    vision.onResult(handleVision)
    visionRef.current = vision

    if (camStatus === 'ready' && videoRef.current) {
      vision.start(videoRef.current)
    }

    return () => {
      vision.stop()
      visionRef.current = null
    }
    // Quality/session updates are handled by the effects below; the engine
    // instance itself must survive gallery updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfId, handleVision])

  useEffect(() => {
    visionRef.current?.setSession(gallery, selfId)
  }, [gallery, selfId])

  useEffect(() => {
    visionRef.current?.setQuality(quality)
  }, [quality])

  useEffect(() => {
    if (camStatus === 'ready' && videoRef.current) {
      visionRef.current?.start(videoRef.current)
    }
  }, [camStatus, videoRef])

  // Drop a manual selection whose player left the room.
  useEffect(() => {
    if (!selectedTargetId) return
    const target = room.players.find((player) => player.id === selectedTargetId)
    if (!target) onSelectTarget(null)
  }, [room.players, selectedTargetId, onSelectTarget])

  // ── Firing ─────────────────────────────────────────────────────────────

  const handleFire = useCallback(async (): Promise<void> => {
    if (!alive || phase !== 'playing' || firingRef.current) return
    const spec = WEAPONS[weaponRef.current]
    const now = Date.now()
    if (now - lastShotAtRef.current < spec.fireIntervalMs) return
    lastShotAtRef.current = now
    firingRef.current = true

    // Immediate feedback; the identity check follows.
    audio.unlock()
    if (weaponRef.current === 'pistol') audio.pistolShot()
    else audio.gunshot()
    battleSceneRef.current?.fire()

    try {
      let targetId: string | null = null
      const vision = visionRef.current
      if (vision) {
        // Automatic fire reuses a slightly older identity result so the
        // burst keeps its cadence instead of waiting on every inference.
        // Do not let a slow first inference freeze the trigger either: if
        // the analysis misses the deadline, fall back to explicit selection.
        const maxAgeMs = spec.fireMode === 'auto' ? 420 : 180
        const result = await withTimeout(vision.analyzeNow(maxAgeMs), 1200)
        if (result?.match) {
          // Fresh, confident identity wins over manual selection.
          targetId = result.match.playerId
        } else if (selectedTargetId) {
          // Explicit manual aim assist when the camera cannot identify.
          targetId = selectedTargetId
        }
      } else if (selectedTargetId) {
        targetId = selectedTargetId
      }

      if (!onFireShot(targetId)) {
        onNotify('网络未连接，本次射击未发送', 'error')
      }
    } catch (error) {
      console.warn('[battle] shot analysis failed', error)
      if (!onFireShot(selectedTargetId)) {
        onNotify('网络未连接，本次射击未发送', 'error')
      }
    } finally {
      firingRef.current = false
    }
  }, [alive, phase, selectedTargetId, onFireShot, onNotify])

  useEffect(() => {
    fireRef.current = handleFire
  }, [handleFire])

  const handleSwitchWeapon = useCallback((): void => {
    if (weaponSwitching) return
    const current = weaponRef.current
    const next = nextWeapon(current)
    const spec = WEAPONS[next]

    // A trigger held across the swap would otherwise keep firing with the
    // old cadence while the new model is still being raised.
    latchRef.current?.release()
    weaponRef.current = next
    setWeapon(next)
    setWeaponSwitching(true)
    battleSceneRef.current?.switchWeapon(next)
    audio.weaponSwitch()

    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current)
    }
    switchTimerRef.current = window.setTimeout(() => {
      switchTimerRef.current = null
      setWeaponSwitching(false)
    }, switchDuration(spec))
  }, [weaponSwitching])

  const handleTriggerStart = useCallback((): void => {
    if (!alive || phase !== 'playing' || weaponSwitching) return
    latchRef.current?.press()
  }, [alive, phase, weaponSwitching])

  const handleTriggerEnd = useCallback((): void => {
    latchRef.current?.release()
  }, [])

  const requestLeave = useCallback((): void => {
    if (phase === 'playing' || phase === 'countdown') {
      if (!window.confirm('比赛进行中，确定离开房间吗？')) return
    }
    onLeave()
  }, [onLeave, phase])

  // ── HUD helpers ────────────────────────────────────────────────────────

  const hpColor = hp > 60 ? 'var(--success)' : hp > 30 ? 'var(--warning)' : 'var(--error)'
  const lockColor =
    lock.kind === 'enemy'
      ? 'var(--error)'
      : lock.kind === 'teammate'
        ? 'var(--blue)'
        : 'var(--warning)'
  const lockLabel =
    lock.kind === 'enemy'
      ? '敌人'
      : lock.kind === 'teammate'
        ? '队友'
        : lock.kind === 'unknown'
          ? '未识别'
          : ''

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="battle-root"
      onPointerDown={() => audio.unlock()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
      <canvas ref={canvasRef} style={styles.canvas} />

      <div className="crosshair" aria-hidden="true">
        <span className="crosshair__dot" />
      </div>

      {/* Top bar */}
      {phase !== 'countdown' && (
        <div style={styles.hudTop}>
          <div style={styles.score}>
            <span style={{ color: 'var(--red)' }}>{room.score.red}</span>
            <span style={{ opacity: 0.3, margin: '0 8px' }}>:</span>
            <span style={{ color: 'var(--blue)' }}>{room.score.blue}</span>
          </div>
          {matchRemaining !== null && (
            <div style={styles.timer}>{formatClock(matchRemaining)}</div>
          )}
        </div>
      )}

      {/* Kill feed */}
      {phase !== 'countdown' && room.killFeed.length > 0 && (
        <div style={styles.killFeed}>
          {room.killFeed.slice(0, 3).map((entry) => (
            <div key={entry.id} style={{ opacity: 0.65 }}>
              {entry.killerName} → {entry.victimName}
            </div>
          ))}
        </div>
      )}

      {/* HP */}
      <div style={styles.hpContainer}>
        <div style={styles.hpBar}>
          <div
            style={{
              ...styles.hpFill,
              width: `${(hp / MAX_HP) * 100}%`,
              background: hpColor
            }}
          />
        </div>
        <span style={styles.hpText}>
          {hp}/{MAX_HP}
        </span>
        {invulnerableRemaining > 0 && (
          <span className="pill pill--warning">
            无敌 {Math.ceil(invulnerableRemaining / 1000)}s
          </span>
        )}
      </div>

      {/* Lock indicator, just below the crosshair */}
      {lock.kind !== 'none' && phase === 'playing' && (
        <div style={{ ...styles.lockIndicator, borderColor: lockColor }}>
          <span style={{ color: lockColor, fontWeight: 700 }}>{lockLabel}</span>
          {lock.name && <span className="truncate">{lock.name}</span>}
          {lock.kind === 'unknown' && <span className="muted">目标未识别</span>}
          {lock.confidence > 0 && (
            <span className="tiny muted">{Math.round(lock.confidence * 100)}%</span>
          )}
        </div>
      )}

      {/* Camera status */}
      {camStatus !== 'ready' && !camError && (
        <div style={styles.cameraChip}>
          摄像头启动中…
          {resolution ? ` ${resolution.width}×${resolution.height}` : ''}
        </div>
      )}

      {sceneError && <div style={styles.sceneChip}>{sceneError}</div>}

      {hitFlash && <div className="hit-flash" />}

      {/* Countdown */}
      {phase === 'countdown' && (
        <div style={styles.countdownOverlay}>
          <div style={styles.countdownNumber}>
            {Math.max(1, Math.ceil(countdownRemaining / 1000))}
          </div>
          <div style={styles.countdownText}>比赛开始</div>
        </div>
      )}

      {/* Death */}
      {!alive && phase === 'playing' && (
        <div style={styles.deathOverlay}>
          <div style={styles.deathText}>阵亡</div>
          <div style={styles.deathSub}>
            {Math.max(0, Math.ceil(respawnRemaining / 1000))} 秒后复活
          </div>
        </div>
      )}

      {/* Camera failure */}
      {camError && (
        <div style={styles.errorOverlay}>
          <p style={styles.errorText}>{camError}</p>
          <div className="button-row" style={{ justifyContent: 'center' }}>
            <button
              className="primary-button"
              onClick={() => void startCamera(cameraDeviceId)}
            >
              重试
            </button>
            <button className="secondary-button" onClick={requestLeave}>
              离开
            </button>
          </div>
          <p className="tiny muted" style={{ marginTop: 12, maxWidth: 420 }}>
            手机浏览器只有在 HTTPS 或 localhost 下才允许使用摄像头。
            如果通过局域网 IP 访问，请使用 `npm run lan` 提供的 HTTPS 地址。
          </p>
        </div>
      )}

      {/* Touch controls */}
      {!camError && (
        <>
          <TargetSelector
            players={targets}
            selectedId={selectedTargetId}
            onSelect={onSelectTarget}
          />
          <WeaponSwitch
            weapon={weapon}
            switching={weaponSwitching}
            onSwitch={handleSwitchWeapon}
          />
          <TriggerButton
            onPressStart={handleTriggerStart}
            onPressEnd={handleTriggerEnd}
            mode={WEAPONS[weapon].fireMode}
            disabled={!alive || phase !== 'playing' || weaponSwitching}
          />
        </>
      )}

      <button style={styles.leaveBtn} onClick={requestLeave}>
        离开
      </button>
    </div>
  )
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms)
    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        window.clearTimeout(timer)
        resolve(null)
      })
  })
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const styles: Record<string, React.CSSProperties> = {
  video: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none'
  },
  hudTop: {
    position: 'absolute',
    top: 'max(10px, env(safe-area-inset-top))',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    zIndex: 100,
    pointerEvents: 'none'
  },
  score: {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: 'Bahnschrift, monospace',
    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
  },
  timer: {
    fontSize: 16,
    opacity: 0.85,
    fontFamily: 'Bahnschrift, monospace',
    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
  },
  killFeed: {
    position: 'absolute',
    top: 'calc(max(10px, env(safe-area-inset-top)) + 46px)',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    alignItems: 'center',
    fontSize: 12,
    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
    pointerEvents: 'none'
  },
  hpContainer: {
    position: 'absolute',
    bottom: 'calc(24px + env(safe-area-inset-bottom))',
    left: 'max(16px, env(safe-area-inset-left))',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'none'
  },
  hpBar: {
    width: 130,
    height: 9,
    background: 'rgba(0,0,0,0.55)',
    borderRadius: 5,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.15)'
  },
  hpFill: {
    height: '100%',
    transition: 'width 0.2s ease, background 0.2s ease'
  },
  hpText: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'Bahnschrift, monospace',
    textShadow: '0 1px 4px rgba(0,0,0,0.9)'
  },
  lockIndicator: {
    position: 'absolute',
    top: 'calc(50% + 30px)',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 130,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    maxWidth: '70vw',
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid transparent',
    fontSize: 12,
    pointerEvents: 'none'
  },
  cameraChip: {
    position: 'absolute',
    bottom: 'calc(80px + env(safe-area-inset-bottom))',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 110,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.55)',
    fontSize: 11,
    color: 'var(--text-secondary)',
    pointerEvents: 'none'
  },
  sceneChip: {
    position: 'absolute',
    bottom: 'calc(112px + env(safe-area-inset-bottom))',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 110,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.55)',
    fontSize: 11,
    color: 'var(--warning)',
    pointerEvents: 'none'
  },
  countdownOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.45)',
    pointerEvents: 'none'
  },
  countdownNumber: {
    fontSize: 92,
    fontWeight: 700,
    color: 'var(--accent)',
    fontFamily: 'Bahnschrift, monospace',
    textShadow: '0 4px 24px rgba(0,0,0,0.9)'
  },
  countdownText: {
    marginTop: 6,
    fontSize: 16,
    opacity: 0.75,
    letterSpacing: '0.16em'
  },
  deathOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(90,0,0,0.32)',
    pointerEvents: 'none'
  },
  deathText: {
    fontSize: 52,
    fontWeight: 700,
    color: 'var(--error)',
    fontFamily: 'Bahnschrift, monospace'
  },
  deathSub: {
    marginTop: 8,
    fontSize: 16,
    opacity: 0.75
  },
  errorOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'rgba(0,0,0,0.86)'
  },
  errorText: {
    maxWidth: 460,
    marginBottom: 16,
    color: 'var(--error)',
    fontSize: 15,
    lineHeight: 1.5,
    textAlign: 'center'
  },
  leaveBtn: {
    position: 'absolute',
    top: 'max(10px, env(safe-area-inset-top))',
    left: 'max(12px, env(safe-area-inset-left))',
    zIndex: 520,
    padding: '6px 10px',
    borderRadius: 6,
    background: 'rgba(0,0,0,0.45)',
    color: 'var(--text-secondary)',
    fontSize: 12
  }
}
