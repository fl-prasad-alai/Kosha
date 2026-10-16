import { useEffect, useRef } from 'react'

// Slow liquid-gold flow field (adapted from the Kavach / VANA backdrop), drawn behind everything.
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'
const FRAG = `
precision mediump float;
uniform float t; uniform vec2 res; uniform vec3 ca; uniform vec3 cb; uniform vec3 cc;
vec2 h(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453); }
float n(vec2 p){
  const float K1 = 0.366025404; const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x+p.y)*K1); vec2 a = p - i + (i.x+i.y)*K2;
  vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec2 b = a - o + K2; vec2 c = a - 1.0 + 2.0*K2;
  vec3 hh = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
  vec3 nn = hh*hh*hh*hh*vec3(dot(a,h(i)), dot(b,h(i+o)), dot(c,h(i+1.0)));
  return dot(nn, vec3(70.0));
}
float fbm(vec2 p){ float f = 0.0; float w = 0.5; for (int i = 0; i < 4; i++){ f += w*n(p); p *= 2.0; w *= 0.5; } return f; }
void main(){
  vec2 uv = gl_FragCoord.xy / res; vec2 p = uv*2.0 - 1.0; p.x *= res.x/res.y;
  float s = t*0.045;
  vec2 q = vec2(fbm(p*1.1 + vec2(s, -s*0.6)), fbm(p*1.1 + vec2(-s*0.4, s*0.8)));
  float f = fbm(p*1.3 + q*1.7 + vec2(s*0.3));
  float glow = smoothstep(0.05, 0.9, f*0.5 + 0.5);
  float top = smoothstep(1.4, -0.3, length(p - vec2(0.85, 0.9)));
  vec3 col = mix(ca, cb, glow*0.85);
  col = mix(col, cc, pow(glow, 3.2)*0.22 + top*0.08);
  float vig = smoothstep(2.0, 0.25, length(p*vec2(0.75, 1.0)));
  gl_FragColor = vec4(mix(ca, col, vig), 1.0);
}`

function readColors() {
  const cs = getComputedStyle(document.documentElement)
  const v = (k: string) => cs.getPropertyValue(k).split(',').map((x) => parseFloat(x) || 0)
  return { a: v('--k-shader-a'), b: v('--k-shader-b'), c: v('--k-shader-c') }
}

export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas?.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!canvas || !gl) return
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u = (n: string) => gl.getUniformLocation(prog, n)
    let colors = readColors()
    const obs = new MutationObserver(() => (colors = readColors()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const scale = 0.5 // render at half resolution; the field is soft anyway
    const resize = () => {
      canvas.width = Math.max(1, Math.floor(innerWidth * scale))
      canvas.height = Math.max(1, Math.floor(innerHeight * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    addEventListener('resize', resize)
    let raf = 0
    const t0 = performance.now()
    const draw = () => {
      gl.uniform1f(u('t'), reduced ? 12 : (performance.now() - t0) / 1000)
      gl.uniform2f(u('res'), canvas.width, canvas.height)
      gl.uniform3fv(u('ca'), colors.a)
      gl.uniform3fv(u('cb'), colors.b)
      gl.uniform3fv(u('cc'), colors.c)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (!reduced && !document.hidden) raf = requestAnimationFrame(draw)
    }
    draw()
    const vis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) draw()
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      cancelAnimationFrame(raf)
      obs.disconnect()
      removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-night">
      <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-95" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(var(--k-line) 1px, transparent 1px), linear-gradient(90deg, var(--k-line) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse 70% 50% at 50% 10%, #000 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 50% at 50% 10%, #000 20%, transparent 75%)',
        }}
      />
    </div>
  )
}
