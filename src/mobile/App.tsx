/**
 * Mobile app root.
 *
 * Replaces the desktop's window.snapfire.* IPC with the IndexedDB storage
 * layer and manages simple screen navigation.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { audio } from '@mobile/game/audio'
import { useCamera } from '@mobile/hooks/useCamera'
import { useServerClock } from '@mobile/hooks/useServerClock'
import { NetClient, type NetEvent, type WelcomeMessage } from '@mobile/net/NetClient'
import { storage } from '@mobile/storage'
import type {
  AppSettings,
  GalleryEntry,
  MatchPhase,
  MatchResult,
  MatchScore,
  PlayerPublic,
  ProfileData,
  RoomPublicState,
  ServerMessage,
  Team
} from '@shared/types'
import {
  COUNTDOWN_MS,
  DAMAGE_PER_HIT,
  DEFAULT_ROOM_SETTINGS,
  INVULNERABLE_MS,
  MAX_HP,
  RESPAWN_MS
} from '@shared/types'

// ── Screen types ───────────────────────────────────────────────────────────

type Screen =
  | { name: 'home' }
  | { name: 'room-entry' }
  | { name: 'lobby' }
  | { name: 'battle' }
  | { name: 'results' }

// ── App state (mirrors desktop App.tsx shape) ──────────────────────────────

interface AppState {
  profile: ProfileData
  settings: AppSettings
  gallery: GalleryEntry[]
  room: RoomPublicState | null
  phase: MatchPhase
  selfId: string
  isHost: boolean
  score: MatchScore
  killFeed: string[]
  result: MatchResult | null
  toast: { message: string; kind: 'info' | 'success' | 'error' } | null
  history: { matches: import('@shared/types').MatchResult[] }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeEmptyRoom(roomCode: string, hostId: string): RoomPublicState {
  return {
    roomCode,
    hostId,
    phase: 'lobby',
    players: [],
    settings: DEFAULT_ROOM_SETTINGS,
    score: { red: 0, blue: 0 },
    matchStartedAt: null,
    matchEndsAt: null,
    remainingMs: null,
    countdownEndsAt: null,
    serverNow: Date.now(),
    killFeed: [],
    result: null
  }
}

function findSelf(players: PlayerPublic[], selfId: string): PlayerPublic | undefined {
  return players.find((p) => p.id === selfId)
}

function findPlayer(players: PlayerPublic[], id: string): PlayerPublic | undefined {
  return players.find((p) => p.id === id)
}

// ── App ────────────────────────────────────────────────────────────────────

export function App(): React.JSX.Element {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [room, setRoom] = useState<RoomPublicState | null>(null)
  const [gallery, setGallery] = useState<GalleryEntry[]>([])
  const [selfId, setSelfId] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [score, setScore] = useState<MatchScore>({ red: 0, blue: 0 })
  const [killFeed, setKillFeed] = useState<string[]>([])
  const [result, setResult] = useState<MatchResult | null>(null)
  const [toast, setToast] = useState<AppState['toast']>(null)
  const [history, setHistory] = useState<{ matches: import('@shared/types').MatchResult[] }>({
    matches: []
  })

  const netRef = useRef<NetClient | null>(null)
  const phaseRef = useRef<MatchPhase>('lobby')
  const settingsRef = useRef<AppSettings | null>(null)

  // ── Initialise ────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [p, s, h, appearance] = await Promise.all([
          storage.loadProfile(),
          storage.loadSettings(),
          storage.loadHistory(),
          storage.loadAppearance()
        ])
        if (cancelled) return
        setProfile(p)
        setSettings(s)
        setHistory(h)
        settingsRef.current = s
        audio.setVolume(s.volume)
        if (appearance) {
          setGallery([
            {
              id: p.id,
              name: p.name,
              team: null,
              appearance
            }
          ])
        }
      } catch (err) {
        console.error('[app] init failed', err)
        if (!cancelled) setToast({ message: '初始化失败，请刷新页面', kind: 'error' })
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Persist settings when changed.
  useEffect(() => {
    if (!settings) return
    void storage.saveSettings(settings)
    settingsRef.current = settings
    audio.setVolume(settings.volume)
  }, [settings])

  // ── Toast helper ──────────────────────────────────────────────────────

  const showToast = useCallback(
    (message: string, kind: 'info' | 'success' | 'error' = 'info', ms = 3000) => {
      setToast({ message, kind })
      setTimeout(() => setToast(null), ms)
    },
    []
  )

  // ── Network ───────────────────────────────────────────────────────────

  const connectAndJoin = useCallback(
    async (address: string, roomCode: string, playerId: string, name: string) => {
      const client = new NetClient()
      netRef.current = client

      try {
        const welcome = await client.connect(address, { roomCode, playerId, name })
        setSelfId(welcome.selfId)
        setIsHost(welcome.isHost)
        onRoomState(welcome.room)
        if (welcome.gallery?.length) setGallery(welcome.gallery)
        showToast(`已加入房间 ${roomCode}`, 'success')
      } catch (err) {
        const msg = err instanceof Error ? err.message : '连接失败'
        showToast(msg, 'error')
      }

      client.on((event: NetEvent) => {
        if (event.type === 'socket-closed' || event.type === 'socket-error') {
          showToast('与服务端断开连接', 'error')
          setRoom(null)
          setScreen({ name: 'home' })
          return
        }
        handleServerMessage(event as ServerMessage)
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const leaveRoom = useCallback(() => {
    const client = netRef.current
    client?.send({ type: 'leave' })
    client?.close()
    netRef.current = null
    setRoom(null)
    setSelfId('')
    setIsHost(false)
    setScore({ red: 0, blue: 0 })
    setKillFeed([])
    setResult(null)
    setScreen({ name: 'home' })
  }, [])

  const onRoomState = useCallback((state: RoomPublicState) => {
    setRoom(state)
    phaseRef.current = state.phase
    setScore(state.score)
    setKillFeed(state.killFeed.map((k) => `${k.killerName} → ${k.victimName}`))
    if (state.result) setResult(state.result)
  }, [])

  // ── Server message handler ────────────────────────────────────────────

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'room':
        case 'match-start':
          onRoomState(msg.room)
          break
        case 'shot-result':
          if (msg.hit) {
            audio.hit()
          } else if (msg.reason === 'friendly') {
            audio.friendly()
          } else {
            audio.miss()
          }
          break
        case 'damage': {
          const self = findSelf(room?.players ?? [], selfId)
          if (self && self.id === selfId) {
            audio.damage()
          }
          break
        }
        case 'respawn':
          audio.respawn()
          break
        case 'match-end':
          audio.error()
          void storage.addHistory(msg.result).then((h) => setHistory(h))
          setScreen({ name: 'results' })
          break
        case 'error':
          showToast(msg.message, 'error')
          break
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, selfId, onRoomState, showToast]
  )

  // ── Settings update ───────────────────────────────────────────────────

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    },
    []
  )

  // ── Profile name change ───────────────────────────────────────────────

  const updateName = useCallback(
    async (name: string) => {
      if (!profile) return
      const updated = { ...profile, name, updatedAt: Date.now() }
      await storage.saveProfile(updated)
      setProfile(updated)
      // Sync to server if in room.
      if (netRef.current?.isOpen) {
        netRef.current.send({ type: 'set-name', name })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile]
  )

  // ── Render loading ────────────────────────────────────────────────────

  if (!profile || !settings) {
    return (
      <div style={styles.center}>
        <h1 style={styles.title}>SNAPFIRE</h1>
        <p style={styles.sub}>加载中…</p>
      </div>
    )
  }

  // ── Render screen ─────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {screen.name === 'home' && (
        <HomeScreen
          profile={profile}
          settings={settings}
          history={history}
          onCombat={() => setScreen({ name: 'room-entry' })}
          onSettings={() => showToast('设置功能开发中', 'info')}
          onHistory={() => showToast('战绩功能开发中', 'info')}
          onNameChange={updateName}
        />
      )}
      {screen.name === 'room-entry' && (
        <RoomEntryScreen
          onJoin={(addr, code) => {
            setScreen({ name: 'lobby' })
            void connectAndJoin(addr, code, profile.id, profile.name)
          }}
          onBack={() => setScreen({ name: 'home' })}
        />
      )}
      {screen.name === 'lobby' && room && (
        <LobbyScreen
          room={room}
          selfId={selfId}
          isHost={isHost}
          gallery={gallery}
          onReady={(ready) => netRef.current?.send({ type: 'set-ready', ready })}
          onTeam={(team) => netRef.current?.send({ type: 'set-team', team })}
          onLeave={leaveRoom}
        />
      )}
      {screen.name === 'battle' && <BattleScreenPlaceholder />}
      {screen.name === 'results' && result && (
        <ResultsScreen result={result} onBack={leaveRoom} />
      )}
      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  )
}

// ── Mini screen components ─────────────────────────────────────────────────

function HomeScreen({
  profile,
  history,
  onCombat,
  onSettings,
  onHistory,
  onNameChange
}: {
  profile: ProfileData
  settings: AppSettings
  history: { matches: import('@shared/types').MatchResult[] }
  onCombat: () => void
  onSettings: () => void
  onHistory: () => void
  onNameChange: (name: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name)

  const total = history.matches.length
  const totalKills = history.matches.reduce((s, m) => {
    const p = m.players.find((p) => p.id === profile.id)
    return s + (p?.kills ?? 0)
  }, 0)
  const totalDeaths = history.matches.reduce((s, m) => {
    const p = m.players.find((p) => p.id === profile.id)
    return s + (p?.deaths ?? 0)
  }, 0)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>SNAPFIRE</h1>
        <p style={styles.sub}>Mobile — MIX REALITY COMBAT</p>
      </div>

      {/* Profile */}
      <div style={styles.card}>
        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1 }}
              autoFocus
            />
            <button className="primary-button" onClick={() => { onNameChange(name); setEditing(false) }}>
              保存
            </button>
            <button className="ghost-button" onClick={() => { setName(profile.name); setEditing(false) }}>
              取消
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={styles.avatar}>{profile.name.slice(0, 2).toUpperCase()}</div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{profile.name}</span>
            <button className="ghost-button" onClick={() => setEditing(true)} style={{ marginLeft: 'auto' }}>
              编辑
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={styles.card}>
        <div style={styles.statRow}>
          <span>总场次</span><strong>{total}</strong>
        </div>
        <div style={styles.statRow}>
          <span>击杀</span><strong>{totalKills}</strong>
        </div>
        <div style={styles.statRow}>
          <span>死亡</span><strong>{totalDeaths}</strong>
        </div>
      </div>

      {/* Combat entry */}
      <button className="primary-button" style={styles.combatBtn} onClick={onCombat}>
        团战
      </button>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button className="secondary-button" style={styles.fab} onClick={onHistory}>
          战绩
        </button>
        <button className="secondary-button" style={styles.fab} onClick={onSettings}>
          设置
        </button>
      </div>
    </div>
  )
}

