// WebGL scene for the opening sequence: particles assemble into a handwritten ledger, a scan plane
// reads it, then they flow into the Kosha passport emblem under bloom. Plain three.js, no React.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export const TIMELINE = {
  assemble: [0, 1.15],
  scan: [1.05, 2.05],
  morph: [2.05, 3.25],
  sweep: [3.25, 4.15],
  end: 4.35,
} as const

const LEDGER_LINES = [
  ['22/9', 'बिक्री नकद', '5,480/-'],
  ['24/9', 'माल अग्रवाल', '33,206/-'],
  ['9/24', 'Benta (cash)', '4,620/-'],
  ['18/9', 'Jualan tunai', '1.720.000'],
]

const SHIELD = 'M32 6 54 18v16c0 12-9.5 20.5-22 24C19.5 54.5 10 46 10 34V18Z'

type Pt = [number, number]

/** Draws with `paint`, then samples opaque pixels. Returns points in [-0.5, 0.5] around the centre (y up). */
function sample(w: number, h: number, step: number, paint: (c: CanvasRenderingContext2D) => void): { strong: Pt[]; faint: Pt[] } {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d', { willReadFrequently: true })!
  paint(c)
  const data = c.getImageData(0, 0, w, h).data
  const strong: Pt[] = []
  const faint: Pt[] = []
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      const a = data[i + 3]
      if (a < 60) continue
      const p: Pt = [x / w - 0.5, 0.5 - y / h]
      // red channel marks "faint" strokes (ruled lines, outlines drawn in red)
      ;(data[i] > 200 && data[i + 1] < 80 ? faint : strong).push(p)
    }
  }
  return { strong, faint }
}

function pick(src: Pt[], n: number, rnd: () => number): Pt[] {
  const out: Pt[] = []
  if (!src.length) return Array.from({ length: n }, () => [0, 0])
  for (let i = 0; i < n; i++) out.push(src[Math.floor(rnd() * src.length)])
  return out
}

function ledgerPoints(n: number, rnd: () => number): Pt[] {
  const W = 1400, H = 720
  const s = sample(W, H, 3, (c) => {
    c.strokeStyle = '#ff0000'
    c.lineWidth = 3
    for (let k = 0; k < 6; k++) {
      const y = 70 + k * 130
      c.beginPath(); c.moveTo(20, y); c.lineTo(W - 20, y); c.stroke()
    }
    c.beginPath(); c.moveTo(210, 20); c.lineTo(210, H - 20); c.stroke()
    c.fillStyle = '#ffffff'
    c.textBaseline = 'alphabetic'
    LEDGER_LINES.forEach(([d, t, a], k) => {
      const y = 180 + k * 130
      c.font = '700 64px Kalam, "Tiro Devanagari Hindi", cursive'
      c.fillText(d, 40, y)
      c.font = '700 84px Kalam, "Tiro Devanagari Hindi", cursive'
      c.fillText(t, 250, y)
      c.textAlign = 'right'
      c.fillText(a, W - 40, y)
      c.textAlign = 'left'
    })
  })
  const nf = Math.floor(n * 0.14)
  return [...pick(s.strong, n - nf, rnd), ...pick(s.faint, nf, rnd)].map(([x, y]) => [x * 2, y * 2 * (H / W)])
}

function emblemPoints(n: number, rnd: () => number): Pt[] {
  const W = 900, H = 1200
  const s = sample(W, H, 3, (c) => {
    c.strokeStyle = '#ff0000'
    c.lineWidth = 7
    const r = 60
    c.beginPath()
    c.roundRect(14, 14, W - 28, H - 28, r)
    c.stroke()
    c.fillStyle = '#ff0000'
    c.font = '500 40px "Geist Mono", ui-monospace, monospace'
    c.fillText('CREDIT  PASSPORT', 80, 120)
    c.font = '500 34px "Geist Mono", ui-monospace, monospace'
    c.fillText('KP<JAPAC<<EVERY<CORNER<SHOP<<<', 80, H - 90)
    c.save()
    c.translate(W / 2 - 230, 250)
    c.scale(7.2, 7.2)
    c.strokeStyle = '#ffffff'
    c.lineWidth = 2.8
    c.lineJoin = 'round'
    c.stroke(new Path2D(SHIELD))
    c.beginPath(); c.arc(32, 31, 8.5, 0, Math.PI * 2); c.stroke()
    c.lineWidth = 2
    c.beginPath(); c.moveTo(32, 22.5); c.lineTo(32, 39.5); c.moveTo(23.5, 31); c.lineTo(40.5, 31); c.stroke()
    c.restore()
    c.fillStyle = '#ffffff'
    c.textAlign = 'center'
    c.font = '400 230px "Tiro Devanagari Hindi", serif'
    c.fillText('कोष', W / 2, 960)
  })
  const nf = Math.floor(n * 0.3)
  return [...pick(s.strong, n - nf, rnd), ...pick(s.faint, nf, rnd)].map(([x, y]) => [x * 1.5, y * 1.5 * (H / W)])
}

