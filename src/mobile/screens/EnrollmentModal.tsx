import { useEffect, useMemo, useState } from 'react'
import type { AppearanceData, EnrollmentView } from '@shared/types'
import { useCamera } from '@mobile/hooks/useCamera'
import { captureEnrollmentFrame, type EnrollmentCapture } from '@mobile/vision/enrollment'
import { warmupHuman } from '@mobile/vision/human'
import { IconCamera, IconCheck, IconClose, IconRefresh, IconShield } from '@mobile/components/Icons'

interface Props {
  cameraDeviceId: string | null
  existing: AppearanceData | null
  onClose: () => void
  onSave: (appearance: AppearanceData) => Promise<void> | void
}

const VIEW_LABEL: Record<EnrollmentView, string> = {
  front: '正面',
  back: '背面',
  left: '左侧',
  right: '右侧',
  other: '其他'
}

export function EnrollmentModal({
  cameraDeviceId,
  existing,
  onClose,
  onSave
}: Props): React.JSX.Element {
  const { videoRef, status, error: cameraError, resolution, start } = useCamera({
    autoStart: true,
    deviceId: cameraDeviceId
  })
  const [captures, setCaptures] = useState<EnrollmentCapture[]>([])
  const [busyView, setBusyView] = useState<EnrollmentView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [engineReady, setEngineReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    warmupHuman()
      .then(() => {
        if (!cancelled) setEngineReady(true)
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? `识别引擎加载失败：${caught.message}`
              : '识别引擎加载失败'
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const byView = useMemo(() => {
    const map = new Map<EnrollmentView, EnrollmentCapture>()
    for (const capture of captures) map.set(capture.view, capture)
    return map
  }, [captures])

  const front = byView.get('front')
  const back = byView.get('back')
  const cameraReady = status === 'ready'
  const canCapture = cameraReady && engineReady && !busyView && !saving
  const canSave = Boolean(front && back) && !saving

  const capture = async (view: 'front' | 'back' | 'left'): Promise<void> => {
    const video = videoRef.current
    if (!video) return
    setBusyView(view)
    setError(null)
    setNotice(null)
    try {
      const result = await captureEnrollmentFrame(video, view)
      setCaptures((current) => [
        ...current.filter((item) => item.view !== view),
        result
      ])
      if (!result.faceDetected) {
        setNotice(
          '这张画面没有识别到清晰人脸，身份将主要依靠衣着特征（仍然可以保存）。'
        )
      } else {
        setNotice(`已采集${VIEW_LABEL[view]}：人脸 + 衣着特征都提取成功。`)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '采集失败，请重试')
    } finally {
      setBusyView(null)
    }
  }

  const save = async (): Promise<void> => {
    if (!front || !back) {
      setError('请至少采集正面和背面两个视角')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const faceEmbeddings: number[][] = []
      for (const capture of captures) {
        if (capture.faceEmbedding) faceEmbeddings.push(capture.faceEmbedding)
      }
      if (faceEmbeddings.length === 0 && existing?.faceEmbeddings.length) {
        faceEmbeddings.push(...existing.faceEmbeddings)
      }
      const appearance: AppearanceData = {
        version: 1,
        faceEmbeddings: faceEmbeddings.slice(0, 6),
        clothing: captures.map((item) => item.clothing),
        updatedAt: Date.now()
        // No thumbnail is persisted: the PRD requires that no photo-like
        // preview is stored locally. Capture previews live in memory only.
      }
      await onSave(appearance)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存建档失败，请重试')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="赛前建档">
      <div className="modal-panel">
        <header className="modal-head">
          <div>
            <p className="screen__subtitle" style={{ marginBottom: 2 }}>
              Pre-match enrolment
            </p>
            <h2 className="screen__heading">人脸与衣着建档</h2>
          </div>
          <button
            className="ghost-button"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭"
          >
            <IconClose />
          </button>
        </header>

        <div className="modal-body">
          <div className="enroll-layout">
            <div>
              <div className="enroll-camera">
                <video ref={videoRef} autoPlay muted playsInline />
                <div className="enroll-guide" aria-hidden="true" />
                <div className="enroll-status">
                  {status === 'starting' && (
                    <span className="pill pill--warning">正在打开摄像头…</span>
                  )}
                  {status === 'error' && (
                    <span className="pill pill--error">摄像头不可用</span>
                  )}
                  {status === 'ready' && (
                    <span className="pill pill--success">
                      摄像头已就绪
                      {resolution ? ` · ${resolution.width}×${resolution.height}` : ''}
                    </span>
                  )}
                  {status === 'ready' && !engineReady && (
                    <span className="pill pill--warning">识别引擎加载中…</span>
                  )}
                </div>
              </div>

              {cameraError && (
                <div className="notice notice--error" style={{ marginTop: 10 }}>
                  {cameraError}
                  <button
                    className="ghost-button"
                    style={{ marginLeft: 8 }}
                    onClick={() => void start(cameraDeviceId)}
                  >
                    <IconRefresh /> 重试
                  </button>
                </div>
              )}

              {existing?.thumbnail && captures.length === 0 && (
                <div className="capture-item" style={{ marginTop: 10 }}>
                  <img src={existing.thumbnail} alt="当前建档预览" />
                  <div>
                    <div>当前已有建档</div>
                    <div className="tiny muted">
                      {existing.clothing.length} 个衣着视角 ·{' '}
                      {existing.faceEmbeddings.length} 个人脸特征
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="enroll-side">
              <div className="notice notice--info">
                <strong>采集步骤</strong>
                <div style={{ marginTop: 4 }}>
                  站在摄像头前 2~4 米，让上半身或全身进入画面。先正面采集，再转身背面；
                  侧身可选。保持光线充足，避免逆光。
                </div>
              </div>

              <button
                className={`capture-button${front ? ' is-done' : ''}`}
                onClick={() => void capture('front')}
                disabled={!canCapture}
              >
                <IconCamera />
                <span className="grow">
                  {busyView === 'front' ? '分析中…' : '采集正面'}
                </span>
                {front && <IconCheck />}
              </button>
              <button
                className={`capture-button${back ? ' is-done' : ''}`}
                onClick={() => void capture('back')}
                disabled={!canCapture}
              >
                <IconCamera />
                <span className="grow">
                  {busyView === 'back' ? '分析中…' : '采集背面'}
                </span>
                {back && <IconCheck />}
              </button>
              <button
                className={`capture-button capture-button--ghost${
                  byView.get('left') ? ' is-done' : ''
                }`}
                onClick={() => void capture('left')}
                disabled={!canCapture}
              >
                <IconCamera />
                <span className="grow">
                  {busyView === 'left' ? '分析中…' : '采集侧面（可选）'}
                </span>
                {byView.get('left') && <IconCheck />}
              </button>

              <div className="capture-list">
                {(['front', 'back', 'left'] as const).map((view) => {
                  const item = byView.get(view)
                  return (
                    <div className="capture-item" key={view}>
                      {item ? (
                        <img src={item.thumbnail} alt={`${VIEW_LABEL[view]}预览`} />
                      ) : (
                        <div className="capture-item__placeholder">未采集</div>
                      )}
                      <div className="grow">
                        <div>{VIEW_LABEL[view]}</div>
                        <div className="tiny muted">
                          {item
                            ? item.faceDetected
                              ? '人脸 + 衣着'
                              : '仅衣着'
                            : '—'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {notice && <div className="notice notice--success">{notice}</div>}
              {error && <div className="notice notice--error">{error}</div>}

              <p className="tiny muted" style={{ display: 'flex', gap: 6 }}>
                <IconShield />
                原始照片只保存在本机；房间内只同步识别特征，不上传照片。
              </p>

              <div className="button-row">
                <button
                  className="primary-button grow"
                  onClick={() => void save()}
                  disabled={!canSave}
                >
                  {saving ? '保存中…' : '保存建档'}
                </button>
                <button className="secondary-button" onClick={onClose} disabled={saving}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