function RoomEntryScreen({
  onJoin,
  onBack
}: {
  onJoin: (address: string, code: string) => void
  onBack: () => void
}): React.JSX.Element {
  const [address, setAddress] = useState('')
  const [code, setCode] = useState('')

  return (
    <div style={styles.container}>
      <button className="ghost-button" style={styles.backBtn} onClick={onBack}>
        ← 返回
      </button>
      <h2 style={styles.heading}>加入房间</h2>
      <div style={styles.card}>
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label}>房主地址</label>
          <input
            style={{ width: '100%' }}
            placeholder="192.168.1.20:17890"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={styles.label}>房间号（4 位）</label>
          <input
            style={{ width: '100%', textAlign: 'center', letterSpacing: 8, fontSize: 20 }}
            maxLength={4}
            placeholder="0000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
        <button
          className="primary-button"
          style={{ width: '100%' }}
          disabled={address.length < 3 || code.length !== 4}
          onClick={() => onJoin(address, code)}
        >
          加入
        </button>
      </div>
    </div>
  )
}

function LobbyScreen({
  room,
  selfId,
  isHost,
  gallery,
  onReady,
  onTeam,
  onLeave
}: {
  room: RoomPublicState
  selfId: string
  isHost: boolean
  gallery: GalleryEntry[]
  onReady: (ready: boolean) => void
  onTeam: (team: Team) => void
  onLeave: () => void
}): React.JSX.Element {
  const self = room.players.find((p) => p.id === selfId)
  const myAppearance = gallery.find((g) => g.id === selfId)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.heading}>房间 {room.roomCode}</h2>
        <button className="ghost-button" onClick={onLeave}>离开</button>
      </div>

      {/* Players */}
      <div style={styles.card}>
        <h3 style={{ marginBottom: 8, fontSize: 14, color: 'var(--text-secondary)' }}>玩家列表</h3>
        {room.players.map((p) => (
          <div key={p.id} style={styles.playerRow}>
            <span style={{ ...styles.teamDot, background: p.team === 'red' ? 'var(--red)' : p.team === 'blue' ? 'var(--blue)' : 'var(--team-neutral)' }} />
            <span style={{ flex: 1 }}>{p.name}</span>
            {p.isHost && <span style={{ fontSize: 11, color: 'var(--accent)' }}>房主</span>}
            <span style={{ fontSize: 12, color: p.connected ? 'var(--success)' : 'var(--error)' }}>
              {p.connected ? (p.ready ? '已准备' : '未准备') : '离线'}
            </span>
          </div>
        ))}
      </div>

      {/* Team selection */}
      {self && !self.team && (
        <div style={styles.card}>
          <h3 style={{ marginBottom: 8, fontSize: 14 }}>选择队伍</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="secondary-button"
              style={{ flex: 1, borderColor: 'var(--red)', color: 'var(--red)' }}
              onClick={() => onTeam('red')}
            >
              红队
            </button>
            <button
              className="secondary-button"
              style={{ flex: 1, borderColor: 'var(--blue)', color: 'var(--blue)' }}
              onClick={() => onTeam('blue')}
            >
              蓝队
            </button>
          </div>
        </div>
      )}

      {/* Ready button */}
      {self && self.team && (
        <button
          className={self.ready ? 'secondary-button' : 'primary-button'}
          style={{ width: '100%' }}
          onClick={() => onReady(!self.ready)}
        >
          {self.ready ? '取消准备' : '准备'}
        </button>
      )}

      {/* Settings (read-only) */}
      <div style={styles.card}>
        <h3 style={{ marginBottom: 8, fontSize: 14 }}>比赛设置</h3>
        <div style={styles.statRow}>
          <span>时长</span><strong>{room.settings.durationMin} 分钟</strong>
        </div>
        <div style={styles.statRow}>
          <span>击杀上限</span><strong>{room.settings.killLimit} 杀</strong>
        </div>
      </div>

      {/* Enrollment status */}
      <div style={styles.card}>
        <h3 style={{ marginBottom: 8, fontSize: 14 }}>建档状态</h3>
        <div style={styles.statRow}>
          <span>本人</span>
          <strong style={{ color: myAppearance ? 'var(--success)' : 'var(--warning)' }}>
            {myAppearance ? '已建档' : '未建档'}
          </strong>
        </div>
      </div>
    </div>
  )
}