const VERT = /* glsl */ `
uniform float uTime, uA, uB, uScan, uSweep, uExit, uSize, uPR;
attribute vec3 aStart, aLedger, aEmblem;
attribute vec4 aRand;
varying vec3 vColor;
varying float vAlpha;
const vec3 PAPER = vec3(0.96, 0.9, 0.78);
const vec3 JADE = vec3(0.24, 0.88, 0.77);
const vec3 GOLD = vec3(0.98, 0.72, 0.28);
float easeOut(float t){ return 1.0 - pow(1.0 - t, 3.0); }
float easeInOut(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }
void main(){
  float a = easeOut(clamp(uA * 1.45 - aRand.x * 0.45, 0.0, 1.0));
  float b = easeInOut(clamp(uB * 1.6 - aRand.y * 0.6, 0.0, 1.0));
  vec3 drift = vec3(sin(uTime*0.9 + aRand.y*6.283), cos(uTime*0.7 + aRand.z*6.283), sin(uTime*0.5 + aRand.w*6.283)) * 0.012;
  vec3 p = mix(aStart, aLedger, a) + drift;
  // curved flight from ledger to emblem, through a swirl
  vec3 mid = (p + aEmblem) * 0.5 + vec3(sin(aRand.x*17.0)*1.6, cos(aRand.z*11.0)*1.1, (aRand.w - 0.5)*4.0);
  p = mix(mix(p, mid, b), mix(mid, aEmblem, b), b);
  // exit: burst toward the camera
  p += normalize(p + vec3(0.001)) * uExit * 1.6;
  p.z += uExit * (3.0 + aRand.x * 7.0);

  float scanned = smoothstep(0.0, 0.35, uScan - aLedger.x) * (1.0 - b);
  float beam = exp(-pow((uScan - aLedger.x) * 6.0, 2.0)) * (1.0 - b) * step(-2.0, uScan);
  float sweep = exp(-pow((p.x + p.y*0.35 - uSweep) * 2.2, 2.0)) * b;
  vec3 col = mix(PAPER, JADE, scanned);
  col = mix(col, GOLD, b);
  col += beam * vec3(0.4, 0.9, 0.85) * 0.55 + sweep * vec3(1.0, 0.9, 0.7) * 0.45;
  vColor = col;
  vAlpha = a * (0.4 + 0.4*aRand.z) * (1.0 - uExit);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (0.55 + aRand.z * 0.9) * (1.0 + beam * 0.6 + sweep * 0.35) / -mv.z;
}`

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float m = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * m * vAlpha, m * vAlpha);
}`

export interface IntroScene {
  render: (t: number) => void
  setPointer: (x: number, y: number) => void
  setExit: (e: number) => void
  resize: () => void
  dispose: () => void
}

export async function createIntroScene(canvas: HTMLCanvasElement): Promise<IntroScene> {
  // The ledger is handwriting: wait (briefly) for the web fonts so the particles take their shape.
  try {
    await Promise.race([
      Promise.all(['700 84px Kalam', '400 230px "Tiro Devanagari Hindi"', '500 40px "Geist Mono"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 900)),
    ])
  } catch { /* fall back to system fonts */ }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
  const small = Math.min(innerWidth, innerHeight) < 600
  const pr = Math.min(devicePixelRatio, small ? 1.5 : 2)
  renderer.setPixelRatio(pr)
  renderer.setClearColor(0x05070d, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  camera.position.set(0, 0, 10)

  let s = 0x2f6b9 // deterministic randomness
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)

  const N = small ? 5200 : 10000
  const ledger = ledgerPoints(N, rnd)
  const emblem = emblemPoints(N, rnd)
  const start = new Float32Array(N * 3), led = new Float32Array(N * 3), emb = new Float32Array(N * 3), rand = new Float32Array(N * 4)
  for (let i = 0; i < N; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1), r = 6 + rnd() * 10
    start.set([Math.sin(ph) * Math.cos(th) * r, Math.sin(ph) * Math.sin(th) * r * 0.6, -Math.abs(Math.cos(ph) * r) - 4], i * 3)
    led.set([ledger[i][0] * 3.6, ledger[i][1] * 3.6 + 0.5, (rnd() - 0.5) * 0.06], i * 3)
    emb.set([emblem[i][0] * 1.6, emblem[i][1] * 1.6 + 0.8, (rnd() - 0.5) * 0.05], i * 3)
    rand.set([rnd(), rnd(), rnd(), rnd()], i * 4)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(led.slice(), 3))
  geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
  geo.setAttribute('aLedger', new THREE.BufferAttribute(led, 3))
  geo.setAttribute('aEmblem', new THREE.BufferAttribute(emb, 3))
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4))
  const uniforms = {
    uTime: { value: 0 }, uA: { value: 0 }, uB: { value: 0 }, uScan: { value: -9 }, uSweep: { value: -9 }, uExit: { value: 0 },
    uSize: { value: small ? 28 : 24 }, uPR: { value: pr },
  }
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  const group = new THREE.Group()
  group.add(points)
  scene.add(group)

  // Distant dust for parallax depth.
  const dustN = 700
  const dust = new Float32Array(dustN * 3)
  for (let i = 0; i < dustN; i++) dust.set([(rnd() - 0.5) * 40, (rnd() - 0.5) * 24, -8 - rnd() * 20], i * 3)
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3))
  const dustMat = new THREE.PointsMaterial({ color: 0xc9a46a, size: 0.04, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })
  scene.add(new THREE.Points(dustGeo, dustMat))

  // The scan plane: a thin vertical sheet of jade light.
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uO: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uO; varying vec2 vUv; void main(){ float x = exp(-pow((vUv.x-0.5)*9.0,2.0)); float y = smoothstep(0.0,0.25,vUv.y)*smoothstep(1.0,0.75,vUv.y); vec3 c = vec3(0.24,0.88,0.77); gl_FragColor = vec4(c*x*y*uO*0.45, x*y*uO*0.45); }',
  })
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 4.2), beamMat)
  beam.position.set(-9, 0.5, 0.05)
  group.add(beam)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.28, 0.32)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  let fit = 1
  const resize = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.resolution.set(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // Fit the ~7.2-unit-wide ledger into 86% of the visible width on narrow screens.
    const visibleW = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect
    fit = Math.min(1, (visibleW * 0.86) / 7.4)
  }
  resize()

  const pointer = new THREE.Vector2()
  const smooth = new THREE.Vector2()
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
  const prog = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a))
  let exit = 0

  const render = (t: number) => {
    uniforms.uTime.value = t
    uniforms.uA.value = prog(t, TIMELINE.assemble)
    const sc = prog(t, TIMELINE.scan)
    uniforms.uScan.value = sc > 0 && sc < 1 ? -4.2 + sc * 8.6 : sc >= 1 ? 9 : -9
    beam.position.x = uniforms.uScan.value
    beamMat.uniforms.uO.value = sc > 0 && sc < 1 ? Math.sin(sc * Math.PI) : 0
    const mb = prog(t, TIMELINE.morph)
    uniforms.uB.value = mb
    const sw = prog(t, TIMELINE.sweep)
    uniforms.uSweep.value = sw > 0 && sw < 1 ? -3 + sw * 6 : -9
    uniforms.uExit.value = exit
    dustMat.opacity = 0.22 * (1 - exit)

    // camera choreography: a slow push-in, a turn during the morph, and pointer parallax
    smooth.lerp(pointer, 0.06)
    const turn = Math.sin(mb * Math.PI) * 0.55
    // the emblem is portrait, so on phones it may grow back toward full size as the ledger leaves
    group.scale.setScalar(THREE.MathUtils.lerp(fit, Math.min(1, fit * 2.2), mb))
    group.rotation.y = -0.18 + uniforms.uA.value * 0.1 + turn + smooth.x * 0.18
    group.rotation.x = 0.1 - mb * 0.06 - smooth.y * 0.12
    camera.position.z = 10.6 - Math.min(t, 4.4) * 0.22
    camera.lookAt(0, 0.2, 0)
    bloom.strength = 0.5 + Math.sin(sc * Math.PI) * 0.15 + (sw > 0 && sw < 1 ? Math.sin(sw * Math.PI) * 0.12 : 0)
    composer.render()
  }

  return {
    render,
    setPointer: (x, y) => pointer.set(x, y),
    setExit: (e) => (exit = e),
    resize,
    dispose: () => {
      geo.dispose(); mat.dispose(); dustGeo.dispose(); dustMat.dispose(); beamMat.dispose(); beam.geometry.dispose()
      composer.dispose()
      renderer.dispose()
    },
  }
}
