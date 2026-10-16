import { useEffect, useRef, useState } from 'react'
import { FrameGuard, getTier } from '@/lib/perf'

// The sign-in scene: a Kosha credit passport floating in light, with gold coins (the treasury)
// orbiting it. Three quality levels: full, reduced (lower resolution, fewer coins), and a still
// frame. It starts from the device's tier and steps down if frames run slow.

function passportFace(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const bg = g.createRadialGradient(w * 0.95, 0, 0, w * 0.6, h * 0.4, w * 1.1)
  bg.addColorStop(0, '#24426a')
  bg.addColorStop(0.6, '#0b1424')
  bg.addColorStop(1, '#070c17')
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  // guilloche
  g.strokeStyle = 'rgba(217,164,65,0.18)'
  g.lineWidth = 1.2
  for (let k = 0; k < 18; k++) {
    g.beginPath()
    for (let x = 0; x <= w; x += 8) {
      const y = h * 0.55 + Math.sin(x / 60 + k * 0.5) * (60 + k * 6) * Math.cos(x / 210 - k * 0.2)
      x ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.stroke()
  }
  g.strokeStyle = 'rgba(242,181,68,0.55)'
  g.lineWidth = 4
  g.strokeRect(14, 14, w - 28, h - 28)
  g.fillStyle = '#d9a441'
  g.font = '500 24px "Geist Mono", ui-monospace, monospace'
  g.fillText('CREDIT  PASSPORT', 50, 82)
  g.fillStyle = '#f6ead0'
  g.font = '600 64px Fraunces, Georgia, serif'
  g.fillText('KOSHA', 48, 150)
  // shield
  g.save()
  g.translate(w - 150, 46)
  g.scale(1.6, 1.6)
  g.strokeStyle = '#f2b544'
  g.lineWidth = 3.4
  g.lineJoin = 'round'
  g.stroke(new Path2D('M32 6 54 18v16c0 12-9.5 20.5-22 24C19.5 54.5 10 46 10 34V18Z'))
  g.beginPath(); g.arc(32, 31, 8.5, 0, Math.PI * 2); g.stroke()
  g.beginPath(); g.moveTo(32, 22.5); g.lineTo(32, 39.5); g.moveTo(23.5, 31); g.lineTo(40.5, 31); g.stroke()
  g.restore()
  // fields
  const field = (label: string, value: string, x: number, y: number) => {
    g.fillStyle = '#9fb0c6'; g.font = '500 18px "Geist Mono", monospace'; g.fillText(label, x, y)
    g.fillStyle = '#f6ead0'; g.font = '500 30px Geist, system-ui, sans-serif'; g.fillText(value, x, y + 38)
  }
  field('HOLDER', 'Sunita Sharma', 50, 240)
  field('BUSINESS', 'Sharma General Store', 50, 330)
  field('IN BUSINESS', '11 years', 50, 420)
  // score ring
  const cx = w - 170, cy = 560, r = 104
  g.lineWidth = 20
  g.strokeStyle = 'rgba(255,255,255,0.12)'
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke()
  const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  grad.addColorStop(0, '#ffd27a'); grad.addColorStop(1, '#e8912c')
  g.strokeStyle = grad
  g.lineCap = 'round'
  g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.82); g.stroke()
  g.fillStyle = '#f6ead0'; g.textAlign = 'center'
  g.font = '600 72px Fraunces, Georgia, serif'; g.fillText('794', cx, cy + 20)
  g.fillStyle = '#c9b893'; g.font = '500 18px "Geist Mono", monospace'; g.fillText('SCORE', cx, cy + 56)
  g.textAlign = 'left'
  g.fillStyle = '#9fb0c6'; g.font = '500 20px Geist, sans-serif'; g.fillText('Working-capital offer', 50, 540)
  g.fillStyle = '#ffd27a'; g.font = '600 66px Fraunces, Georgia, serif'; g.fillText('₹80,000', 46, 610)
  // stamp
  g.save(); g.translate(120, 740); g.rotate(-0.16)
  g.strokeStyle = '#3ee0c4'; g.lineWidth = 5; g.strokeRect(-10, -44, 240, 62)
  g.fillStyle = '#3ee0c4'; g.font = '700 36px Fraunces, Georgia, serif'; g.fillText('VERIFIED', 6, 2)
  g.restore()
  g.fillStyle = 'rgba(246,234,208,0.6)'; g.font = '500 20px "Geist Mono", monospace'
  g.fillText('KP<IND<SHARMA<<SUNITA<<<<<<<<<<', 50, h - 60)
  return c
}

