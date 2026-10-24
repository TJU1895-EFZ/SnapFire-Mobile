import * as THREE from 'three'

export type LockState = 'none' | 'unknown' | 'enemy' | 'teammate'

function makeRadialTexture(
  inner: string,
  middle: string,
  outer: string,
  size = 128
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建纹理画布')
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  )
  gradient.addColorStop(0, inner)
  gradient.addColorStop(0.2, middle)
  gradient.addColorStop(0.55, outer)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeFlashTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建枪口火焰纹理')
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.12, 'rgba(255,245,190,1)')
  gradient.addColorStop(0.32, 'rgba(255,185,70,0.9)')
  gradient.addColorStop(0.6, 'rgba(255,100,20,0.3)')
  gradient.addColorStop(1, 'rgba(255,60,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = 'rgba(255,235,170,0.85)'
  ctx.lineWidth = 3
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(64 + Math.cos(angle) * 12, 64 + Math.sin(angle) * 12)
    ctx.lineTo(64 + Math.cos(angle) * 58, 64 + Math.sin(angle) * 58)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  position: [number, number, number],
  rotation?: [number, number, number]
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(...position)
  if (rotation) mesh.rotation.set(...rotation)
  return mesh
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: THREE.Material,
  position: [number, number, number],
  rotation?: [number, number, number],
  segments = 16
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material
  )
  mesh.position.set(...position)
  if (rotation) mesh.rotation.set(...rotation)
  return mesh
}

function limb(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radiusStart: number,
  radiusEnd: number,
  material: THREE.Material
): THREE.Mesh {
  const direction = end.clone().sub(start)
  const length = direction.length()
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusEnd, radiusStart, length, 14, 1),
    material
  )
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  )
  return mesh
}

/**
 * First-person weapon view model. The camera feed is rendered by the DOM video
 * element behind this transparent WebGL canvas, so the gun/arms appear as an
 * AR overlay on top of the real world.
 */
