import type { BodyResult, FaceResult } from '@vladmandic/human'
import type { ClothingDescriptor, EnrollmentView } from '@shared/types'
import { detectWithHuman, getHuman } from './human'
import { extractClothingDescriptor } from './descriptors'

export interface EnrollmentCapture {
  view: EnrollmentView
  clothing: ClothingDescriptor
  faceEmbedding: number[] | null
  thumbnail: string
  bodyScore: number
  faceDetected: boolean
}

function makeThumbnail(video: HTMLVideoElement): string {
  const targetW = 320
  const targetH = 240
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const vw = video.videoWidth
  const vh = video.videoHeight
  const scale = Math.max(targetW / vw, targetH / vh)
  const sw = targetW / scale
  const sh = targetH / scale
  const sx = (vw - sw) / 2
  const sy = (vh - sh) / 2
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH)
  return canvas.toDataURL('image/jpeg', 0.72)
}

function pickEnrollmentBody(bodies: BodyResult[]): BodyResult | null {
  return (
    bodies
      .filter((body) => body.score >= 0.18 && body.boxRaw[2] > 0 && body.boxRaw[3] > 0)
      .sort(
        (a, b) =>
          b.boxRaw[2] * b.boxRaw[3] - a.boxRaw[2] * a.boxRaw[3]
      )[0] ?? null
  )
}

function pickEnrollmentFace(
  faces: FaceResult[],
  body: BodyResult,
  canvasWidth: number
): FaceResult | null {
  const [bx, by, bw, bh] = body.boxRaw
  return (
    faces
      .filter((face) => Boolean(face.embedding))
      .filter((face) => face.boxRaw[2] * canvasWidth >= 28)
      .filter((face) => {
        const [fx, fy, fw, fh] = face.boxRaw
        const cx = fx + fw / 2
        const cy = fy + fh / 2
        return (
          cx >= bx - 0.1 &&
          cx <= bx + bw + 0.1 &&
          cy >= by - 0.1 &&
          cy <= by + bh + 0.1
        )
      })
      .sort((a, b) => b.boxScore - a.boxScore)[0] ?? null
  )
}

/**
 * Captures one enrolment view: extracts the outfit descriptor and, when a
 * usable face is visible, a face embedding. Throws a user-facing error when
 * no person can be found.
 */
export async function captureEnrollmentFrame(
  video: HTMLVideoElement,
  view: EnrollmentView
): Promise<EnrollmentCapture> {
  if (video.readyState < 2 || video.videoWidth <= 0) {
    throw new Error('摄像头尚未就绪，请稍等一下再采集')
  }
  const vw = video.videoWidth
  const vh = video.videoHeight
  const maxWidth = 1280
  const scale = Math.min(1, maxWidth / vw)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(vw * scale))
  canvas.height = Math.max(1, Math.round(vh * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建图像分析画布')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  await getHuman()
  const result = await detectWithHuman(canvas)
  const body = pickEnrollmentBody(result.body)
  if (!body) {
    throw new Error('没有检测到人体。请后退一些，让上半身或全身进入画面后重试')
  }
  const clothing = extractClothingDescriptor(canvas, canvas.width, canvas.height, body, view)
  if (!clothing) {
    throw new Error('无法提取衣着特征，请调整站位或光线后重试')
  }
  const face = pickEnrollmentFace(result.face, body, canvas.width)
  return {
    view,
    clothing,
    faceEmbedding: face?.embedding ?? null,
    thumbnail: makeThumbnail(video),
    bodyScore: body.score,
    faceDetected: Boolean(face?.embedding)
  }
}
