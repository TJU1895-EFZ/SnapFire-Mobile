/**
 * Mobile app root.
 *
 * Owns the network session, IndexedDB-backed player data and phase-driven
 * navigation between the lobby, battle and results screens.
 */

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { audio } from '@mobile/game/audio'
import { HistoryModal } from '@mobile/components/HistoryModal'
import { InstallPrompt } from '@mobile/components/InstallPrompt'
import { SettingsModal } from '@mobile/components/SettingsModal'
import { HomeScreen } from '@mobile/screens/HomeScreen'
import { LobbyScreen } from '@mobile/screens/LobbyScreen'
import { ResultsScreen } from '@mobile/screens/ResultsScreen'
import { RoomEntryScreen } from '@mobile/screens/RoomEntryScreen'
import { NetClient, normalizeHostAddress, type NetEvent } from '@mobile/net/NetClient'
import { storage } from '@mobile/storage'
import type {
  AppearanceData,
  AppSettings,
  GalleryEntry,
  HistoryData,
  MatchPhase,
  MatchResult,
  ProfileData,
  RoomPublicState,
  ServerMessage
} from '@shared/types'

// Heavy screens (Three.js, Human AI) stay out of the initial bundle.
const BattleScreen = lazy(() =>
  import('@mobile/screens/BattleScreen').then((module) => ({
    default: module.BattleScreen
  }))
)
const EnrollmentModal = lazy(() =>
  import('@mobile/screens/EnrollmentModal').then((module) => ({
    default: module.EnrollmentModal
  }))
)

type Screen = 'home' | 'room-entry' | 'lobby' | 'battle' | 'results'
type ToastKind = 'info' | 'success' | 'error'

interface ToastState {
  id: number
  message: string
  kind: ToastKind
}

const INIT_TIMEOUT_MS = 10_000