export class BattleScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly weapon: THREE.Group
  private readonly basePosition = new THREE.Vector3()
  private readonly baseQuaternion = new THREE.Quaternion()
  private readonly muzzleFlash: THREE.Sprite
  private readonly muzzleGlow: THREE.Sprite
  private readonly muzzleLight: THREE.PointLight
  private readonly sightDot: THREE.Sprite
  private readonly dotTexture: THREE.CanvasTexture
  private readonly flashTexture: THREE.CanvasTexture
  private readonly clock = new THREE.Clock()
  private raf = 0
  private recoil = 0
  private flashUntil = 0
  private lockState: LockState = 'none'
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.01, 100)
    this.scene.add(this.camera)

    const ambient = new THREE.HemisphereLight(0xc7d9e8, 0x241c12, 1.0)
    this.scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffd7ad, 2.0)
    key.position.set(1.5, 2.2, 1.2)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x8fc4ff, 1.0)
    rim.position.set(-1.5, 0.6, -1.6)
    this.scene.add(rim)
    const fill = new THREE.PointLight(0xffe2bd, 0.55, 2.8, 2)
    fill.position.set(0.4, 0.18, 0.25)
    this.scene.add(fill)

    const metal = new THREE.MeshStandardMaterial({
      color: 0x2f353a,
      metalness: 0.7,
      roughness: 0.32
    })
    const metalDark = new THREE.MeshStandardMaterial({
      color: 0x171b1e,
      metalness: 0.58,
      roughness: 0.48
    })
    const polymer = new THREE.MeshStandardMaterial({
      color: 0x23282b,
      metalness: 0.08,
      roughness: 0.8
    })
    const accent = new THREE.MeshStandardMaterial({
      color: 0x3a4247,
      metalness: 0.55,
      roughness: 0.4
    })
    const fabric = new THREE.MeshStandardMaterial({
      color: 0x3a4034,
      metalness: 0.02,
      roughness: 0.94
    })
    const fabricDark = new THREE.MeshStandardMaterial({
      color: 0x20241d,
      metalness: 0.02,
      roughness: 0.97
    })
    const glove = new THREE.MeshStandardMaterial({
      color: 0x22272a,
      metalness: 0.06,
      roughness: 0.82
    })

    this.weapon = new THREE.Group()
    const basePos = new THREE.Vector3(0.245, -0.255, -0.6)
    const target = new THREE.Vector3(0, -0.012, -2.6)
    const look = new THREE.Matrix4().lookAt(basePos, target, new THREE.Vector3(0, 1, 0))
    this.weapon.quaternion.setFromRotationMatrix(look)
    this.weapon.position.copy(basePos)
    this.weapon.scale.setScalar(0.74)
    this.camera.add(this.weapon)
    this.basePosition.copy(this.weapon.position)
    this.baseQuaternion.copy(this.weapon.quaternion)

    // --- Rifle -------------------------------------------------------------
    this.weapon.add(box(0.085, 0.105, 0.38, metal, [0, 0, -0.09]))
    this.weapon.add(box(0.072, 0.028, 0.36, accent, [0, 0.067, -0.1]))
    this.weapon.add(box(0.076, 0.086, 0.31, metalDark, [0, 0.004, -0.43]))
    this.weapon.add(box(0.082, 0.02, 0.28, accent, [0, 0.047, -0.44]))
    this.weapon.add(box(0.066, 0.018, 0.24, metalDark, [0, -0.043, -0.45]))
    this.weapon.add(box(0.062, 0.085, 0.2, polymer, [0, -0.005, 0.19]))
    this.weapon.add(box(0.074, 0.115, 0.055, polymer, [0, -0.008, 0.295]))
    this.weapon.add(box(0.05, 0.135, 0.062, polymer, [0, -0.105, 0.02], [-0.28, 0, 0]))
    this.weapon.add(box(0.056, 0.17, 0.1, metalDark, [0, -0.13, -0.1], [0.18, 0, 0]))
    this.weapon.add(box(0.058, 0.02, 0.09, accent, [0, -0.052, -0.1]))

    // Barrel + muzzle brake.
    this.weapon.add(
      cylinder(0.013, 0.014, 0.3, metal, [0, 0.004, -0.72], [Math.PI / 2, 0, 0], 18)
    )
    this.weapon.add(
      cylinder(0.021, 0.019, 0.075, metalDark, [0, 0.004, -0.9], [Math.PI / 2, 0, 0], 14)
    )
    this.weapon.add(
      cylinder(0.017, 0.017, 0.05, metal, [0, 0.004, -0.945], [Math.PI / 2, 0, 0], 14)
    )
    // Handguard vents and accent strip.
    for (let i = 0; i < 4; i += 1) {
      this.weapon.add(box(0.078, 0.008, 0.03, metalDark, [0, 0.026, -0.33 - i * 0.055]))
    }
    this.weapon.add(box(0.004, 0.008, 0.2, metal, [0.043, 0.005, -0.43]))
    this.weapon.add(
      box(
        0.005,
        0.01,
        0.22,
        new THREE.MeshBasicMaterial({ color: 0xff9d2e }),
        [0.046, 0.032, -0.43]
      )
    )

    // Optic: base, frame, rear/front glass planes, red dot.
    this.weapon.add(box(0.05, 0.022, 0.1, metalDark, [0, 0.09, -0.1]))
    this.weapon.add(box(0.006, 0.07, 0.075, metalDark, [-0.028, 0.135, -0.1]))
    this.weapon.add(box(0.006, 0.07, 0.075, metalDark, [0.028, 0.135, -0.1]))
    this.weapon.add(box(0.056, 0.006, 0.075, metalDark, [0, 0.168, -0.1]))
    this.weapon.add(box(0.056, 0.006, 0.075, metalDark, [0, 0.102, -0.1]))
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.048, 0.058),
      new THREE.MeshBasicMaterial({
        color: 0x6fd0ff,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide
      })
    )
    glass.position.set(0, 0.135, -0.126)
    this.weapon.add(glass)

    // Muzzle flash and light.
    this.flashTexture = makeFlashTexture()
    this.dotTexture = makeRadialTexture(
      'rgba(255,255,255,1)',
      'rgba(255,70,50,0.95)',
      'rgba(255,20,10,0.3)',
      64
    )
    const flashMaterial = new THREE.SpriteMaterial({
      map: this.flashTexture,
      color: 0xffc070,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    })
    this.muzzleFlash = new THREE.Sprite(flashMaterial)
    this.muzzleFlash.position.set(0, 0.004, -0.98)
    this.muzzleFlash.scale.set(0.34, 0.34, 0.34)
    this.muzzleFlash.renderOrder = 20
    this.weapon.add(this.muzzleFlash)

    const glowMaterial = flashMaterial.clone()
    glowMaterial.opacity = 0
    this.muzzleGlow = new THREE.Sprite(glowMaterial)
    this.muzzleGlow.position.set(0, 0.004, -0.99)
    this.muzzleGlow.scale.set(0.62, 0.62, 0.62)
    this.muzzleGlow.renderOrder = 19
    this.weapon.add(this.muzzleGlow)

    this.muzzleLight = new THREE.PointLight(0xffa54a, 0, 3.5, 2)
    this.muzzleLight.position.set(0, 0.004, -0.95)
    this.weapon.add(this.muzzleLight)

    // Red dot sight reticle.
    const dotMaterial = new THREE.SpriteMaterial({
      map: this.dotTexture,
      color: 0xff3b30,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    })
    this.sightDot = new THREE.Sprite(dotMaterial)
    this.sightDot.position.set(0, 0.135, -0.082)
    this.sightDot.scale.set(0.016, 0.016, 0.016)
    this.sightDot.renderOrder = 30
    this.weapon.add(this.sightDot)

    // --- Arms --------------------------------------------------------------
    const rightElbow = new THREE.Vector3(0.19, -0.47, 0.3)
    const rightWrist = new THREE.Vector3(0.025, -0.14, 0.045)
    const leftElbow = new THREE.Vector3(-0.18, -0.48, 0.08)
    const leftWrist = new THREE.Vector3(-0.018, -0.032, -0.4)
    this.weapon.add(limb(rightElbow, rightWrist, 0.048, 0.034, fabric))
    this.weapon.add(limb(leftElbow, leftWrist, 0.05, 0.036, fabric))
    // Dark cuffs.
    this.weapon.add(limb(
      rightWrist.clone().add(new THREE.Vector3(0.03, -0.06, 0.04)),
      rightWrist,
      0.041,
      0.031,
      fabricDark
    ))
    this.weapon.add(limb(
      leftWrist.clone().add(new THREE.Vector3(-0.035, -0.07, 0.05)),
      leftWrist,
      0.042,
      0.032,
      fabricDark
    ))
    // Gloves.
    const rightGlove = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), glove)
    rightGlove.scale.set(0.055, 0.072, 0.06)
    rightGlove.position.set(0.008, -0.135, 0.02)
    this.weapon.add(rightGlove)
    const leftGlove = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), glove)
    leftGlove.scale.set(0.052, 0.06, 0.07)
    leftGlove.position.set(-0.006, -0.03, -0.405)
    this.weapon.add(leftGlove)
    // Knuckle plates.
    this.weapon.add(box(0.045, 0.018, 0.05, metalDark, [0.02, -0.1, 0.025], [0.2, 0, 0]))
    this.weapon.add(box(0.04, 0.016, 0.05, metalDark, [0.004, 0.006, -0.43], [0.2, 0, 0]))

    this.resize(
      canvas.clientWidth || window.innerWidth,
      canvas.clientHeight || window.innerHeight
    )
  }

  start(): void {
    if (this.raf) return
    this.clock.start()
    const animate = () => {
      if (this.disposed) return
      this.raf = requestAnimationFrame(animate)
      this.update()
    }
    this.raf = requestAnimationFrame(animate)
  }

  fire(): void {
    if (this.disposed) return
    this.recoil = 1
    this.flashUntil = performance.now() + 120
  }

  setLock(state: LockState): void {
    if (this.disposed || this.lockState === state) return
    this.lockState = state
    const material = this.sightDot.material as THREE.SpriteMaterial
    if (state === 'enemy') {
      material.color.setHex(0xff2a1f)
      this.sightDot.scale.set(0.022, 0.022, 0.022)
    } else if (state === 'teammate') {
      material.color.setHex(0x3f9bff)
      this.sightDot.scale.set(0.018, 0.018, 0.018)
    } else if (state === 'unknown') {
      material.color.setHex(0xffb02e)
      this.sightDot.scale.set(0.018, 0.018, 0.018)
    } else {
      material.color.setHex(0xff3b30)
      this.sightDot.scale.set(0.016, 0.016, 0.016)
    }
  }

  resize(width: number, height: number): void {
    if (this.disposed) return
    const safeWidth = Math.max(1, width)
    const safeHeight = Math.max(1, height)
    this.renderer.setSize(safeWidth, safeHeight, false)
    this.camera.aspect = safeWidth / safeHeight
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) material.dispose()
      } else if (object instanceof THREE.Sprite) {
        object.material.dispose()
      }
    })
    this.flashTexture.dispose()
    this.dotTexture.dispose()
    this.renderer.dispose()
  }

  private update(): void {
    const dt = Math.min(0.05, this.clock.getDelta())
    const t = this.clock.elapsedTime
    this.recoil = Math.max(0, this.recoil - dt * 6.2)

    const swayX = Math.sin(t * 0.9) * 0.0018
    const swayY = Math.cos(t * 1.17) * 0.0014
    this.weapon.position.copy(this.basePosition)
    this.weapon.position.x += swayX
    this.weapon.position.y += swayY
    this.weapon.position.z += this.recoil * 0.035
    this.weapon.position.y += this.recoil * 0.012
    this.weapon.quaternion.copy(this.baseQuaternion)
    this.weapon.rotateX(this.recoil * 0.06)
    this.weapon.rotateZ(Math.sin(t * 0.7) * 0.004)

    const now = performance.now()
    const flash = now < this.flashUntil ? Math.max(0, (this.flashUntil - now) / 120) : 0
    ;(this.muzzleFlash.material as THREE.SpriteMaterial).opacity = flash
    ;(this.muzzleGlow.material as THREE.SpriteMaterial).opacity = flash * 0.55
    this.muzzleLight.intensity = flash * 9
    this.muzzleFlash.scale.setScalar(0.3 + flash * 0.1)
    this.muzzleGlow.scale.setScalar(0.55 + flash * 0.2)

    const dot = this.sightDot.material as THREE.SpriteMaterial
    dot.opacity = 0.8 + Math.sin(t * 2.2) * 0.12

    this.renderer.render(this.scene, this.camera)
  }
}