function BattleScreenPlaceholder(): React.JSX.Element {
  return (
    <div style={{ ...styles.center, flexDirection: 'column' }}>
      <h1 style={styles.title}>战斗页</h1>
      <p style={{ opacity: 0.5 }}>摄像头 + AR + 触屏输入（待实现）</p>
    </div>
  )
}

function ResultsScreen({
  result,
  onBack
}: {
  result: MatchResult
  onBack: () => void
}): React.JSX.Element {
  return (
    <div style={styles.container}>
      <h2 style={{ ...styles.heading, color: result.winner === 'red' ? 'var(--red)' : result.winner === 'blue' ? 'var(--blue)' : 'var(--text-secondary)' }}>
        {result.winner === 'red' ? '红队' : result.winner === 'blue' ? '蓝队' : '平局'} 获胜
      </h2>
      <div style={{ ...styles.card, textAlign: 'center', fontSize: 32, fontWeight: 700, margin: '16px 0' }}>
        {result.score.red} : {result.score.blue}
      </div>
      {result.players.map((p) => (
        <div key={p.id} style={styles.playerRow}>
          <span style={{ ...styles.teamDot, background: p.team === 'red' ? 'var(--red)' : 'var(--blue)' }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <span>{p.kills}/{p.deaths} ({Math.round(p.accuracy * 100)}%)</span>
        </div>
      ))}
      <button className="primary-button" style={{ width: '100%', marginTop: 16 }} onClick={onBack}>
        返回
      </button>
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, kind }: { message: string; kind: 'info' | 'success' | 'error' }): React.JSX.Element {
  const bg = kind === 'success' ? 'var(--success)' : kind === 'error' ? 'var(--error)' : 'var(--blue)'
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: bg, color: '#fff', padding: '10px 20px', borderRadius: 6, fontSize: 13, zIndex: 9999 }}>
      {message}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100%',
    height: '100%',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: 'Bahnschrift, "Microsoft YaHei", "Segoe UI", sans-serif',
    overflow: 'auto'
  },
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '16px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0
  },
  sub: {
    fontSize: 11,
    opacity: 0.5,
    margin: '2px 0 0'
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
    margin: 0
  },
  card: {
    background: 'var(--bg-panel)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: 16
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: 14,
    borderBottom: '1px solid rgba(255,255,255,0.04)'
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: 14,
    borderBottom: '1px solid rgba(255,255,255,0.04)'
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginRight: 8,
    flexShrink: 0
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
    color: '#000'
  },
  combatBtn: {
    width: '100%',
    padding: 16,
    fontSize: 18,
    marginTop: 8
  },
  fab: {
    flex: 1,
    textAlign: 'center',
    padding: '12px 0'
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginBottom: 4
  }
}