export function AuthScene({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    ;(async () => {
      try {
        await Promise.race([Promise.all(['600 64px Fraunces', '500 30px Geist', '500 20px "Geist Mono"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 1200))])
      } catch { /* fallback fonts */ }
      const THREE = await import('three')
      const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js')
      if (disposed || !host.current) return
      const el = host.current
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      let level: 0 | 1 | 2 = getTier() === 'low' ? 1 : 0 // 0 full, 1 reduced, 2 still
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({ antialias: level === 0, alpha: true, powerPreference: level === 0 ? 'high-performance' : 'low-power' })
      } catch {
        setFailed(true)
        return
      }
      const pr = () => (level === 0 ? Math.min(devicePixelRatio, 1.75) : Math.min(devicePixelRatio, 1) * 0.85)
      renderer.setPixelRatio(pr())
      renderer.outputColorSpace = THREE.SRGBColorSpace
      el.appendChild(renderer.domElement)
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
      camera.position.set(0, 0, 9.5)

      scene.add(new THREE.AmbientLight(0xbfc8ff, 0.75))
      const key = new THREE.DirectionalLight(0xfff1d6, 1.6)
      key.position.set(3, 4, 6)
      scene.add(key)
      const rim = new THREE.PointLight(0xf2b544, 22, 14)
      rim.position.set(-3.2, -1.5, 2.5)
      scene.add(rim)

      // passport
      const face = new THREE.CanvasTexture(passportFace(1024, 1400))
      face.colorSpace = THREE.SRGBColorSpace
      face.anisotropy = level === 0 ? 4 : 1
      const navy = new THREE.MeshPhongMaterial({ color: 0x0b1424, shininess: 40 })
      const gold = new THREE.MeshPhongMaterial({ color: 0xd9a441, shininess: 90, specular: 0xffe2a0 })
      const front = new THREE.MeshPhongMaterial({ map: face, shininess: 60, specular: 0x333333 })
      const card = new THREE.Mesh(new RoundedBoxGeometry(2.6, 3.55, 0.09, level === 0 ? 4 : 2, 0.12), [gold, gold, gold, gold, front, navy])
      const group = new THREE.Group()
      group.add(card)
      scene.add(group)

      // coins: one instanced mesh
      const COINS = level === 0 ? 14 : 7
      const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.05, level === 0 ? 40 : 20)
      coinGeo.rotateX(Math.PI / 2)
      const coins = new THREE.InstancedMesh(coinGeo, gold, COINS)
      scene.add(coins)
      const seeds = Array.from({ length: COINS }, (_, i) => ({ a: (i / COINS) * Math.PI * 2, r: 2.35 + (i % 3) * 0.32, y: (Math.random() - 0.5) * 1.6, s: 0.6 + Math.random() * 0.8, spin: Math.random() * 6 }))
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3()

      const pointer = new THREE.Vector2(), smooth = new THREE.Vector2()
      const onMove = (ev: PointerEvent) => {
        const r = el.getBoundingClientRect()
        pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, ((ev.clientY - r.top) / r.height) * 2 - 1)
      }
      addEventListener('pointermove', onMove, { passive: true })

      const resize = () => {
        const w = el.clientWidth || 1, h = el.clientHeight || 1
        renderer.setPixelRatio(pr())
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        // keep the card comfortably in frame on narrow screens
        camera.position.z = w / h < 0.9 ? 12.5 : 9.5
        camera.updateProjectionMatrix()
      }
      const ro = new ResizeObserver(resize)
      ro.observe(el)
      resize()

      const frame = (t: number) => {
        smooth.lerp(pointer, 0.05)
        group.position.y = Math.sin(t * 0.9) * 0.08
        group.rotation.y = -0.32 + Math.sin(t * 0.35) * 0.14 + smooth.x * 0.35
        group.rotation.x = 0.08 + smooth.y * 0.22
        group.rotation.z = Math.sin(t * 0.5) * 0.02
        for (let i = 0; i < COINS; i++) {
          const s = seeds[i], a = s.a + t * 0.22 * s.s
          p.set(Math.cos(a) * s.r, s.y + Math.sin(t * s.s + i) * 0.12, Math.sin(a) * s.r * 0.55 - 0.4)
          e.set(0.3, t * s.s + s.spin, 0.2)
          q.setFromEuler(e)
          sc.setScalar(0.85 + (i % 4) * 0.08)
          coins.setMatrixAt(i, m.compose(p, q, sc))
        }
        coins.instanceMatrix.needsUpdate = true
        renderer.render(scene, camera)
      }

      let raf = 0, last = 0
      const t0 = performance.now()
      const guard = new FrameGuard(() => {
        if (level === 0) { level = 1; renderer.setPixelRatio(pr()); resize(); guard.reset() }
        else level = 2 // keep the last frame, stop animating
      })
      const loop = (now: number) => {
        if (last) guard.tick(now - last)
        last = now
        frame((now - t0) / 1000)
        if (level < 2 && !reduced && !document.hidden) raf = requestAnimationFrame(loop)
      }
      if (reduced) frame(1.2)
      else raf = requestAnimationFrame(loop)
      const vis = () => { cancelAnimationFrame(raf); last = 0; if (!document.hidden && level < 2 && !reduced) raf = requestAnimationFrame(loop) }
      document.addEventListener('visibilitychange', vis)

      cleanup = () => {
        cancelAnimationFrame(raf)
        removeEventListener('pointermove', onMove)
        document.removeEventListener('visibilitychange', vis)
        ro.disconnect()
        face.dispose(); navy.dispose(); gold.dispose(); front.dispose(); card.geometry.dispose(); coinGeo.dispose(); coins.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }
    })().catch(() => setFailed(true))
    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  return (
    <div ref={host} className={className} aria-hidden>
      {failed && (
        <div className="absolute inset-0 grid place-items-center">
          <svg viewBox="0 0 64 64" className="size-40 opacity-80"><path d="M32 6 54 18v16c0 12-9.5 20.5-22 24C19.5 54.5 10 46 10 34V18Z" fill="none" stroke="var(--k-gold)" strokeWidth="2.4" strokeLinejoin="round" /><circle cx="32" cy="31" r="8.5" fill="none" stroke="var(--k-gold)" strokeWidth="2" /></svg>
        </div>
      )}
    </div>
  )
}
