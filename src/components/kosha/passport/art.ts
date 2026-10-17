// The painted cover of a Kosha passport: a kirana street at sunset, in the same hand-painted style as
// the opening. Every passport gets its own sky (clouds, hills and town are seeded by the passport id),
// so no two look alike. Returned as an SVG string so the same art can be shown and turned into an image.

const rng = (seed: number) => {
  let s = seed >>> 0 || 1
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}
const n = (v: number) => Math.round(v * 10) / 10

export const ART_W = 800
export const ART_H = 300
const SUN = { x: 585, y: 214 }
const MOON = { x: 455, y: 52 }

/** A ridgeline as an SVG path, with small bumps for trees along the top. */
function ridge(r: () => number, base: number, amp: number, freq: number, bumps: number) {
  const a = r() * 6, b = r() * 6
  let d = `M0 ${ART_H}`
  for (let x = 0; x <= ART_W; x += 8) {
    const y = base - amp * (Math.sin(x * freq + a) * 0.6 + Math.sin(x * freq * 2.7 + b) * 0.4) - (bumps ? Math.max(0, Math.sin(x * 0.19 + a * 3) * r()) * bumps : 0)
    d += ` L${x} ${n(y)}`
  }
  return d + ` L${ART_W} ${ART_H}Z`
}

/** A cumulus cloud: lavender body, lit gold on the side facing the low sun. */
function cloud(r: () => number, cx: number, cy: number, w: number, held: boolean, night = false) {
  const puffs: [number, number, number][] = []
  for (let i = 0; i < 9; i++) {
    const u = r() * 2 - 1
    puffs.push([cx + u * w * 0.5, cy - r() * w * 0.22 * (1 - u * u), w * (0.12 + r() * 0.1)])
  }
  puffs.sort((p, q) => q[1] - p[1])
  const dx = Math.sign((night ? MOON.x : SUN.x) - cx) || 1
  const body = night ? '#1b1b3e' : held ? '#8d6f9e' : '#a77bb5', lit = night ? '#2a2c5a' : held ? '#e8a48a' : '#ffc580', hi = night ? '#4c5596' : held ? '#f6c9a8' : '#ffe6b4'
  let s = `<g filter="url(#soft)">`
  for (const [x, y, rr] of puffs) s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(rr)}" fill="${body}"/>`
  for (const [x, y, rr] of puffs) s += `<circle cx="${n(x + dx * rr * 0.18)}" cy="${n(y + rr * 0.22)}" r="${n(rr * 0.72)}" fill="${lit}"/>`
  for (const [x, y, rr] of puffs) s += `<circle cx="${n(x + dx * rr * 0.32)}" cy="${n(y + rr * 0.36)}" r="${n(rr * 0.34)}" fill="${hi}"/>`
  return s + `<rect x="${n(cx - w)}" y="${n(cy + 2)}" width="${n(w * 2)}" height="40" fill="url(#skyCut)"/></g>`
}

