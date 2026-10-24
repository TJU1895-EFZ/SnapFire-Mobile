import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'error'

export interface CameraResolution {
  width: number
  height: number
}

function describeCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return '摄像头权限被拒绝。请在 Windows 设置 → 隐私和安全性 → 摄像头 中允许应用访问摄像头。'
      case 'NotFoundError':
        return '没有找到可用的摄像头。'
      case 'NotReadableError':
        return '摄像头正被其他程序占用，请关闭占用摄像头的程序后重试。'
      case 'OverconstrainedError':
        return '当前摄像头不支持请求的画面规格，请换一个摄像头。'
      case 'SecurityError':
        return '当前环境不允许访问摄像头。'
      default:
        break
    }
  }
  if (error instanceof Error && error.message) return error.message
  return '无法打开摄像头，请检查设备和权限设置。'
}

async function getStream(deviceId: string | null): Promise<MediaStream> {
  const base: MediaTrackConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30, min: 15 }
  }
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...base, deviceId: { exact: deviceId } }
      })
    } catch (error) {
      // A saved device may have been unplugged. Fall back to the default camera.
      if (
        error instanceof DOMException &&
        (error.name === 'OverconstrainedError' || error.name === 'NotFoundError')
      ) {
        return navigator.mediaDevices.getUserMedia({ audio: false, video: base })
      }
      throw error
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: false, video: base })
}

export function useCamera(options?: {
  autoStart?: boolean
  deviceId?: string | null
}): {
  videoRef: React.RefObject<HTMLVideoElement | null>
  status: CameraStatus
  error: string | null
  resolution: CameraResolution | null
  start: (deviceId?: string | null) => Promise<void>
  stop: () => void
} {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startingRef = useRef(false)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resolution, setResolution] = useState<CameraResolution | null>(null)

  const stop = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
    }
    const video = videoRef.current
    if (video) {
      try {
        video.pause()
      } catch {
        // ignore
      }
      video.srcObject = null
    }
    setStatus('idle')
    setResolution(null)
  }, [])

  const start = useCallback(async (deviceId?: string | null) => {
    if (startingRef.current) return
    startingRef.current = true
    setStatus('starting')
    setError(null)
    setResolution(null)
    const existing = streamRef.current
    if (existing) {
      streamRef.current = null
      for (const track of existing.getTracks()) track.stop()
    }
    try {
      const stream = await getStream(deviceId ?? null)
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('摄像头画面元素尚未就绪')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      if (video.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            cleanup()
            resolve()
          }
          const onError = () => {
            cleanup()
            reject(new Error('无法读取摄像头画面'))
          }
          const cleanup = () => {
            video.removeEventListener('loadedmetadata', onLoaded)
            video.removeEventListener('error', onError)
          }
          video.addEventListener('loadedmetadata', onLoaded)
          video.addEventListener('error', onError)
        })
      }
      await video.play()
      setResolution({
        width: video.videoWidth,
        height: video.videoHeight
      })
      setStatus('ready')
    } catch (caught) {
      const message = describeCameraError(caught)
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop()
        streamRef.current = null
      }
      const video = videoRef.current
      if (video) video.srcObject = null
      setError(message)
      setStatus('error')
    } finally {
      startingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (options?.autoStart) {
      void start(options.deviceId ?? null)
    }
    return () => stop()
    // Intentionally only run on mount/unmount. A device change is handled by
    // the settings screen calling start() explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { videoRef, status, error, resolution, start, stop }
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((device) => device.kind === 'videoinput')
  } catch {
    return []
  }
}