export function App(): React.JSX.Element {
  // ── Persisted data ─────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [appearance, setAppearance] = useState<AppearanceData | null>(null)
  const [history, setHistory] = useState<HistoryData>({ matches: [] })
  const [initError, setInitError] = useState<string | null>(null)

  // ── Session / navigation ───────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>('home')
  const [room, setRoom] = useState<RoomPublicState | null>(null)
  const [gallery, setGallery] = useState<GalleryEntry[]>([])
  const [selfId, setSelfId] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [result, setResult] = useState<MatchResult | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  // ── Modals / toast ─────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showEnrollment, setShowEnrollment] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  // ── Refs mirror state for network callbacks ────────────────────────────
  const profileRef = useRef<ProfileData | null>(null)
  const settingsRef = useRef<AppSettings | null>(null)
  const appearanceRef = useRef<AppearanceData | null>(null)
  const roomRef = useRef<RoomPublicState | null>(null)
  const selfIdRef = useRef('')
  const isHostRef = useRef(false)
  const screenRef = useRef<Screen>('home')
  const netRef = useRef<NetClient | null>(null)
  const connectingRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)
  const savedMatchesRef = useRef<Set<string>>(new Set())

  // ── Helpers ────────────────────────────────────────────────────────────

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info', ms = 3200): void => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
      setToast({ id: Date.now(), message, kind })
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null)
        toastTimerRef.current = null
      }, ms)
    },
    []
  )

  const go = useCallback((next: Screen): void => {
    screenRef.current = next
    setScreen(next)
  }, [])

  const applyRoom = useCallback((next: RoomPublicState | null): void => {
    roomRef.current = next
    setRoom(next)
    if (!next) {
      setResult(null)
      return
    }
    if (next.result) setResult(next.result)
    else if (next.phase === 'lobby') setResult(null)
  }, [])

  const resetSession = useCallback((): void => {
    roomRef.current = null
    setRoom(null)
    setGallery([])
    selfIdRef.current = ''
    setSelfId('')
    isHostRef.current = false
    setIsHost(false)
    setResult(null)
    setShowEnrollment(false)
    setJoinError(null)
    setConnecting(false)
    connectingRef.current = false
  }, [])

  // ── Initialise persisted data ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    let timeoutId: number | null = null
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error('读取本地数据超时，请刷新页面重试')),
        INIT_TIMEOUT_MS
      )
    })

    ;(async () => {
      try {
        const loaded = await Promise.race([
          Promise.all([
            storage.loadProfile(),
            storage.loadSettings(),
            storage.loadHistory(),
            storage.loadAppearance()
          ]),
          timeout
        ])
        if (cancelled) return
        const [nextProfile, nextSettings, nextHistory, nextAppearance] = loaded
        profileRef.current = nextProfile
        settingsRef.current = nextSettings
        appearanceRef.current = nextAppearance
        setProfile(nextProfile)
        setSettings(nextSettings)
        setHistory(nextHistory)
        setAppearance(nextAppearance)
        audio.setVolume(nextSettings.volume)
      } catch (error) {
        if (cancelled) return
        console.error('[app] init failed', error)
        setInitError(error instanceof Error ? error.message : '初始化失败')
      } finally {
        if (timeoutId !== null) window.clearTimeout(timeoutId)
      }
    })()

    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [])

  // Unlock Web Audio on the first user gesture.
  useEffect(() => {
    const unlock = (): void => audio.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // Tear down the socket and toast timer on unmount.
  useEffect(() => {
    return () => {
      netRef.current?.close()
      netRef.current = null
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  // ── Settings / profile ─────────────────────────────────────────────────

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>): void => {
      const current = settingsRef.current
      if (!current) return
      const next: AppSettings = { ...current, ...patch }
      settingsRef.current = next
      setSettings(next)
      audio.setVolume(next.volume)
      void storage.saveSettings(next).catch((error) => {
        console.error('[app] save settings failed', error)
        showToast('保存设置失败', 'error')
      })
    },
    [showToast]
  )

  const updateName = useCallback(
    async (name: string): Promise<void> => {
      const current = profileRef.current
      if (!current) return
      const clean = name.trim().slice(0, 16)
      if (!clean) throw new Error('昵称不能为空')
      const next: ProfileData = { ...current, name: clean, updatedAt: Date.now() }
      await storage.saveProfile(next)
      profileRef.current = next
      setProfile(next)
      if (netRef.current?.isOpen && roomRef.current?.phase === 'lobby') {
        netRef.current.send({ type: 'set-name', name: clean })
      }
    },
    []
  )

  // ── Appearance ─────────────────────────────────────────────────────────

  const sendAppearance = useCallback((value: AppearanceData): boolean => {
    const client = netRef.current
    if (!client?.isOpen) return false
    // The thumbnail never leaves the phone.
    const { thumbnail: _thumbnail, ...rest } = value
    return client.send({
      type: 'set-appearance',
      appearance: { ...rest, thumbnail: undefined }
    })
  }, [])

  const saveAppearance = useCallback(
    async (next: AppearanceData): Promise<void> => {
      await storage.saveAppearance(next)
      appearanceRef.current = next
      setAppearance(next)
      const synced = sendAppearance(next)
      setShowEnrollment(false)
      showToast(
        synced ? '建档已保存并同步到房间' : '建档已保存到本机，联网后可手动同步',
        synced ? 'success' : 'info'
      )
    },
    [sendAppearance, showToast]
  )

  const syncAppearance = useCallback((): void => {
    const value = appearanceRef.current
    if (!value) {
      showToast('本机还没有建档', 'error')
      return
    }
    const synced = sendAppearance(value)
    showToast(
      synced ? '建档已同步到房间' : '网络未连接，同步失败',
      synced ? 'success' : 'error'
    )
  }, [sendAppearance, showToast])

  const saveMatchOnce = useCallback(
    (matchResult: MatchResult): void => {
      if (savedMatchesRef.current.has(matchResult.matchId)) return
      savedMatchesRef.current.add(matchResult.matchId)
      void storage
        .addHistory(matchResult)
        .then((nextHistory) => setHistory(nextHistory))
        .catch((error) => {
          savedMatchesRef.current.delete(matchResult.matchId)
          console.error('[app] save history failed', error)
          showToast('保存战绩失败', 'error')
        })
    },
    [showToast]
  )

  // ── Navigation driven by server phase ──────────────────────────────────

  const syncScreenForPhase = useCallback(
    (phase: MatchPhase): void => {
      if (phase === 'lobby') {
        setResult(null)
        go('lobby')
      } else if (phase === 'countdown' || phase === 'playing') {
        setShowEnrollment(false)
        go('battle')
      } else {
        setShowEnrollment(false)
        go('results')
      }
    },
    [go]
  )

  // ── Server messages ────────────────────────────────────────────────────

  const handleServerMessage = useCallback(
    (event: ServerMessage): void => {
      switch (event.type) {
        case 'welcome': {
          selfIdRef.current = event.selfId
          setSelfId(event.selfId)
          isHostRef.current = event.isHost
          setIsHost(event.isHost)
          applyRoom(event.room)
          setGallery(event.gallery)
          setJoinError(null)

          if (event.room.phase === 'lobby') go('lobby')
          else if (event.room.phase === 'ended') {
            if (event.room.result) {
              setResult(event.room.result)
              // A reload/reconnect after match-end should still persist the
              // result locally.
              saveMatchOnce(event.room.result)
            }
            go('results')
          } else go('battle')

          // Re-publish a previously saved enrolment after a rejoin.
          const local = appearanceRef.current
          if (local) sendAppearance(local)
          break
        }

        case 'room': {
          applyRoom(event.room)
          syncScreenForPhase(event.room.phase)
          break
        }

        case 'gallery': {
          setGallery(event.gallery)
          break
        }

        case 'match-start': {
          applyRoom(event.room)
          setShowEnrollment(false)
          go('battle')
          break
        }

        case 'shot-result': {
          if (event.hit) {
            audio.hit()
            if (event.killed) audio.kill()
          } else if (event.reason === 'friendly') {
            audio.friendly()
          } else if (event.reason !== 'cooldown') {
            audio.miss()
          }
          break
        }

        case 'damage': {
          if (event.targetId === selfIdRef.current) {
            audio.damage()
            if (event.killed) audio.error()
          }
          break
        }

        case 'respawn': {
          if (event.playerId === selfIdRef.current) audio.respawn()
          break
        }

        case 'match-end': {
          setResult(event.result)
          const currentRoom = roomRef.current
          if (currentRoom) {
            applyRoom({ ...currentRoom, phase: 'ended', result: event.result })
          }
          saveMatchOnce(event.result)
          go('results')
          break
        }

        case 'error': {
          showToast(event.message, 'error', 4200)
          break
        }

        default:
          break
      }
    },
    [applyRoom, go, saveMatchOnce, sendAppearance, showToast, syncScreenForPhase]
  )

  const handleNetEvent = useCallback(
    (event: NetEvent): void => {
      if (event.type === 'socket-closed') {
        showToast(
          event.reason
            ? `与服务端断开连接：${event.reason}`
            : '与服务端断开连接',
          'error',
          4200
        )
        netRef.current?.close()
        netRef.current = null
        resetSession()
        go('home')
        return
      }
      if (event.type === 'socket-error') {
        showToast(event.message, 'error', 4200)
        netRef.current?.close()
        netRef.current = null
        resetSession()
        go('home')
        return
      }
      handleServerMessage(event)
    },
    [go, handleServerMessage, resetSession, showToast]
  )

  // ── Join / leave ───────────────────────────────────────────────────────

  const connectAndJoin = useCallback(
    async (address: string, roomCode: string): Promise<void> => {
      if (connectingRef.current) return
      const currentProfile = profileRef.current
      if (!currentProfile) return

      let url: string
      try {
        url = normalizeHostAddress(address)
      } catch (error) {
        const message = error instanceof Error ? error.message : '地址格式不正确'
        setJoinError(message)
        showToast(message, 'error')
        return
      }

      connectingRef.current = true
      setConnecting(true)
      setJoinError(null)

      const client = new NetClient()
      netRef.current = client
      let joinedOnce = false
      const detach = client.on((event) => {
        if (event.type === 'welcome') joinedOnce = true
        // Ignore connection failures here; connect()'s rejection reports them
        // once, with a useful message.
        if (!joinedOnce) return
        handleNetEvent(event)
      })

      try {
        await client.connect(url, {
          roomCode,
          playerId: currentProfile.id,
          name: currentProfile.name
        })
        if (!client.isJoined) throw new Error('连接已关闭')
        showToast(`已加入房间 ${roomCode}`, 'success')
      } catch (error) {
        detach()
        client.close()
        if (netRef.current === client) netRef.current = null
        const message =
          error instanceof Error ? error.message : '连接失败，请检查地址和网络'
        setJoinError(message)
        showToast(message, 'error', 4200)
      } finally {
        connectingRef.current = false
        setConnecting(false)
      }
    },
    [handleNetEvent, showToast]
  )

  const leaveRoom = useCallback((): void => {
    const client = netRef.current
    if (client?.isOpen) client.send({ type: 'leave' })
    client?.close()
    netRef.current = null
    resetSession()
    go('home')
  }, [go, resetSession])

  const returnToLobby = useCallback((): void => {
    if (!isHostRef.current) {
      showToast('只有房主可以返回大厅', 'error')
      return
    }
    const client = netRef.current
    if (!client?.isOpen) {
      showToast('网络未连接', 'error')
      return
    }
    if (!client.send({ type: 'return-lobby' })) {
      showToast('返回大厅失败，请重试', 'error')
    }
  }, [showToast])

  // ── Default room address for the LAN proxy ─────────────────────────────

  const initialAddress = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const { protocol, host, hostname, port } = window.location
    const lanHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    // Only prefill when the page itself looks like a LAN host (the proxy) or
    // uses a non-standard HTTPS port.  A public static host should not
    // silently become the room address.
    if (protocol === 'https:' && (lanHost || (port && port !== '443'))) return host
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${hostname}:17890`
    }
    return ''
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────

  if (initError) {
    return (
      <div className="fatal-screen">
        <h1 className="fatal-screen__title">SNAPFIRE</h1>
        <p className="fatal-screen__message">{initError}</p>
        <button className="primary-button" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </div>
    )
  }

  if (!profile || !settings) {
    return (
      <div className="loading-screen">
        <h1 className="loading-screen__title">SNAPFIRE</h1>
        <p className="tiny muted">加载本地数据…</p>
      </div>
    )
  }

  return (
    <>
      {screen === 'home' && <InstallPrompt />}

      {screen === 'home' && (
        <HomeScreen
          profile={profile}
          history={history}
          onCombat={() => go('room-entry')}
          onSettings={() => setShowSettings(true)}
          onHistory={() => setShowHistory(true)}
          onNameChange={updateName}
        />
      )}

      {screen === 'room-entry' && (
        <RoomEntryScreen
          initialAddress={initialAddress}
          busy={connecting}
          error={joinError}
          onJoin={(address, code) => void connectAndJoin(address, code)}
          onBack={() => {
            setJoinError(null)
            go('home')
          }}
        />
      )}

      {screen === 'lobby' && room && (
        <LobbyScreen
          room={room}
          selfId={selfId}
          isHost={isHost}
          appearance={appearance}
          onEnroll={() => setShowEnrollment(true)}
          onSyncAppearance={syncAppearance}
          onReady={(ready) => netRef.current?.send({ type: 'set-ready', ready })}
          onTeam={(team) => netRef.current?.send({ type: 'set-team', team })}
          onLeave={leaveRoom}
        />
      )}

      {screen === 'lobby' && !room && (
        <div className="loading-screen">
          <p className="tiny muted">等待房间状态…</p>
          <button className="ghost-button" onClick={leaveRoom}>
            返回首页
          </button>
        </div>
      )}

      {screen === 'battle' && room && (
        <Suspense fallback={<BattleLoading />}>
          <BattleScreen
            room={room}
            selfId={selfId}
            gallery={gallery}
            quality={settings.detectionQuality}
            cameraDeviceId={settings.cameraDeviceId}
            onLeave={leaveRoom}
            onFireShot={(targetId) =>
              netRef.current?.send({ type: 'shot', targetId }) ?? false
            }
            onNotify={showToast}
          />
        </Suspense>
      )}

      {screen === 'results' &&
        (result ? (
          <ResultsScreen
            result={result}
            selfId={selfId}
            isHost={isHost}
            onReturnLobby={returnToLobby}
            onLeave={leaveRoom}
          />
        ) : (
          <div className="loading-screen">
            <p className="tiny muted">正在结算…</p>
          </div>
        ))}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHistory && (
        <HistoryModal
          matches={history.matches}
          selfId={profile.id}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showEnrollment && (
        <Suspense fallback={<ModalLoading />}>
          <EnrollmentModal
            cameraDeviceId={settings.cameraDeviceId}
            existing={appearance}
            onClose={() => setShowEnrollment(false)}
            onSave={saveAppearance}
          />
        </Suspense>
      )}

      {toast && (
        <div
          key={toast.id}
          className={`toast toast--${toast.kind}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </>
  )
}

function BattleLoading(): React.JSX.Element {
  return (
    <div className="loading-screen loading-screen--fixed">
      <h1 className="loading-screen__title">SNAPFIRE</h1>
      <p className="tiny muted">正在加载战斗模块…</p>
    </div>
  )
}

function ModalLoading(): React.JSX.Element {
  return (
    <div className="loading-screen loading-screen--fixed">
      <p className="tiny muted">正在加载建档模块…</p>
    </div>
  )
}