/** A tree in silhouette, rimmed with sunlight on the side facing the sun. */
function tree(r: () => number, x0: number, y0: number, h: number, rim = '#ff9a52') {
  const segs: string[] = [], blobs: [number, number, number][] = []
  const br = (x: number, y: number, a: number, len: number, w: number, d: number) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len
    segs.push(`<path d="M${n(x)} ${n(y)} L${n(x2)} ${n(y2)}" stroke-width="${n(w)}"/>`)
    if (d === 0) {
      for (let i = 0; i < 16; i++) { const t = r() * 6.28, dd = 16 * Math.sqrt(r()); blobs.push([x2 + Math.cos(t) * dd * 1.2, y2 + Math.sin(t) * dd * 0.75, 2 + r() * 3.4]) }
      return
    }
    for (let i = 0; i < 2 + (r() < 0.4 ? 1 : 0); i++) br(x2, y2, a + (i - 0.6) * (0.5 + r() * 0.3), len * 0.7, w * 0.62, d - 1)
  }
  br(x0, y0, -Math.PI / 2 + (r() - 0.5) * 0.1, h * 0.32, 7, 5)
  const draw = (fill: string, ox: number, oy: number) =>
    `<g transform="translate(${ox} ${oy})" fill="${fill}" stroke="${fill}" stroke-linecap="round">${segs.join('')}${blobs.map(([x, y, rr]) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(rr)}"/>`).join('')}</g>`
  return draw(rim, 0, 0) + draw('#1f1520', 1.6, 0.4)
}

/** The full cover as a standalone SVG string. */
export function coverArt(id: string, held = false, night = false) {
  const r = rng(hash(id))
  const sky = night
    ? ['#05071a', '#10153e', '#241f5a', '#4b2d66', '#a0505a']
    : held
    ? ['#211c48', '#4f3a7c', '#9b4f7c', '#d9725c', '#f0a36a']
    : ['#241f55', '#5c4596', '#c95f86', '#ff9150', '#ffd27a']
  let s = `<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${sky.map((c, i) => `<stop offset="${[0, 0.3, 0.56, 0.78, 0.92][i]}" stop-color="${c}"/>`).join('')}</linearGradient>
  <linearGradient id="skyCut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
  <radialGradient id="glow" cx="${SUN.x}" cy="${SUN.y}" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff1c4" stop-opacity=".95"/><stop offset=".12" stop-color="#ffc06a" stop-opacity=".6"/><stop offset=".45" stop-color="#ff8a50" stop-opacity=".18"/><stop offset="1" stop-color="#ff8a50" stop-opacity="0"/></radialGradient>
  <linearGradient id="shopLit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0bc"/><stop offset="1" stop-color="#ef8a3c"/></linearGradient>
  <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6b39a" stop-opacity="0"/><stop offset=".5" stop-color="#f6b39a" stop-opacity=".55"/><stop offset="1" stop-color="#f6b39a" stop-opacity="0"/></linearGradient>
  <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter>
  <filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".09"/></feComponentTransfer></filter>
