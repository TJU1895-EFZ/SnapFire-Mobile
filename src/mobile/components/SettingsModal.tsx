/**
 * Settings modal — mobile version.
 *
 * Mobile-only options: volume, detection quality, camera selection, clear data.
 * No backup/export/import, no Field Test log, no debug panel.
 */

import { useCallback, useEffect, useState } from 'react'
import { audio } from '@mobile/game/audio'
import { listCameras } from '@mobile/hooks/useCamera'
import { storage } from '@mobile/storage'
import type { AppSettings, DetectionQuality } from '@shared/types'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
  onClose: () => void
}

const QUALITY_LABELS: Record<DetectionQuality, string> = {
  performance: '性能',
  balanced: '均衡',
  accurate: '精准'
}

export function SettingsModal({ settings, onChange, onClose }: Props): React.JSX.Element {
  const [volume, setVolume] = useState(settings.volume)
  const [quality, setQuality] = useState<DetectionQuality>(settings.detectionQuality)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraId, setCameraId] = useState(settings.cameraDeviceId ?? '')
  const [showConfirm, setShowConfirm] = useState(false)

  // Load camera list.
  useEffect(() => {
    void listCameras().then(setCameras)
  }, [])

  // Sync volume to audio engine (with debounce).
  useEffect(() => {
    const timer = setTimeout(() => {
      audio.setVolume(volume)
      onChange({ volume })
    }, 100)
    return () => clearTimeout(timer)
  }, [volume, onChange])

  // Sync quality change.
  const handleQuality = useCallback(
    (q: DetectionQuality) => {
      setQuality(q)
      onChange({ detectionQuality: q })
    },
    [onChange]
  )

  // Sync camera change.
  const handleCamera = useCallback(
    (id: string) => {
      setCameraId(id)
      onChange({ cameraDeviceId: id || null })
    },
    [onChange]
  )

  // Clear all data.
  const handleReset = useCallback(async () => {
    await storage.resetAll()
    setShowConfirm(false)
    onClose()
    // Force reload to reset app state.
    window.location.reload()
  }, [onClose])

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="设置"
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>设置</h2>
          <button className="ghost-button" onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>

        <div style={styles.body}>
          {/* Volume */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>音量</label>
            <div style={styles.sliderRow}>
              <span style={{ fontSize: 12, opacity: 0.5 }}>🔈</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{ flex: 1, margin: '0 12px' }}
              />
              <span style={{ fontSize: 12, opacity: 0.5 }}>🔊</span>
              <span style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>

          {/* Detection quality */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>识别质量</label>
            <div style={styles.qualityRow}>
              {(Object.keys(QUALITY_LABELS) as DetectionQuality[]).map((q) => (
                <button
                  key={q}
                  className={quality === q ? 'primary-button' : 'secondary-button'}
                  style={{
                    flex: 1,
                    ...(quality !== q ? { borderColor: 'rgba(255,255,255,0.12)', color: 'var(--text-secondary)' } : {})
                  }}
                  onClick={() => handleQuality(q)}
                >
                  {QUALITY_LABELS[q]}
                </button>
              ))}
            </div>
          </div>

          {/* Camera selection */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>摄像头</label>
            <select
              value={cameraId}
              onChange={(e) => handleCamera(e.target.value)}
              style={styles.select}
            >
              <option value="">默认摄像头（优先后置）</option>
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `摄像头 ${cam.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
            <p className="tiny muted" style={{ marginTop: 6 }}>
              下次进入战斗或建档时生效。若列表为空，请先在建档页允许摄像头权限。
            </p>
          </div>

          {/* Clear data */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>数据管理</label>
            {showConfirm ? (
              <div style={styles.confirmRow}>
                <span style={{ fontSize: 13, color: 'var(--error)', flex: 1 }}>
                  确定要清除所有本地数据吗？此操作不可撤销。
                </span>
                <button className="primary-button" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleReset}>
                  确认清除
                </button>
                <button className="ghost-button" style={{ fontSize: 12 }} onClick={() => setShowConfirm(false)}>
                  取消
                </button>
              </div>
            ) : (
              <button
                className="secondary-button"
                style={{ color: 'var(--error)', borderColor: 'rgba(224,64,64,0.3)' }}
                onClick={() => setShowConfirm(true)}
              >
                清除本地数据
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding:
      'max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))',
    zIndex: 1000
  },
  modal: {
    background: 'var(--bg-secondary)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90dvh',
    overflow: 'auto'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0
  },
  closeBtn: {
    fontSize: 18,
    padding: 4
  },
  body: {
    padding: 16
  },
  section: {
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)'
  },
  sectionTitle: {
    display: 'block',
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginBottom: 8
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center'
  },
  qualityRow: {
    display: 'flex',
    gap: 8
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    fontSize: 14,
    outline: 'none',
    appearance: 'none' as const
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  }
}
