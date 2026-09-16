import {
  noise,
  sequenceFragment,
  sequenceVertex,
  particleFragment,
  particleVertex,
} from './shaders'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import gsap from 'gsap'
import type { LedgerCard } from '@/lib/vault-ui'
import { ledgerTexture } from './ledger-texture'

export type Phase = 'loading' | 'separating' | 'intro' | 'revealed' | 'ready'
type Callbacks = {
  progress: (n: number) => void
  phase: (p: Phase) => void
  select: (p: LedgerCard) => void
  error: (e: unknown) => void
}
const asset = (path: string) => `/reference/${path}`

const galleryVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const galleryFragment = `
uniform sampler2D colorMap;
uniform float opacity, hover;
varying vec2 vUv;
void main(){
  vec3 color=texture2D(colorMap,vUv).rgb;
  color += vec3(.015,.035,.02)*hover;
  gl_FragColor=vec4(color*opacity,1.);
}`

const distortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    distortion: { value: new THREE.Vector2() },
  },
  vertexShader: galleryVertex,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 distortion; varying vec2 vUv;
  void main(){vec2 p=2.*(vUv-.5);vec2 uv=(.88+distortion*dot(p,p))*p*.5+.5;
  vec3 c=texture2D(tDiffuse,clamp(uv,0.,1.)).rgb;
  if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)c=vec3(0.);
  float d=distance(vUv,vec2(.5));c*=smoothstep(.8,.6*.799,1.2*d);
  gl_FragColor=vec4(c,1.);}`,
}

/** A fresh renderer around the observed assets/timeline, without the source site's runtime. */
export class Experience {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(85, 1, 0.001, 1000)
  private composer: EffectComposer
  private distortion = new ShaderPass(distortionShader)
  private intro = new THREE.Group()
  private gallery = new THREE.Group()
  private textures: THREE.Texture[] = []
  private cards: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = []
  private frames: THREE.Texture[] = []
  private sequence?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private particles?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  private timeline?: gsap.core.Timeline
  private liveCards: LedgerCard[] = []
  private cardTextures = new Map<
    string,
    { signature: string; texture: THREE.Texture }
  >()
  private raf = 0
  private disposed = false
  private started = -1
  private assetsReady = false
  private skipped = false
  private interactive = false
  private active = true
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  private mobile = innerWidth < 1024
  private loadingTimer?: ReturnType<typeof setTimeout>
  private watchdog?: ReturnType<typeof setTimeout>
  private abort = new AbortController()
  private offset = new THREE.Vector2()
  private target = new THREE.Vector2()
  private pointer = new THREE.Vector2(10, 10)
  private raycaster = new THREE.Raycaster()
  private down?: { x: number; y: number; moved: number }
  private lastFrame = performance.now()
  private hover?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private revealed = false

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: Callbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.renderer.setClearColor(0x000000)
    this.camera.position.z = 3.43
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.composer.addPass(this.distortion)
    this.intro.scale.setScalar(0.5)
    this.scene.add(this.gallery, this.intro)
    this.gallery.position.z = -2.75
    this.resize()
    window.addEventListener('resize', this.resize)
    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onCancel)
    canvas.addEventListener('pointerleave', this.onLeave)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('keydown', this.onKey)
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.watchdog = setTimeout(() => {
      if (!this.assetsReady) this.cb.error(new Error('Asset loading timed out'))
    }, 20000)
    void this.load().catch((e) => {
      if (!this.disposed) this.cb.error(e)
    })
    this.raf = requestAnimationFrame(this.tick)
  }

  private async load() {
    const manager = new THREE.LoadingManager()
    manager.onProgress = (_, loaded, total) => {
      if (!this.disposed) this.cb.progress((loaded / total) * 100)
    }
    const loader = new THREE.TextureLoader(manager)
    const texture = async (url: string) => {
      const t = await loader.loadAsync(url)
      if (this.disposed) {
        t.dispose()
        throw new Error('Disposed')
      }
      t.colorSpace = THREE.NoColorSpace
      this.textures.push(t)
      return t
    }
    const response = await fetch(asset('sequences.json'), {
      signal: this.abort.signal,
    })
    if (!response.ok) throw new Error('Missing intro sequences')
    const sequences: { desktop: string[]; mobile: string[][] } =
      await response.json()
    const urls = this.mobile
      ? Array.from(
          { length: 25 },
          (_, i) => sequences.mobile[Math.floor(Math.random() * 3)][i],
        )
      : sequences.desktop
    const [frames, model, particle] = await Promise.all([
      Promise.all(urls.map(texture)),
      new GLTFLoader(manager).loadAsync(asset('site/assets/models/dude.glb')),
      texture(asset('site/assets/images/particle.jpg')),
    ])
    await document.fonts.load('18px "DM Mono"')
    if (this.disposed) {
      model.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose()
      })
      return
    }
    this.frames = frames
    this.createIntro(model.scene, particle)
    this.createGallery()
    this.assetsReady = true
    clearTimeout(this.watchdog)
    this.cb.progress(100)
    if (this.skipped || this.reduceMotion) {
      this.skip()
      return
    }
    this.cb.phase('separating')
    this.loadingTimer = setTimeout(() => this.startIntro(), 1500)
  }

  private createIntro(model: THREE.Group, particle: THREE.Texture) {
    const black = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshBasicMaterial({ color: 0 }),
    )
    black.position.z = 2.5
    this.intro.add(black)
    const content = new THREE.Group()
    content.position.z = 3
    content.scale.setScalar(this.mobile ? 0.8 : 0.9)
    this.intro.add(content)
    this.sequence = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: sequenceVertex,
        fragmentShader: sequenceFragment,
        uniforms: {
          texture1: { value: this.frames[0] },
          texture2: { value: this.frames[1] },
          morphFactor: { value: 0 },
          pixelSize: { value: 80 },
          resolution: { value: new THREE.Vector2(1024, 1024) },
          fade: { value: 1 },
        },
      }),
    )
    this.sequence.scale.set(this.mobile ? 2.4 : 6.4, this.mobile ? 4 : 3.6, 1)
    this.sequence.position.z = 1.8
    this.sequence.visible = false
    content.add(this.sequence)
    const unique = new Set<string>()
    const positions: number[] = []
    const random: number[] = []
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const p = object.geometry.getAttribute('position')
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i),
          key = `${x},${y},${z}`
        if (!unique.has(key)) {
          unique.add(key)
          positions.push(x * 0.012, y * 0.012, z * 0.012)
          random.push(
            Math.random(),
            Math.random(),
            Math.random(),
            Math.random(),
          )
        }
      }
      object.geometry.dispose()
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]
      materials.forEach((m) => m.dispose())
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    )
    geometry.setAttribute(
      'vRandom',
      new THREE.Float32BufferAttribute(random, 4),
    )
    const material = new THREE.ShaderMaterial({
      vertexShader: particleVertex.replace('#include <curl_noise>', noise),
      fragmentShader: particleFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        particleMap: { value: particle },
        viewport: { value: new THREE.Vector2(1, 1) },
        offsetX: { value: 0 },
        offsetY: { value: 164 },
        offsetZ: { value: 60 },
        brightness: { value: 5 },
        totalScale: { value: 0.4 },
        pScaleMin: { value: 0.4 },
        pScaleMax: { value: 1.5 },
        time: { value: 0 },
        curlFreq: { value: 10 },
        noiseScale: { value: 0.14 },
        opacity: { value: 0 },
      },
    })
    this.particles = new THREE.Points(geometry, material)
    this.particles.position.z = 2
    this.particles.scale.setScalar(this.mobile ? 0.85 : 1.15)
    this.particles.frustumCulled = false
    content.add(this.particles)
    this.resize()
  }

  private createGallery() {
    const geometry = new THREE.PlaneGeometry(0.998, 0.998)
    for (let y = -5; y <= 5; y++)
      for (let x = -5; x <= 5; x++) {
        const material = new THREE.ShaderMaterial({
          vertexShader: galleryVertex,
          fragmentShader: galleryFragment,
          uniforms: {
            colorMap: { value: null },
            opacity: { value: 0 },
            hover: { value: 0 },
          },
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.userData = { x, y }
        mesh.position.set(x, y, 0)
        this.cards.push(mesh)
        this.gallery.add(mesh)
      }
    this.setCards(this.liveCards)
  }

  setCards(cards: LedgerCard[]) {
    this.liveCards = cards
    if (!this.cards.length || this.disposed) return
    const shown = cards.length
      ? cards
      : [
          {
            id: 'loading',
            title: 'Vault data',
            value: 'READING',
            subtitle: 'Waiting for a validated ledger snapshot',
            category: 'PATAPIM / LIVE',
            lines: [],
          } satisfies LedgerCard,
        ]
    const keep = new Set(shown.map((card) => card.id))
    for (const card of shown) {
      const signature = JSON.stringify(card)
      const old = this.cardTextures.get(card.id)
      if (old?.signature !== signature) {
        old?.texture.dispose()
        this.cardTextures.set(card.id, {
          signature,
          texture: ledgerTexture(card),
        })
      }
    }
    this.cards.forEach((mesh) => {
      const index = THREE.MathUtils.euclideanModulo(
        mesh.userData.x + mesh.userData.y * 3,
        shown.length,
      )
      const card = shown[index]
      mesh.userData.card = card
      mesh.material.uniforms.colorMap.value = this.cardTextures.get(
        card.id,
      )!.texture
    })
    for (const [id, value] of this.cardTextures)
      if (!keep.has(id)) {
        value.texture.dispose()
        this.cardTextures.delete(id)
      }
  }

  private startIntro() {
    if (this.disposed || this.skipped || !this.particles || !this.sequence)
      return
    this.started = performance.now()
    this.sequence.visible = true
    this.cb.phase('intro')
    const p = this.particles.material.uniforms
    const opacity = { value: 0 }
    this.timeline = gsap.timeline()
    this.timeline
      .to(p.opacity, { value: 1, duration: 0.4 }, 2.5)
      .to(
        this.intro.position,
        { z: 4.2, duration: 0.8, ease: 'power3.in' },
        2.7,
      )
      .to(
        this.gallery.position,
        { z: 1.45, duration: 1, ease: 'power3.inOut' },
        2.8,
      )
      .to(p.offsetX, { value: 400, duration: 0.5, ease: 'power3.in' }, 2.7)
      .to(p.offsetY, { value: 400, duration: 0.5, ease: 'power3.in' }, 2.7)
      .to(p.offsetZ, { value: 1586, duration: 0.5, ease: 'power3.in' }, 2.7)
      .to(
        this.particles.rotation,
        { y: THREE.MathUtils.degToRad(240), duration: 0.5, ease: 'power3.in' },
        2.7,
      )
      .to(
        opacity,
        {
          value: 1,
          duration: 0.7,
          ease: 'power3.inOut',
          onUpdate: () =>
            this.cards.forEach((card) => {
              card.material.uniforms.opacity.value = opacity.value
            }),
        },
        3.1,
      )
      .call(
        () => {
          this.revealed = true
          this.cb.phase('revealed')
        },
        [],
        3.2,
      )
      .call(() => this.finish(), [], 4.2)
  }

  skip = () => {
    this.skipped = true
    clearTimeout(this.loadingTimer)
    this.timeline?.kill()
    if (!this.assetsReady) return
    this.gallery.position.z = 1.45
    this.cards.forEach((c) => {
      c.material.uniforms.opacity.value = 1
    })
    this.finish()
  }
  private finish() {
    this.intro.visible = false
    this.revealed = this.interactive = true
    this.cb.phase('ready')
  }
  setActive(active: boolean) {
    this.active = active
  }

  private resize = () => {
    const width = this.canvas.clientWidth || innerWidth,
      height = this.canvas.clientHeight || innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.composer.setSize(width, height)
    const worldHeight = 2 * 3.43 * Math.tan(THREE.MathUtils.degToRad(85 / 2))
    this.particles?.material.uniforms.viewport.value.set(
      worldHeight * this.camera.aspect,
      worldHeight,
    )
  }
  private tick = (now: number) => {
    if (this.disposed) return
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05)
    this.lastFrame = now
    if (document.hidden) {
      this.raf = requestAnimationFrame(this.tick)
      return
    }
    if (this.started >= 0 && this.sequence && this.intro.visible) {
      const t = (now - this.started) / 1000,
        uniforms = this.sequence.material.uniforms
      if (t < 0.8) {
        uniforms.pixelSize.value = [80, 70, 60, 50, 40, 30, 20, 10, 1][
          Math.min(8, Math.floor((t / 0.8) * 9))
        ]
      } else if (t < 2.6) {
        uniforms.pixelSize.value = 1
        const frame = ((t - 0.8) / 1.8) * this.frames.length,
          i = Math.floor(frame)
        uniforms.texture1.value = this.frames[i % this.frames.length]
        uniforms.texture2.value = this.frames[(i + 1) % this.frames.length]
        uniforms.morphFactor.value = frame % 1
      } else this.sequence.visible = false
      if (this.particles)
        this.particles.material.uniforms.time.value = 36 * (now / 1000)
    }
    if (this.active) {
      const damping = this.reduceMotion ? 1 : 1 - Math.exp(-8 * dt)
      this.offset.lerp(this.target, damping)
      this.cards.forEach((card) => {
        card.position.x =
          THREE.MathUtils.euclideanModulo(
            card.userData.x + this.offset.x + 5.5,
            11,
          ) - 5.5
        card.position.y =
          THREE.MathUtils.euclideanModulo(
            card.userData.y + this.offset.y + 5.5,
            11,
          ) - 5.5
        card.material.uniforms.hover.value = THREE.MathUtils.lerp(
          card.material.uniforms.hover.value,
          card === this.hover ? 1 : 0,
          damping,
        )
      })
      if (this.revealed) {
        const factor = this.reduceMotion ? 0 : -0.07 * this.camera.aspect
        this.distortion.uniforms.distortion.value.lerp(
          new THREE.Vector2(factor, factor),
          damping,
        )
      }
      this.composer.render()
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private point(event: PointerEvent) {
    const bounds = this.canvas.getBoundingClientRect()
    // Invert the same barrel warp used by the compositor before raycasting.
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    const y = 1 - ((event.clientY - bounds.top) / bounds.height) * 2
    const factor =
      0.88 + this.distortion.uniforms.distortion.value.x * (x * x + y * y)
    this.pointer.set(x * factor, y * factor)
  }
  private onDown = (e: PointerEvent) => {
    if (!this.interactive || !this.active) return
    this.down = { x: e.clientX, y: e.clientY, moved: 0 }
    this.canvas.setPointerCapture(e.pointerId)
    this.canvas.style.cursor = 'grabbing'
  }
  private onMove = (e: PointerEvent) => {
    if (!this.interactive || !this.active) return
    this.point(e)
    if (this.down) {
      const dx = e.clientX - this.down.x,
        dy = e.clientY - this.down.y
      const unit =
        (2 *
          (this.camera.position.z - this.gallery.position.z) *
          Math.tan(THREE.MathUtils.degToRad(42.5))) /
        this.canvas.clientHeight
      this.target.x += dx * unit
      this.target.y -= dy * unit
      this.down.moved += Math.hypot(dx, dy)
      this.down.x = e.clientX
      this.down.y = e.clientY
    } else {
      this.raycaster.setFromCamera(this.pointer, this.camera)
      this.hover = this.raycaster.intersectObjects(this.cards)[0]
        ?.object as typeof this.hover
      this.canvas.style.cursor = this.hover ? 'grab' : 'default'
    }
  }
  private onUp = (e: PointerEvent) => {
    if (!this.down) return
    if (this.down.moved < 7) {
      this.point(e)
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const hit = this.raycaster.intersectObjects(this.cards)[0]
      if (hit) this.cb.select(hit.object.userData.card)
    }
    this.onCancel()
    if (this.canvas.hasPointerCapture(e.pointerId))
      this.canvas.releasePointerCapture(e.pointerId)
  }
  private onCancel = () => {
    this.down = undefined
    this.canvas.style.cursor = 'grab'
  }
  private onLeave = () => {
    this.hover = undefined
  }
  private onWheel = (e: WheelEvent) => {
    if (!this.interactive || !this.active) return
    e.preventDefault()
    const scale = e.deltaMode === 1 ? 0.03 : 0.002
    this.target.x -= e.deltaX * scale
    this.target.y += e.deltaY * scale
  }
  private onKey = (e: KeyboardEvent) => {
    if (!this.interactive || !this.active || !e.key.startsWith('Arrow')) return
    e.preventDefault()
    this.target.x += e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0
    this.target.y += e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
  }
  private onVisibility = () => {
    if (document.hidden) {
      this.timeline?.pause()
    } else {
      this.timeline?.resume()
      if (this.started >= 0 && this.timeline)
        this.started = performance.now() - this.timeline.time() * 1000
    }
  }
  private onContextLost = (e: Event) => {
    e.preventDefault()
    this.cb.error(new Error('WebGL context lost'))
  }

  dispose() {
    this.disposed = true
    this.abort.abort()
    cancelAnimationFrame(this.raf)
    clearTimeout(this.loadingTimer)
    clearTimeout(this.watchdog)
    this.timeline?.kill()
    window.removeEventListener('resize', this.resize)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onCancel)
    this.canvas.removeEventListener('pointerleave', this.onLeave)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('keydown', this.onKey)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material]
        materials.forEach((m) => m.dispose())
      }
    })
    this.cardTextures.forEach(({ texture }) => texture.dispose())
    this.cardTextures.clear()
    this.textures.forEach((t) => t.dispose())
    this.composer.passes.forEach((p) => p.dispose())
    this.composer.dispose()
    this.renderer.dispose()
  }
}