</defs>`
  s += `<rect width="${ART_W}" height="${ART_H}" fill="url(#sky)"/>`
  if (night) {
    // the last of the afterglow on the horizon, stars, and a crescent moon
    s += `<ellipse cx="${SUN.x}" cy="262" rx="420" ry="70" fill="#ff8a5a" opacity=".22" filter="url(#blur6)"/>`
    for (let i = 0; i < 90; i++) { const y = r() * 170, a = 0.25 + r() * 0.7; s += `<circle cx="${n(r() * ART_W)}" cy="${n(y)}" r="${n(0.4 + r() * (y < 90 ? 1.1 : 0.7))}" fill="#fff8e6" opacity="${n(a)}"/>` }
    s += `<circle cx="${MOON.x}" cy="${MOON.y}" r="40" fill="#cfd6ff" opacity=".18" filter="url(#blur6)"/><circle cx="${MOON.x}" cy="${MOON.y}" r="15" fill="#f6f1dc"/><circle cx="${MOON.x + 7}" cy="${MOON.y - 4}" r="13.5" fill="#10153e"/>`
  } else s += `<rect width="${ART_W}" height="${ART_H}" fill="url(#glow)"/>`
  // soft rays from the sun
  if (!night) for (const [a, w] of [[-2.6, 0.08], [-2.2, 0.05], [-0.7, 0.06], [-0.35, 0.05], [-1.6, 0.04]]) {
    const x1 = SUN.x + Math.cos(a - w) * 700, y1 = SUN.y + Math.sin(a - w) * 700, x2 = SUN.x + Math.cos(a + w) * 700, y2 = SUN.y + Math.sin(a + w) * 700
    s += `<path d="M${SUN.x} ${SUN.y} L${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}Z" fill="#fff4d6" opacity=".07"/>`
  }
  // long streaks of lit cloud and two cumulus
  for (let i = 0; i < 5; i++) {
    const y = 150 + r() * 60, x = r() * 500 + 150, w = 140 + r() * 200
    s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(3 + r() * 4)}" rx="3" fill="${night ? '#1c1a44' : held ? '#6b3f6c' : '#7a3f72'}" opacity=".55"/><rect x="${n(x + 10)}" y="${n(y + 3)}" width="${n(w - 30)}" height="1.6" rx="1" fill="${night ? '#ff9a7a' : '#ffc27a'}" opacity="${night ? 0.35 : 0.7}"/>`
  }
  s += cloud(r, 110 + r() * 120, 86 + r() * 30, 150 + r() * 60, held, night) + cloud(r, 660 + r() * 90, 66 + r() * 30, 120 + r() * 50, held, night)
  // the sun, low over the hills
  if (!night) s += `<circle cx="${SUN.x}" cy="${SUN.y}" r="34" fill="#ffe2a0" opacity=".6" filter="url(#blur6)"/><circle cx="${SUN.x}" cy="${SUN.y}" r="22" fill="#fff6dc"/>`
  if (!night) for (const [x, y, k] of [[470, 122, 1], [488, 112, 0.8], [505, 126, 0.7], [700, 140, 0.8]]) s += `<path d="M${x} ${y} q ${5 * k} ${-5 * k} ${10 * k} 0 q ${5 * k} ${-5 * k} ${10 * k} 0" stroke="#3a2550" stroke-width="1.6" fill="none"/>`
  // hills fading into haze, mist in the valleys
  s += `<path d="${ridge(r, 226, 14, 0.012, 2)}" fill="${night ? '#3b2f62' : held ? '#9a6a92' : '#c47e99'}"/><rect y="214" width="${ART_W}" height="34" fill="url(#mist)" opacity="${night ? 0.35 : 1}"/>`
  s += `<path d="${ridge(r, 242, 12, 0.017, 3)}" fill="${night ? '#2a2150' : held ? '#704d80' : '#8b5689'}"/>`
  // the town: rooftops, water tanks, lit windows
  for (let x = 236; x < 560;) {
    const w = 10 + r() * 22, h = 10 + r() * 26
    s += `<rect x="${n(x)}" y="${n(262 - h)}" width="${n(w)}" height="${n(h)}" fill="${night ? '#1d173a' : '#4a2f58'}"/>`
    if (r() < 0.4) s += `<rect x="${n(x + w * 0.5)}" y="${n(262 - h - 6)}" width="6" height="6" fill="#3a2448"/>`
    for (let wy = 262 - h + 4; wy < 258; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) if (r() < (night ? 0.5 : 0.25)) s += `<rect x="${n(wx)}" y="${n(wy)}" width="2" height="2.6" fill="#ffd07a"/>`
    x += w * (0.8 + r() * 0.4)
  }
  s += `<path d="${ridge(r, 270, 6, 0.02, 4)}" fill="${night ? '#140f26' : '#33223f'}"/>`
  // the electric pole and its wires
  s += `<rect x="258" y="168" width="4" height="132" fill="#1f1520"/><rect x="248" y="174" width="24" height="2.4" fill="#1f1520"/>`
  s += `<path d="M262 176 Q 520 214 ${ART_W} 170 M262 180 Q 520 222 ${ART_W} 184" stroke="#1f1520" stroke-width=".9" fill="none"/><path d="M250 176 Q 220 186 190 182" stroke="#1f1520" stroke-width=".9" fill="none"/>`
  // the kirana: string lights, painted sign, striped awning, the lit shop
  s += `<rect x="36" y="168" width="158" height="132" fill="${night ? '#1e1528' : '#3a2335'}"/><rect x="190" y="174" width="10" height="126" fill="${night ? '#7f86d8' : '#ff9a5c'}" opacity="${night ? 0.25 : 0.5}"/>`
  s += `<rect x="32" y="164" width="166" height="7" fill="#2a1828"/><rect x="58" y="176" width="22" height="13" fill="#ffcf7a"/><rect x="66" y="176" width="1.4" height="13" fill="#3a2335"/>`
  for (let i = 0; i <= 16; i++) { const x = 34 + i * 10, y = 168 + Math.sin((i / 16) * Math.PI) * 5; s += `<circle cx="${x}" cy="${n(y)}" r="3.2" fill="${['#ffd36e', '#ff7a5a', '#7fe0ff', '#c9a0ff'][i % 4]}" opacity="${night ? 0.85 : 0.5}" filter="url(#blur6)"/><circle cx="${x}" cy="${n(y)}" r="1.1" fill="#fffbe8"/>` }
  s += `<rect x="46" y="196" width="138" height="20" rx="2" fill="#d69c42"/><rect x="49" y="199" width="132" height="14" fill="#0e4a53"/><rect x="80" y="205" width="70" height="2" fill="#ffd27a" opacity=".85"/>`
  s += `<rect x="40" y="224" width="150" height="76" fill="url(#shopLit)"/><rect x="40" y="224" width="150" height="10" fill="#000" opacity=".2"/>`
  for (const y of [246, 264]) { s += `<rect x="46" y="${y}" width="138" height="2" fill="#7a4230"/>`; for (let x = 50; x < 180; x += 7 + r() * 5) s += `<rect x="${n(x)}" y="${n(y - 6 - r() * 4)}" width="4" height="${n(6 + r() * 4)}" fill="${['#c8102e', '#2a9d8f', '#f4b400', '#ff6fa6', '#6a4cff'][Math.floor(r() * 5)]}" opacity=".85"/>` }
  s += `<rect x="40" y="276" width="150" height="24" fill="#6a3826"/><rect x="40" y="276" width="150" height="3" fill="#a5643c"/>`
  for (let i = 0; i < 8; i++) { const x = 38 + i * 19.4, c = i % 2 ? '#e6c4b0' : '#a8323f'; s += `<rect x="${n(x)}" y="216" width="19.4" height="10" fill="${c}"/><circle cx="${n(x + 9.7)}" cy="226" r="9.7" fill="${c}"/>` }
  s += `<path d="M175 236 l4 -8 l4 8 l-4 8z" fill="#ff7a1a"/><circle cx="179" cy="236" r="7" fill="#ffb050" opacity=".55" filter="url(#blur6)"/>`
  // the neem tree, and grass catching the light
  if (night) s += `<ellipse cx="115" cy="292" rx="110" ry="16" fill="#ffc46a" opacity=".35" filter="url(#blur6)"/>`
  s += tree(r, 724, 300, 230, night ? '#8f9cf0' : '#ff9a52')
  s += `<path d="M0 300 L0 290 Q 200 284 400 290 T ${ART_W} 288 L${ART_W} 300Z" fill="#241a24"/>`
  for (let i = 0; i < 70; i++) { const x = 200 + r() * 520, h = 4 + r() * 8; s += `<path d="M${n(x)} 296 q 1 ${n(-h / 2)} ${n(2 + r() * 2)} ${n(-h)}" stroke="${night ? '#3c3866' : Math.abs(x - SUN.x) < 160 ? '#ffb45a' : '#7a5a3a'}" stroke-width="1" fill="none"/>` }
  if (night) for (let i = 0; i < 16; i++) { const x = 220 + r() * 460, y = 240 + r() * 55; s += `<circle cx="${n(x)}" cy="${n(y)}" r="3.4" fill="#e8ff9a" opacity=".35" filter="url(#blur6)"/><circle cx="${n(x)}" cy="${n(y)}" r="1" fill="#f6ffd0"/>` }
  s += `<rect width="${ART_W}" height="${ART_H}" filter="url(#grain)"/>`
  // ids are made unique per passport and variant, so several covers can share a page
  const k = `-${hash(id).toString(36)}${held ? 'h' : ''}${night ? 'n' : ''}`
  return s.replace(/id="([a-zA-Z0-9]+)"/g, `id="$1${k}"`).replace(/url\(#([a-zA-Z0-9]+)\)/g, `url(#$1${k})`)
}

/** Standalone SVG document, for turning the cover into an image. */
export const coverSvg = (id: string, held = false, w = ART_W, h = ART_H) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${ART_W} ${ART_H}" preserveAspectRatio="xMidYMid slice">${coverArt(id, held)}</svg>`
