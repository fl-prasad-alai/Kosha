// Kosha's opening: a kirana street at sunset. Painted in code (a sky shader, canvas silhouettes and
// baked SVG), animated with GSAP. The shop's khata and bills fly out towards the viewer, the street
// racks out of focus, and they fold into the credit passport.
import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

gsap.registerPlugin(MotionPathPlugin)

let low = false

// ───────────────────────── palette: a real sunset; the sun sits just above the hills, behind where the passport appears
const SUN = { x: 1060, y: 492 };
const P = {
  sky2: '#e5707b', sky3: '#ffb35e', haze: '#e99a98', sunCore: '#fff4d6', sunHalo: '#ffb35c',
  grassDark: '#2a2026', grassMid: '#3b2f2a', grassLight: '#ffae58', flower: '#ffd6a0',
  foot: '#8c6a6c', footJoint: '#5c4450', footLit: '#e89a6c', kerbA: '#b8833e', kerbB: '#1c1620', asphalt: '#45384a', line: '#b6968a',
  shadow: '#1d1430', wall: '#c27a5e', wallLit: '#ea9860', wallShade: '#7a4552', wallSide: '#ffa05e', wallDark: '#5e3342', trim: '#dcb6a6', stain: '#2c1420', brick: '#9a4a3c',
  sign: '#0b4650', signLit: '#16606a', signFrame: '#d69c42',
  awnA: '#b02f3b', awnAL: '#e0534f', awnAD: '#6c1c2d', awnB: '#e6c6b4', awnBD: '#a68072',
  int0: '#fff1bc', int1: '#f08a3c', wood: '#7a4230', woodLit: '#b36a44', woodDark: '#4a2418',
  iron: '#211a28', shutter: '#8a7690', shutterL: '#b8a0b4', shutterD: '#5e4c68', rust: '#7a3a20',
  bark: '#2a1c20', barkLit: '#ff9a55', barkDark: '#140c10', moss: '#4a4436',
  leafDeep: '#1d1520', leafShade: '#2a1e26', leafMid: '#3a2a2c', leafLit: '#7a4a34', leafHi: '#ff9a55',
  stone: '#a88272', stoneLit: '#dba888', jute: '#a8784e', juteDark: '#6e4a2e', win: '#1f1a36', winLit: '#ffcf6e',
  sil: '#211620', rim: '#ff9a52',
};

// ───────────────────────── helpers
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const n = (v) => Math.round(v * 10) / 10;
const h2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = h2(a), B = h2(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const C = (x, y, r, f, a = '') => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${f}" ${a}/>`;
const E = (x, y, rx, ry, f, a = '') => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${f}" ${a}/>`;
const R = (x, y, w, h, f, a = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${f}" ${a}/>`;
const Pa = (d, f, a = '') => `<path d="${d}" fill="${f}" ${a}/>`;
const S = (d, s, w, a = '') => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" ${a}/>`;
const lg = (id, stops, x2 = 0, y2 = 1, x1 = 0, y1 = 0) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
const tex = (id, bf, col, op, seed, a = 1.3, b = -0.5) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${bf}" numOctaves="3" seed="${seed}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${a} 0 0 0 ${b}" result="m"/><feFlood flood-color="${col}" flood-opacity="${op}"/><feComposite in2="m" operator="in"/><feComposite in2="SourceGraphic" operator="in" result="t"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="t"/></feMerge></filter>`;
const filters = () => `
<filter id="rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="roughS" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="9"/><feDisplacementMap in="SourceGraphic" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="b1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1"/></filter>
<filter id="b3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="b8" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="b20" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="20"/></filter>
${tex('plaster', '0.012 0.045', P.stain, 0.32, 12)}${tex('asph', '0.55', '#1d1d24', 0.3, 3, 1.6, -0.55)}${tex('grit', '0.09', '#2a2014', 0.16, 5)}${tex('bark', '0.025 0.22', '#1f140c', 0.4, 7)}`;

let Q = 1;
async function bake(parent, x, y, w, h, body, defs = '') {
  const W = Math.max(1, Math.round(w * Q)), H = Math.max(1, Math.round(h * Q));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x} ${y} ${w} ${h}"><defs>${filters()}${defs}</defs>${body}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  try { await img.decode(); } catch (e) { await new Promise((r) => { img.onload = r; img.onerror = r; }); }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  try { c.getContext('2d').drawImage(img, 0, 0, W, H); } catch (e) { console.warn('bake failed', e); }
  Object.assign(c.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  parent.appendChild(c);
  return c;
}

// ───────────────────────── the sky: a shader, so the light, colour and clouds behave like a real sunset
const SKY_VERT = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }';
const SKY_FRAG = `precision highp float;
varying vec2 vUv; uniform float uTime; uniform vec2 uRes; uniform vec2 uSun; uniform float uHor; uniform float uSunR;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 6; i++){ s += a*noise(p); p = m*p; a *= 0.5; } return s; }
vec3 ramp(float h, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5, vec3 c6){
  if (h < 0.05) return mix(c0, c1, h/0.05);
  if (h < 0.13) return mix(c1, c2, (h-0.05)/0.08);
  if (h < 0.25) return mix(c2, c3, (h-0.13)/0.12);
  if (h < 0.42) return mix(c3, c4, (h-0.25)/0.17);
  if (h < 0.66) return mix(c4, c5, (h-0.42)/0.24);
  return mix(c5, c6, (h-0.66)/0.34);
}
void main(){
  vec2 uv = vUv; float asp = uRes.x/uRes.y;
  float yh = uHor;
  float h = clamp((uv.y - yh)/(1.0 - yh), 0.0, 1.0);
  vec2 d2 = vec2((uv.x - uSun.x)*asp, uv.y - uSun.y); float d = length(d2);
  float sunF = exp(-pow((uv.x - uSun.x)*asp, 2.0)*0.9);
  // towards the sun: gold, orange, red, rose, purple, violet, indigo
  vec3 gs = ramp(h, vec3(1.0,0.87,0.55), vec3(1.0,0.66,0.30), vec3(0.97,0.43,0.26), vec3(0.86,0.31,0.42), vec3(0.58,0.27,0.54), vec3(0.32,0.20,0.48), vec3(0.12,0.10,0.29));
  // away from it: peach, pink and lavender
  vec3 ga = ramp(h, vec3(0.99,0.66,0.48), vec3(0.94,0.52,0.50), vec3(0.80,0.40,0.54), vec3(0.60,0.31,0.57), vec3(0.40,0.25,0.52), vec3(0.23,0.17,0.42), vec3(0.11,0.10,0.27));
  vec3 col = mix(ga, gs, sunF);
  col += vec3(1.0,0.66,0.32)*exp(-d*2.6)*0.45 + vec3(1.0,0.86,0.58)*exp(-d*9.0)*0.8;
  // clouds on a plane above the land, seen in perspective
  float t = max(uv.y - yh, 0.0);
  float fade = smoothstep(0.012, 0.13, t);
  float z = 0.34/(t + 0.04);
  vec2 cp = vec2((uv.x - 0.5)*asp*z*2.4 + uTime*0.012, z*3.2);
  vec2 w = vec2(fbm(cp*0.55 + vec2(1.7, 9.2)), fbm(cp*0.55 + vec2(8.3, 2.8)));
  float dens = fbm(cp*0.8 + w*1.5);
  float cov = mix(0.5, 0.47, h);
  float a = smoothstep(cov, cov + 0.11, dens)*fade;
  vec2 sd = normalize(vec2((uSun.x - uv.x)*asp*1.5, 1.0));
  float dens2 = fbm((cp + sd*0.35)*0.8 + w*1.5);
  float lit = clamp(0.55 + (dens - dens2)*3.2, 0.0, 1.0);
  vec3 litC = h < 0.3 ? mix(vec3(1.0,0.62,0.30), vec3(1.0,0.48,0.46), h/0.3) : mix(vec3(1.0,0.48,0.46), vec3(0.90,0.42,0.62), (h-0.3)/0.7);
  vec3 shadC = mix(vec3(0.40,0.20,0.36), vec3(0.17,0.12,0.30), h);
  vec3 cc = mix(shadC, litC, lit);
  float edge = smoothstep(cov, cov + 0.05, dens) - smoothstep(cov + 0.05, cov + 0.2, dens);
  cc += vec3(1.0,0.84,0.52)*edge*exp(-d*2.6)*1.5;
  cc += vec3(1.0,0.7,0.4)*exp(-d*3.5)*0.35;
  cc = mix(cc, col, 0.22*(1.0 - h));
  col = mix(col, cc, a*0.94);
  // thin dark streaks of cloud across the sun
  float y0 = uv.y - uSun.y;
  float band = smoothstep(-0.07, -0.03, y0)*(1.0 - smoothstep(0.03, 0.09, y0));
  float st = fbm(vec2(uv.x*3.5 + uTime*0.004, uv.y*62.0));
  float sa = smoothstep(0.52, 0.72, st)*band;
  vec3 stc = mix(vec3(0.42,0.20,0.33), vec3(1.0,0.72,0.42), exp(-d*7.0));
  // crepuscular rays
  float ang = atan(d2.y, d2.x);
  float ray = pow(noise(vec2(ang*16.0, 3.0)), 3.0)*exp(-d*1.4)*smoothstep(0.05, 0.12, d);
  col += vec3(1.0,0.72,0.46)*ray*0.22;
  // the sun
  float disc = smoothstep(uSunR*1.06, uSunR*0.94, d);
  col = mix(col, vec3(1.0,0.97,0.86), disc);
  col = mix(col, stc, sa*0.85);
  col += (hash(gl_FragCoord.xy) - 0.5)/255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
// ───────────────────────── procedural silhouettes (canvas 2D, painted once)
function cv(parent, x, y, w, h) {
  const c = document.createElement('canvas'); c.width = Math.round(w * Q); c.height = Math.round(h * Q);
  Object.assign(c.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  parent.appendChild(c); const g = c.getContext('2d'); g.setTransform(Q, 0, 0, Q, -x * Q, -y * Q); return [c, g];
}
const noise1 = (seed) => { const r = rng(seed), T = Array.from({ length: 512 }, r); return (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return T[i & 511] * (1 - u) + T[(i + 1) & 511] * u; }; };
const fbm1 = (seed) => { const ns = [0, 1, 2, 3, 4, 5].map((k) => noise1(seed + k * 17)); return (x) => { let a = 0.5, s = 0, f = 1, nn = 0; for (let k = 0; k < 6; k++) { s += a * ns[k](x * f); nn += a; a *= 0.5; f *= 2.03; } return s / nn; }; };
const rgba = (hex, a) => { const [r, g, b] = h2(hex); return `rgba(${r},${g},${b},${a})`; };
const sunBand = (g, y, a, spread = 420) => { const lg2 = g.createLinearGradient(SUN.x - spread, 0, SUN.x + spread, 0); lg2.addColorStop(0, 'rgba(255,170,100,0)'); lg2.addColorStop(0.5, `rgba(255,190,120,${a})`); lg2.addColorStop(1, 'rgba(255,170,100,0)'); return lg2; };

// hills fading into haze, each layer darker and nearer, with light catching the ridgelines
const RIDGES = [
  { base: 534, amp: 44, f: 0.0021, seed: 3, top: '#eaa6a2', col: '#d08c98', glow: 0.55, mist: '#f6b49a', rim: 0.25, tree: 1 },
  { base: 562, amp: 40, f: 0.0029, seed: 9, top: '#c98299', col: '#a7688e', glow: 0.42, mist: '#eb9b98', rim: 0.45, tree: 2 },
  { base: 596, amp: 32, f: 0.0042, seed: 15, top: '#90608a', col: '#6c4777', glow: 0.26, mist: '#cf8396', rim: 0.65, tree: 3.4 },
  { base: 632, amp: 22, f: 0.006, seed: 21, top: '#583d68', col: '#3a2a50', glow: 0.14, mist: null, rim: 0.85, tree: 5 },
];
function drawRidges(g) {
  RIDGES.forEach((L, li) => {
    const F = fbm1(L.seed), T = fbm1(L.seed + 100), ys = [];
    for (let x = 0; x <= 1600; x += 2) ys.push(L.base - L.amp * (F(x * L.f) * 1.7 - 0.55) - Math.max(0, T(x * 0.07) - 0.4) * L.tree * 7);
    const minY = Math.min(...ys);
    const path = new Path2D(); path.moveTo(0, 900); ys.forEach((y, i) => path.lineTo(i * 2, y)); path.lineTo(1600, 900); path.closePath();
    const gr = g.createLinearGradient(0, minY, 0, L.base + 60); gr.addColorStop(0, L.top); gr.addColorStop(1, L.col);
    g.fillStyle = gr; g.fill(path);
    g.save(); g.clip(path);
    const rg = g.createRadialGradient(SUN.x, L.base - 30, 0, SUN.x, L.base - 30, 560); rg.addColorStop(0, `rgba(255,176,120,${L.glow})`); rg.addColorStop(1, 'rgba(255,176,120,0)');
    g.fillStyle = rg; g.fillRect(0, minY - 10, 1600, 400);
    g.restore();
    const top = new Path2D(); ys.forEach((y, i) => (i ? top.lineTo(i * 2, y) : top.moveTo(0, y)));
    g.strokeStyle = sunBand(g, 0, L.rim, 520); g.lineWidth = 1.6; g.stroke(top);
    if (li === 2) { // Parvati hill and its temple, lit for the evening
      const tx = 780, ty = ys[tx / 2] - 4;
      g.fillStyle = mix(L.col, '#1a1030', 0.2);
      g.beginPath(); g.ellipse(tx, ty + 10, 64, 20, 0, Math.PI, 0); g.fill();
      g.fillRect(tx - 30, ty - 12, 60, 14); g.fillRect(tx - 22, ty - 20, 44, 9);
      g.beginPath(); g.moveTo(tx - 12, ty - 20); g.lineTo(tx - 12, ty - 34); g.quadraticCurveTo(tx, ty - 66, tx + 12, ty - 34); g.lineTo(tx + 12, ty - 20); g.fill();
      g.fillRect(tx - 0.8, ty - 84, 1.6, 20); g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(tx + 1, ty - 84); g.lineTo(tx + 14, ty - 79); g.lineTo(tx + 1, ty - 75); g.fill();
      g.shadowColor = '#ffcf6e'; g.shadowBlur = 6; g.fillStyle = '#ffd98a';
      for (let i = 0; i < 9; i++) g.fillRect(tx - 28 + i * 7, ty - 9, 2, 2);
      g.fillRect(tx - 1, ty - 40, 2, 2); g.shadowBlur = 0;
    }
    if (L.mist) { const mg = g.createLinearGradient(0, L.base - 24, 0, L.base + 56); mg.addColorStop(0, rgba(L.mist, 0)); mg.addColorStop(0.5, rgba(L.mist, 0.55)); mg.addColorStop(1, rgba(L.mist, 0)); g.fillStyle = mg; g.fillRect(0, L.base - 24, 1600, 80); }
  });
}

// a real-looking tree: branching structure, ragged foliage, a rim of sunlight on the side facing the sun
function treeShape(x0, y0, H, seed, spread = 1) {
  const r = rng(seed), segs = [], leaves = [];
  const br = (x, y, a, len, w, d) => {
    const bend = (r() - 0.5) * 0.5, x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    segs.push([x, y, x + Math.cos(a + bend) * len * 0.5, y + Math.sin(a + bend) * len * 0.5, x2, y2, w]);
    if (d === 0 || len < 10) { leaves.push([x2, y2, (18 + r() * 22) * spread]); return; }
    const nb = 2 + (r() < 0.45 ? 1 : 0);
    for (let i = 0; i < nb; i++) br(x2, y2, a + (i - (nb - 1) / 2) * (0.42 + r() * 0.36) * spread + (r() - 0.5) * 0.25, len * (0.66 + r() * 0.14), w * 0.64, d - 1);
    if (d <= 3 && r() < 0.55) leaves.push([x2, y2, (16 + r() * 18) * spread]);
  };
  br(x0, y0, -Math.PI / 2 + (r() - 0.5) * 0.12, H * 0.3, Math.max(3, H * 0.04), 6);
  const blobs = [];
  for (const [lx, ly, R] of leaves) { const nn = Math.round(R * 1.7); for (let i = 0; i < nn; i++) { const a = r() * 6.283, dd = R * Math.sqrt(r()); blobs.push([lx + Math.cos(a) * dd * 1.2, ly + Math.sin(a) * dd * 0.78, 1.6 + r() * (R / 6)]); } }
  return { segs, blobs };
}
function paintTree(g, shape, rimA = 1, dark = P.sil, off = 2.2) {
  const cx = shape.segs[0][0], cy = shape.segs[0][1] - 200;
  let dx = SUN.x - cx, dy = SUN.y - cy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const draw = (ox, oy) => {
    g.lineCap = 'round';
    for (const [x, y, qx, qy, x2, y2, w] of shape.segs) { g.lineWidth = w; g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(qx + ox, qy + oy, x2 + ox, y2 + oy); g.stroke(); }
    g.beginPath(); for (const [x, y, rr] of shape.blobs) { g.moveTo(x + ox + rr, y + oy); g.arc(x + ox, y + oy, rr, 0, 6.283); } g.fill();
  };
  if (rimA > 0) { g.globalAlpha = rimA; g.fillStyle = g.strokeStyle = P.rim; draw(0, 0); g.globalAlpha = 1; }
  g.fillStyle = g.strokeStyle = dark; draw(-dx * off, -dy * off);
}
function palm(g, x, y, H, lean, col) {
  g.strokeStyle = g.fillStyle = col; g.lineCap = 'round';
  const tx = x + lean, ty = y - H;
  g.lineWidth = 3.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.2, y - H * 0.6, tx, ty); g.stroke();
  for (let f = 0; f < 11; f++) {
    const a = (f / 11) * Math.PI * 2, L = H * (0.32 + (f % 3) * 0.05), ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.45 + L * 0.28;
    g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty - 10, ex, ey); g.stroke();
    for (let k = 1; k < 9; k++) { const t = k / 9, px = tx + (ex - tx) * t, py = ty + (ey - ty) * t - Math.sin(t * Math.PI) * 10 * (1 - t * 0.3); g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + 1.2) * 7 * (1 - t * 0.6), py + 7 * (1 - t * 0.5)); g.moveTo(px, py); g.lineTo(px + Math.cos(a - 1.2) * 7 * (1 - t * 0.6), py + 7 * (1 - t * 0.5)); g.stroke(); }
  }
}

// the town in silhouette: water tanks, antennas, a phone tower, windows and street lamps coming on
function drawTown(g) {
  const r = rng(41);
  const row = (b, hMin, hMax, colTop, colBot, litP, haze) => {
    for (let x = -10; x < 1610;) {
      const w = 16 + r() * 42, h = hMin + r() * (hMax - hMin);
      const gr = g.createLinearGradient(0, b - h, 0, b); gr.addColorStop(0, colTop); gr.addColorStop(1, colBot);
      g.fillStyle = gr; g.fillRect(x, b - h, w, h);
      if (r() < 0.22) { g.beginPath(); g.moveTo(x - 3, b - h); g.lineTo(x + w / 2, b - h - w * 0.28); g.lineTo(x + w + 3, b - h); g.fill(); }
      else { g.fillRect(x - 1, b - h - 3, w + 2, 3); if (r() < 0.5) { g.fillRect(x + w * 0.55, b - h - 13, 10, 10); g.beginPath(); g.ellipse(x + w * 0.55 + 5, b - h - 13, 5, 1.6, 0, 0, 6.283); g.fill(); } if (r() < 0.35) { g.fillRect(x + w * 0.2, b - h - 18, 1, 15); g.fillRect(x + w * 0.2 - 5, b - h - 16, 10, 1); } }
      // sunlight catching the edge that faces the sun
      g.fillStyle = sunBand(g, 0, 0.55 * (1 - haze), 600); const right = x + w < SUN.x;
      g.fillRect(right ? x + w - 1.4 : x, b - h, 1.4, h * 0.7);
      for (let wy = b - h + 5; wy < b - 6; wy += 10) for (let wx = x + 4; wx < x + w - 5; wx += 8) {
        if (r() < litP) { const warm = r() < 0.8; g.shadowColor = warm ? '#ffbe5c' : '#cfe2ff'; g.shadowBlur = 6; g.fillStyle = warm ? '#ffd07a' : '#e6f0ff'; g.fillRect(wx, wy, 3.2, 4.2); g.shadowBlur = 0; }
      }
      x += w * (0.75 + r() * 0.45);
    }
  };
  row(664, 14, 44, '#7a5076', '#5a3c62', 0.12, 0.6);
  // phone tower with its red light
  g.strokeStyle = '#3a2848'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(1180, 676); g.lineTo(1190, 560); g.lineTo(1200, 676); for (let y = 670; y > 566; y -= 10) { const k = (676 - y) / 116; g.moveTo(1180 + k * 10, y); g.lineTo(1200 - k * 10, y - 10); } g.stroke();
  g.shadowColor = '#ff3b30'; g.shadowBlur = 8; g.fillStyle = '#ff5a4a'; g.beginPath(); g.arc(1190, 558, 2.4, 0, 6.283); g.fill(); g.shadowBlur = 0;
  for (const [x, H, sd] of [[700, 70, 301], [1270, 84, 302], [930, 54, 303]]) paintTree(g, treeShape(x, 690, H, sd, 0.6), 0.6, '#3a2846', 1.4);
  for (const [x, H, ln] of [[860, 104, 10], [1010, 118, -14], [1112, 92, 8]]) palm(g, x, 694, H, ln, '#2f2240');
  row(694, 20, 70, '#4a3254', '#2c2038', 0.24, 0.2);
  // street lamps along the road beyond the field
  for (let x = 650; x < 1600; x += 96) { g.shadowColor = '#ffae4a'; g.shadowBlur = 12; g.fillStyle = '#ffd08a'; g.beginPath(); g.arc(x, 688, 2.2, 0, 6.283); g.fill(); g.shadowBlur = 0; g.fillStyle = '#2a1e30'; g.fillRect(x - 0.6, 690, 1.2, 8); }
  // the field in front, backlit
  const fg = g.createLinearGradient(0, 694, 0, 780); fg.addColorStop(0, '#4a3442'); fg.addColorStop(1, '#2a1f2a'); g.fillStyle = fg;
  g.beginPath(); g.moveTo(0, 700); for (let x = 0; x <= 1600; x += 20) g.lineTo(x, 696 + Math.sin(x * 0.01) * 3); g.lineTo(1600, 780); g.lineTo(0, 780); g.fill();
  const sg = g.createRadialGradient(SUN.x, 700, 0, SUN.x, 700, 520); sg.addColorStop(0, 'rgba(255,170,100,.45)'); sg.addColorStop(1, 'rgba(255,170,100,0)'); g.fillStyle = sg; g.fillRect(0, 694, 1600, 90);
}

function drawPole(g) {
  const c = P.sil;
  g.fillStyle = c; g.beginPath(); g.moveTo(752, 834); g.lineTo(756, 296); g.lineTo(766, 296); g.lineTo(770, 834); g.fill();
  g.fillStyle = sunBand(g, 0, 0.8, 500); g.fillRect(767, 296, 2, 538);
  g.fillStyle = c; g.fillRect(724, 314, 74, 7);
  for (const x of [732, 750, 774, 790]) g.fillRect(x - 2, 304, 4, 10);
  g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(768, 344); g.quadraticCurveTo(800, 324, 834, 334); g.stroke();
  g.beginPath(); g.moveTo(826, 330); g.lineTo(848, 332); g.lineTo(846, 340); g.lineTo(826, 338); g.fill();
  g.shadowColor = '#ffb050'; g.shadowBlur = 22; g.fillStyle = '#ffe2a0'; g.fillRect(830, 338, 16, 3); g.shadowBlur = 0;
  const lamp = g.createRadialGradient(838, 346, 0, 838, 346, 70); lamp.addColorStop(0, 'rgba(255,200,120,.45)'); lamp.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = lamp; g.fillRect(760, 280, 160, 140);
  g.strokeStyle = '#1a1018'; g.lineWidth = 1.3;
  for (const [x1, y1, x2, y2, cy] of [[732, 312, 1600, 296, 410], [750, 312, 1600, 318, 430], [774, 312, 1600, 340, 452], [790, 312, 1600, 362, 470], [732, 312, 652, 300, 330], [750, 312, 660, 306, 344]]) { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, cy, x2, y2); g.stroke(); }
  g.beginPath(); g.moveTo(770, 420); g.bezierCurveTo(786, 426, 786, 440, 770, 446); g.bezierCurveTo(754, 452, 754, 466, 770, 472); g.stroke();
  g.fillStyle = c; g.fillRect(764, 470, 12, 18);
}

function groundArt() {
  const r = rng(17);
  const defs = lg('pud', [[0, P.sky2], [1, P.sky3]]) + lg('kerbTop', [[0, '#ffffff', 0.5], [1, '#ffffff', 0]]);
  let s = R(0, 756, 1600, 80, P.foot, 'filter="url(#grit)"');
  const rows = [[756, 18], [774, 22], [796, 26], [822, 12]];
  for (const [y, h] of rows) { let x = -r() * 40; const tw = 40 + h * 1.6; while (x < 1600) { const w = tw * (0.85 + r() * 0.3); s += R(x + 1, y + 1, w - 2, h - 2, mix(P.foot, r() > 0.5 ? P.footLit : P.footJoint, r() * 0.35), 'rx="2"'); if (r() < 0.06) s += S(`M${n(x + w * 0.3)} ${y + 2} l6 ${n(h * 0.5)} l-3 ${n(h * 0.4)}`, P.footJoint, 1.2); if (r() < 0.05) s += S(`M${n(x)} ${y + h} q 2 -6 5 -9 M${n(x)} ${y + h} q -2 -5 -5 -7`, P.grassDark, 1.6); x += w; } }
  s += S('M0 757 h1600', P.footJoint, 2, 'opacity=".6"');
  for (let x = 0, i = 0; x < 1600; x += 58, i++) { s += R(x, 834, 58, 14, i % 2 ? P.kerbB : P.kerbA); if (i % 2 === 0) for (let k = 0; k < 3; k++) s += R(x + r() * 50, 836 + r() * 8, 3 + r() * 6, 2 + r() * 3, '#b9a89c', 'opacity=".8"'); }
  s += R(0, 834, 1600, 4, 'url(#kerbTop)');
  s += R(0, 848, 1600, 52, P.asphalt, 'filter="url(#asph)"');
  for (let i = 0; i < 4; i++) s += R(100 + r() * 1300, 856 + r() * 30, 60 + r() * 90, 10 + r() * 12, mix(P.asphalt, '#000000', 0.15), 'filter="url(#roughS)" opacity=".7"');
  for (let x = 30; x < 1600; x += 140) s += R(x, 856, 70, 3, P.line, 'opacity=".55"');
  s += E(290, 884, 34, 7, mix(P.asphalt, '#000000', 0.3)) + E(290, 883, 28, 5, mix(P.asphalt, '#ffffff', 0.08));
  // puddle holding the sunset, with the sun's reflection
  s += E(1010, 880, 120, 13, mix(P.asphalt, '#000000', 0.25), 'filter="url(#roughS)"') + E(1010, 879, 112, 11, 'url(#pud)', 'filter="url(#roughS)"') + E(1050, 879, 18, 5, P.sunCore, 'opacity=".9" filter="url(#b3)"');
  // long sunset shadows, falling away from the sun
  s += Pa('M150 794 L640 794 L420 900 L-80 900Z', P.shadow, 'opacity=".3" filter="url(#b3)"');
  s += Pa('M752 832 L772 832 L560 900 L534 900Z', P.shadow, 'opacity=".26" filter="url(#b3)"');
  for (let i = 0; i < 46; i++) s += E(1500 + (r() - 0.5) * 420, 820 + (r() - 0.5) * 70, 10 + r() * 34, 4 + r() * 9, P.shadow, 'opacity=".14" filter="url(#b3)"');
  for (let i = 0; i < 12; i++) s += E(1480 + (r() - 0.5) * 360, 816 + (r() - 0.5) * 50, 6 + r() * 10, 2 + r() * 3, P.footLit, 'opacity=".55" filter="url(#b1)"');
  // warm light from the sun raking across the footpath
  s += Pa('M780 756 L1300 756 L1380 846 L760 846Z', P.sunHalo, 'opacity=".28" filter="url(#b8)"') + E(1060, 880, 260, 16, P.sunHalo, 'opacity=".2" filter="url(#b8)"');
  let g = C(0, 0, 82, '#fffaf0') + C(0, 0, 74, '#2a9d5c');
  for (let i = 0; i < 18; i++) g += E(0, -58, 9, 15, '#e0307a', `transform="rotate(${i * 20})"`);
  g += C(0, 0, 46, '#fffaf0');
  for (let i = 0; i < 12; i++) g += E(0, -34, 8, 12, '#ffc21a', `transform="rotate(${i * 30 + 15})"`);
  for (let i = 0; i < 8; i++) g += E(0, -16, 6, 9, '#ff6a1a', `transform="rotate(${i * 45})"`);
  g += C(0, 0, 8, '#6a3fc4');
  for (let i = 0; i < 24; i++) g += C(Math.cos(i / 24 * 6.283) * 78, Math.sin(i / 24 * 6.283) * 78, 3, '#ffffff');
  for (const a of [0, 1.57, 3.14, 4.71]) g += C(Math.cos(a) * 96, Math.sin(a) * 96, 6, '#c2602a') + C(Math.cos(a) * 96, Math.sin(a) * 96 - 3, 3, '#ffd98a') + C(Math.cos(a) * 96, Math.sin(a) * 96 - 6, 10, '#ffcf6a', 'opacity=".5" filter="url(#b3)"');
  s += `<g transform="translate(400 815) scale(1 .26)" filter="url(#roughS)">${g}</g>`;
  return [s, defs];
}

// ───────────────────────── the shop
function products(base, x0, x1, r) {
  let s = '';
  const COL = ['#e63946', '#2a9d8f', '#ffb703', '#ff70a6', '#7b5cff', '#06d6a0', '#fb8500', '#3a86ff', '#c8102e', '#f4d35e'];
  for (let x = x0; x < x1;) {
    const t = r(), c = COL[Math.floor(r() * COL.length)];
    if (t < 0.25) { const w = 9, h = 22 + r() * 6; s += R(x, base - h, w, h, '#f4c542', 'rx="2" opacity=".9"') + R(x + 2, base - h - 6, 5, 7, '#d33', 'rx="1"') + R(x + 6, base - h + 3, 2, h - 6, '#fff7c2', 'opacity=".8"') + R(x, base - h * 0.55, w, 7, c); x += w + 3; }
    else if (t < 0.55) { const w = 14 + r() * 8, h = 16 + r() * 10; s += R(x, base - h, w, h, c) + R(x, base - h, 3, h, '#000', 'opacity=".18"') + R(x + w - 3, base - h, 3, h, '#fff', 'opacity=".25"') + R(x + 2, base - h * 0.6, w - 4, 4, '#fff', 'opacity=".75"'); x += w + 2; }
    else if (t < 0.8) { const w = 15, h = 18 + r() * 6; s += Pa(`M${n(x)} ${n(base)} q -2 ${n(-h * 0.5)} 1 ${n(-h)} l2 -3 h${n(w - 6)} l2 3 q 3 ${n(h * 0.5)} 1 ${n(h)}z`, c) + R(x + 3, base - h * 0.7, 3, h * 0.5, '#fff', 'opacity=".45"'); x += w + 2; }
    else { const w = 13, h = 14 + r() * 4; s += R(x, base - h, w, h, '#c9ccd4', 'rx="2"') + R(x, base - h * 0.75, w, h * 0.5, c) + R(x + w - 3, base - h, 2, h, '#fff', 'opacity=".6"'); x += w + 2; }
  }
  return s;
}
function shopArt() {
  const r = rng(29);
  const defs = lg('wallG', [[0, P.wallLit], [0.4, P.wall], [1, P.wallShade]], 0, 1, 1, 0) +
    lg('stainG', [[0, P.stain, 0.42], [1, P.stain, 0]]) + lg('signG', [[0, P.signLit], [1, P.sign]]) +
    `<radialGradient id="intG" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${P.int0}"/><stop offset="1" stop-color="${P.int1}"/></radialGradient>` +
    lg('winG', [[0, '#ffd98e'], [1, '#d9773a']]) + lg('glassG', [[0, '#ffffff', 0.35], [0.5, '#ffffff', 0.08], [1, '#ffffff', 0.2]], 1, 1) + lg('stepG', [[0, P.stoneLit], [0.25, P.stone], [1, mix(P.stone, '#000000', 0.18)]]);
  let s = '';
  // roof: water tank and dish antenna
  s += R(516, 284, 78, 6, P.iron) + R(522, 240, 66, 46, '#2b2c33') + R(574, 240, 10, 46, '#4c4e58') + R(526, 240, 6, 46, '#1c1d22');
  for (const y of [252, 264, 276]) s += R(522, y, 66, 2, '#3c3d46');
  s += E(555, 240, 33, 7, '#3c3d46') + E(555, 237, 9, 3, '#24252b');
  s += S('M205 286 L212 266', '#8a8a8a', 2.5) + E(205, 262, 20, 9, '#ecebe6', 'transform="rotate(-25 205 262)"') + E(207, 261, 13, 5, '#c9c6bd', 'transform="rotate(-25 207 261)"');
  // parapet with jaali
  s += R(138, 286, 516, 28, P.wallDark) + R(134, 281, 524, 7, P.trim);
  for (let x = 150; x < 640; x += 22) s += R(x, 293, 12, 14, mix(P.wallDark, '#000000', 0.3), 'rx="5"');
  // walls
  s += R(150, 312, 490, 462, 'url(#wallG)', 'filter="url(#plaster)"');
  s += Pa('M640 312 L672 328 L672 758 L640 774Z', P.wallSide, 'filter="url(#plaster)"') + Pa('M640 312 L672 328 L672 758 L640 774Z', P.sunHalo, 'opacity=".35"') + Pa('M658 281 L688 297 L688 330 L654 314Z', mix(P.trim, P.wallSide, 0.3));
  for (let i = 0; i < 16; i++) { const x = 156 + r() * 470, y = r() < 0.55 ? 312 : 420 + r() * 6; s += R(x, y, 4 + r() * 14, 40 + r() * 120, 'url(#stainG)', 'filter="url(#b3)"'); }
  s += Pa('M582 602 l38 -4 l6 18 l-8 14 l-34 2 l-6 -14z', P.brick, 'filter="url(#roughS)"') + S('M584 612 h36 M588 622 h30 M598 602 v10 M610 612 v10', mix(P.brick, '#ffffff', 0.4), 1.2);
  s += S('M612 352 l-6 14 l4 10 l-8 16 l3 12', mix(P.wallDark, '#000000', 0.35), 1.2) + S('M170 640 l7 12 l-3 9 l6 14', mix(P.wallDark, '#000000', 0.35), 1.1);
  s += `<linearGradient id="dusk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6c5390"/><stop offset=".6" stop-color="#a07a9a"/><stop offset="1" stop-color="#d8a08a"/></linearGradient>`;
  s += R(134, 281, 540, 494, 'url(#dusk)', 'style="mix-blend-mode:multiply"');
  s += Pa('M640 312 L672 328 L672 758 L640 774Z', '#ffb36a', 'opacity=".45"') + R(634, 300, 8, 470, '#ffb36a', 'opacity=".35" filter="url(#b3)"');
  // upper left window, chajja, open green shutters, grille
  s += R(184, 320, 132, 9, P.trim) + R(188, 329, 124, 12, P.shadow, 'opacity=".28" filter="url(#b3)"');
  s += R(206, 340, 86, 80, P.trim) + R(212, 346, 74, 68, 'url(#winG)');
  s += Pa('M214 346 h26 q-6 30 2 68 h-28z', '#f4e5b8') + S('M222 348 q-3 30 1 64 M231 348 q-4 30 1 64', '#d9c38c', 1.2);
  for (let x = 220; x < 286; x += 9) s += R(x, 346, 2, 68, P.iron);
  s += R(212, 378, 74, 2.5, P.iron) + C(249, 379, 7, 'none', `stroke="${P.iron}" stroke-width="2"`);
  s += Pa('M206 340 L184 346 L184 416 L206 420Z', '#3f8a63') + Pa('M292 340 L314 346 L314 416 L292 420Z', '#5fb37f') + S('M188 360 l14 -3 M188 380 l14 -3 M188 400 l14 -3', '#2d6a4b', 1.5) + S('M296 357 l14 3 M296 377 l14 3 M296 397 l14 3', '#3f8a63', 1.5);
  s += R(200, 420, 98, 6, P.trim) + R(204, 426, 90, 30, 'url(#stainG)', 'filter="url(#b3)"');
  // balcony: door, window, pots, money plant, railing
  s += R(470, 334, 62, 74, '#5c3b26') + R(474, 340, 24, 30, '#4a2e1d') + R(504, 340, 24, 30, '#4a2e1d') + R(499, 334, 4, 74, '#25160c');
  s += R(552, 340, 52, 46, P.trim) + R(556, 344, 44, 38, 'url(#winG)');
  for (let x = 560; x < 598; x += 8) s += R(x, 344, 2, 38, P.iron);
  for (const [x, c] of [[440, '#3e9b4f'], [578, '#5aa84a'], [606, '#2f7f45']]) { s += Pa(`M${x} 408 l2 -16 h18 l2 16z`, '#c2603a') + R(x + 1, 390, 20, 4, '#a64f2e'); for (let k = 0; k < 7; k++) s += E(x + 11 + (r() - 0.5) * 22, 384 - r() * 18, 6, 3.4, k % 3 ? c : P.leafLit, `transform="rotate(${n(r() * 180)} ${x + 11} 380)"`); }
  let vine = 'M617 392 C 622 410 614 424 620 440 C 624 452 618 462 622 470';
  s += S(vine, '#2f7f45', 1.6);
  for (let k = 0; k < 9; k++) { const y = 396 + k * 8.5, x = 619 + Math.sin(k) * 4; s += Pa(`M${n(x)} ${n(y)} c -7 -5 -9 3 0 8 c 9 -5 7 -13 0 -8z`, k % 2 ? '#4caf50' : '#7ccf5b', `transform="rotate(${k % 2 ? -30 : 30} ${n(x)} ${n(y)})"`); }
  s += R(426, 368, 204, 4, P.iron);
  for (let x = 430; x < 628; x += 10) s += R(x, 372, 2, 36, P.iron);
  for (let x = 445; x < 625; x += 30) s += C(x, 390, 6, 'none', `stroke="${P.iron}" stroke-width="1.8"`);
  s += R(424, 408, 208, 10, P.trim) + R(430, 418, 196, 10, P.shadow, 'opacity=".28" filter="url(#b3)"');
  s += S('M440 350 Q 532 362 624 350', '#555a66', 1);
  s += Pa('M598 354 h16 v22 l-8 -3 l-8 3z', '#4aa3d8');
  // painted sign (lettering is drawn live, on top)
  s += R(172, 432, 446, 70, P.signFrame, 'rx="4"') + R(178, 438, 434, 58, 'url(#signG)', 'filter="url(#grit)"');
  for (const x of [186, 604]) for (const y of [444, 490]) s += C(x, y, 2.6, '#9a9a9a');
  for (let i = 0; i < 6; i++) { const x = 186 + r() * 420; s += R(x, 444 + r() * 30, 2, 10 + r() * 16, P.rust, 'opacity=".45" filter="url(#b1)"'); }
  // Diwali string lights along the parapet and over the awning
  for (const [x1, x2, y0, sag] of [[140, 654, 284, 14], [162, 632, 498, 10]]) {
    for (let x = x1, i = 0; x <= x2; x += 13, i++) {
      const y = y0 + Math.sin(((x - x1) / (x2 - x1)) * Math.PI) * sag, c = ['#ffd36e', '#ff7a5a', '#7fe0ff', '#ffd36e', '#c9a0ff'][i % 5];
      s += C(x, y, 7, c, 'opacity=".55" filter="url(#b3)"') + C(x, y, 2.2, '#fffbe8');
    }
    s += S(`M${x1} ${y0} Q ${(x1 + x2) / 2} ${y0 + sag * 2} ${x2} ${y0}`, '#1a1018', 0.8, 'opacity=".6"');
  }
  s += R(330, 424, 130, 6, '#fff6d6', 'opacity=".9" rx="3"') + E(395, 440, 210, 30, '#fff1c4', 'opacity=".22" filter="url(#b8)"');
  // shutter drum, interior
  s += R(176, 540, 438, 12, P.iron) + R(176, 541, 438, 2, '#6a6f80');
  s += R(182, 552, 426, 220, 'url(#intG)');
  s += R(182, 552, 426, 34, '#000000', 'opacity=".2" filter="url(#b8)"') + R(182, 552, 22, 220, '#000000', 'opacity=".16" filter="url(#b8)"') + R(586, 552, 22, 220, '#000000', 'opacity=".16" filter="url(#b8)"');
  s += R(296, 556, 188, 14, '#fff7d0', 'opacity=".75" filter="url(#b8)"') + R(300, 560, 180, 5, '#fffef6', 'rx="2"');
  s += R(196, 572, 28, 38, '#ffffff') + R(198, 574, 24, 18, '#e2563f') + C(210, 583, 5, '#ffd166') + S('M200 598 h20 M200 603 h16', '#b9b0a0', 1);
  for (const y of [600, 636]) { s += products(y, 232, 572, r); s += R(186, y, 418, 6, P.woodLit) + R(186, y + 6, 418, 4, P.woodDark) + R(186, y + 10, 418, 10, '#000000', 'opacity=".14" filter="url(#b3)"'); }
  const SN = ['#ff006e', '#ffbe0b', '#3a86ff', '#fb5607', '#8338ec', '#06d6a0'];
  for (const x of [190, 584]) { s += S(`M${x + 9} 552 V 650`, '#7a5232', 1.2); for (let k = 0; k < 5; k++) { const y = 558 + k * 18; s += R(x, y, 18, 15, SN[(k + (x > 400 ? 2 : 0)) % 6], `rx="2" transform="rotate(${n((r() - 0.5) * 12)} ${x + 9} ${y + 7})"`) + Pa(`M${x + 3} ${y + 3} l5 9`, 'none', 'stroke="#ffffff" stroke-width="2" opacity=".6"'); } }
  // counter with glass showcase
  s += R(186, 662, 418, 10, P.woodLit) + R(186, 670, 418, 3, P.woodDark);
  s += R(190, 673, 410, 50, mix(P.int1, '#000000', 0.25));
  for (let x = 196; x < 594; x += 22) s += R(x, 688 + r() * 8, 18, 26, SN[Math.floor(r() * 6)], 'rx="2" opacity=".85"');
  s += R(190, 673, 410, 50, 'url(#glassG)') + Pa('M240 673 l26 0 l-30 50 l-26 0z', '#ffffff', 'opacity=".25"') + Pa('M420 673 l12 0 l-30 50 l-12 0z', '#ffffff', 'opacity=".2"');
  s += R(186, 723, 418, 50, P.wood);
  for (let y = 732; y < 770; y += 9) s += R(186, y, 418, 1.4, P.woodDark, 'opacity=".35"');
  s += R(186, 764, 418, 9, P.woodDark);
  // on the counter: scale, red khata, UPI standee, sweet jars
  s += R(226, 644, 76, 4, '#e8eaee') + R(232, 648, 64, 14, '#c6c9d1') + R(240, 652, 26, 7, '#2a1010') + R(242, 654, 22, 3, '#ff3b30');
  s += R(326, 646, 78, 16, '#b2121b') + R(326, 646, 78, 4, '#d8403a') + R(328, 654, 74, 2, '#fff1d6') + S('M352 646 v16', '#f2c14e', 1.5);
  s += R(438, 656, 44, 6, '#d9d9d9') + R(446, 610, 30, 48, '#ffffff') + R(446, 610, 30, 9, '#5b3fc4');
  for (let i = 0; i < 25; i++) if (r() > 0.45) s += R(451 + (i % 5) * 4, 624 + Math.floor(i / 5) * 4, 3.6, 3.6, '#1a1a2e');
  s += R(450, 648, 22, 4, '#1fbf88');
  for (const [x, lid] of [[500, '#e63946'], [534, '#ffb703'], [568, '#2a9d8f']]) { s += R(x, 628, 28, 34, '#ffffff', 'rx="6" opacity=".38"'); for (let k = 0; k < 7; k++) s += C(x + 5 + r() * 18, 640 + r() * 18, 3.2, SN[Math.floor(r() * 6)]); s += R(x + 2, 621, 24, 8, lid, 'rx="2"') + R(x + 20, 632, 3, 24, '#ffffff', 'opacity=".75"'); }
  // awning shadow on the opening
  s += R(182, 552, 426, 30, P.shadow, 'opacity=".26" filter="url(#b8)"');
  // stone step
  s += R(160, 772, 480, 22, 'url(#stepG)', 'filter="url(#grit)"');
  // sacks of rice, toor dal and wheat; crate of onions
  const sack = (cx, base, w, h, grain, gd) => {
    let g = E(cx - 14, base + 2, w * 0.62, 6, P.shadow, 'opacity=".32" filter="url(#b3)"');
    g += Pa(`M${cx - w / 2} ${base} q -5 ${-h * 0.5} 3 ${-h} h ${w - 6} q 8 ${h * 0.5} 3 ${h} z`, P.jute, 'filter="url(#grit)"');
    g += Pa(`M${cx - w / 2} ${base} q -5 ${-h * 0.5} 3 ${-h} h 10 q -6 ${h * 0.5} -2 ${h} z`, P.juteDark, 'opacity=".55"');
    for (let k = 1; k < 6; k++) g += S(`M${cx - w / 2 + 2} ${base - k * h / 6} h${w - 4}`, P.juteDark, 0.8, 'opacity=".35"');
    g += E(cx + 1, base - h, w / 2 + 4, 7, P.juteDark) + E(cx + 1, base - h - 1, w / 2 - 1, 5, grain);
    for (let k = 0; k < 14; k++) g += C(cx - w / 2 + 6 + r() * (w - 10), base - h - 3 + r() * 4, 1.2, gd);
    return g;
  };
  s += sack(76, 802, 52, 58, '#f8f3e6', '#ddd2b8') + sack(128, 806, 48, 50, '#f2b62a', '#c98d12') + sack(102, 818, 44, 34, '#c99450', '#9a6a2e');
  s += E(630, 806, 54, 6, P.shadow, 'opacity=".3" filter="url(#b3)"') + R(596, 772, 92, 36, '#b9864f') + R(596, 772, 92, 4, '#d9a46a');
  for (let x = 600; x < 684; x += 14) s += R(x, 780, 10, 26, '#9c6c3c', 'opacity=".55"');
  for (let k = 0; k < 16; k++) { const x = 604 + (k % 8) * 10.5 + r() * 3, y = 770 - Math.floor(k / 8) * 9 - r() * 3; s += C(x, y, 6.5, '#b8436a') + C(x + 2, y - 2, 3, '#e58aa5', 'opacity=".9"') + S(`M${n(x)} ${n(y - 6)} l1 -4`, '#7a8a3a', 1.2); }
  return [s, defs];
}
function awningArt() {
  const defs = lg('aA', [[0, P.awnAL], [0.55, P.awnA], [1, P.awnAD]]) + lg('aB', [[0, '#ffffff'], [0.55, P.awnB], [1, P.awnBD]]);
  let s = R(160, 498, 474, 6, P.iron) + R(160, 498, 474, 2, '#6a6f80');
  const w = 46.6;
  for (let i = 0; i < 10; i++) { const x = 164 + i * w, g = i % 2 ? 'aB' : 'aA'; s += R(x, 504, w, 40, `url(#${g})`) + C(x + w / 2, 544, w / 2, i % 2 ? P.awnBD : P.awnAD) + R(x + w - 5, 504, 5, 40, '#ffffff', 'opacity=".12"') + R(x, 504, 1.4, 40, '#000000', 'opacity=".12"'); }
  return [s, defs];
}
function shutterArt() {
  const r = rng(91);
  let s = '';
  for (let y = 548; y < 760; y += 9) s += R(182, y, 426, 9, P.shutter) + R(182, y, 426, 2.4, P.shutterL) + R(182, y + 7, 426, 2, P.shutterD);
  for (let i = 0; i < 9; i++) s += R(190 + r() * 400, 556 + r() * 160, 3 + r() * 4, 20 + r() * 50, P.rust, 'opacity=".28" filter="url(#b1)"');
  s += R(182, 760, 426, 14, P.iron) + R(370, 752, 50, 8, '#5e6474', 'rx="3"') + R(386, 762, 18, 14, '#c99a2e', 'rx="3"') + C(395, 760, 6, 'none', 'stroke="#9a9a9a" stroke-width="2.4"');
  return [s, ''];
}
function lanternArt() {
  let s = S('M588 546 V 572', '#3a3a3a', 1.2);
  let star = '';
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283 - 1.571, rr = i % 2 ? 15 : 27; star += `${i ? 'L' : 'M'}${n(588 + Math.cos(a) * rr)} ${n(600 + Math.sin(a) * rr * 0.95)} `; }
  s += Pa(star + 'Z', '#ff7a1a', 'stroke="#ffd166" stroke-width="1.6"') + C(588, 600, 13, '#ffcf6a') + C(594, 594, 5, '#fff3c4', 'opacity=".9"');
  for (let i = 0; i < 7; i++) s += S(`M${578 + i * 3.3} 624 v${22 + (i % 3) * 6}`, i % 2 ? '#ff5a36' : '#ffc23d', 1.6);
  return [s, ''];
}
function sariArt() {
  let s = Pa('M470 352 Q 528 362 586 352 L 584 404 Q 560 414 530 406 Q 500 414 472 404 Z', '#d6247a');
  s += S('M472 400 Q 500 410 530 402 Q 560 410 584 400', '#f2c14e', 5) + S('M476 360 L 474 398 M500 360 L 498 404 M526 362 L 524 400 M552 360 L 550 404', '#9a1458', 3, 'opacity=".35"') + S('M488 360 L 486 400 M540 362 L 538 402', '#ff6fae', 2.5, 'opacity=".5"');
  return [s, ''];
}
function frontArt() {
  const r = rng(55);
  let s = '<g filter="url(#b3)">';
  for (let i = 0; i < 60; i++) { const x = -20 + r() * 230, h = 40 + r() * 70; s += S(`M${n(x)} 905 q ${n((r() - 0.3) * 30)} ${n(-h * 0.6)} ${n((r() - 0.2) * 40)} ${n(-h)}`, r() > 0.5 ? P.grassDark : P.grassMid, n(3 + r() * 3)); }
  for (let i = 0; i < 8; i++) { const x = r() * 200, y = 830 + r() * 40; s += C(x, y, 6, P.flower) + C(x, y, 2.6, '#ffc21a'); }
  for (let i = 0; i < 40; i++) { const x = 1450 + r() * 170, y = 810 + r() * 100; s += E(x, y, 16, 7, r() > 0.5 ? P.leafMid : P.leafShade, `transform="rotate(${n(r() * 180)} ${n(x)} ${n(y)})"`); }
  s += '</g>';
  let t = '<g filter="url(#b3)">';
  t += S('M1640 -20 C 1560 30 1500 60 1430 110', P.bark, 9);
  for (let i = 0; i < 70; i++) { const u = r(), x = 1640 - u * 210 + (r() - 0.5) * 40, y = -20 + u * 130 + (r() - 0.5) * 40; t += E(x, y, 14, 5, r() > 0.6 ? P.leafLit : r() > 0.3 ? P.leafMid : P.leafShade, `transform="rotate(${n(r() * 180)} ${n(x)} ${n(y)})"`); }
  t += '</g>';
  return [s, t];
}


// ───────────────────────── the intro, as one self-contained engine
// The painted street is a 1600×900 diorama. It is scaled to cover any screen: landscape screens see
// the whole street; portrait phones see the shop, the pole and the sun, with more sky above.
// The papers, the passport and the wordmark are laid out in screen space, so they fit every size.
const TEMPLATE = `<div class="kintro">
  <div class="ki-bg">
    <canvas class="ki-sky"></canvas>
    <div class="ki-scene">
      <div class="ki-l" data-k="ridge" data-d="0.3"></div>
      <div class="ki-l" data-k="hills" data-d="0.45"></div>
      <canvas class="ki-grass" data-d="0.6"></canvas>
      <div class="ki-l" data-k="ground" data-d="0.8"></div>
      <div class="ki-l" data-k="pole" data-d="0.75"></div>
      <div class="ki-l" data-k="tree" data-d="0.82"></div>
      <div class="ki-l" data-k="shop" data-d="0.9"><div class="ki-glow ki-spill"></div></div>
      <div class="ki-l" data-d="0.75"><svg class="ki-birds" width="1600" height="900" viewBox="0 0 1600 900"></svg></div>
      <div class="ki-l" data-k="front" data-d="1.15"></div>
      <canvas class="ki-fx"></canvas>
      <svg class="ki-wind" width="1600" height="900" viewBox="0 0 1600 900" fill="none" stroke="#fff" stroke-linecap="round"></svg>
    </div>
    <div class="ki-bloom"></div>
    <div class="ki-veil"></div>
  </div>
  <div class="ki-fg">
    <div class="ki-papers"></div>
    <svg class="ki-burst" viewBox="-320 -320 640 640" aria-hidden="true"><g class="ki-burst-g"></g></svg>
    <div class="ki-mark"><h2>Kosha<span>.</span></h2><p>The AI credit passport for every corner shop</p></div>
    <div class="ki-card"><div class="ki-card-in">
      <div class="pp-top"><svg width="20" height="20" viewBox="0 0 64 64" fill="none"><path d="M32 6 54 18v16c0 12-9.5 20.5-22 24C19.5 54.5 10 46 10 34V18Z" stroke="#ffd27a" stroke-width="5" stroke-linejoin="round"/><circle cx="32" cy="31" r="8.5" stroke="#ffd27a" stroke-width="4.5"/></svg>KOSHA<small>CREDIT PASSPORT</small></div>
      <div class="pp-name">Sharma General Store</div>
      <div class="pp-sub">Sunita Sharma · Kothrud, Pune</div>
      <div class="pp-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="7"/><circle class="ki-arc" cx="50" cy="50" r="38" fill="none" stroke="#ffc94d" stroke-width="7" stroke-linecap="round" stroke-dasharray="238.76" stroke-dashoffset="238.76"/></svg><div class="num"><b class="ki-score">300</b><span>A · OF 900</span></div></div>
      <div class="pp-grid"><div><small>Offer</small><b>₹80,000</b></div><div><small>Tenure</small><b>12 months</b></div></div>
      <div class="pp-foot"><span>KSH-IN-8BE504</span><span>● Verified</span></div>
    </div></div>
  </div>
  <div class="ki-grade"></div>
  <div class="ki-grain"></div>
  <button type="button" class="ki-skip">Skip intro</button>
</div>`;

let layers = {};
const live = { clumps: [], awning: null, shutter: null, lantern: null, sari: null, corner: null };
let root = null;
const $ = (s) => root.querySelector(s);

async function paintAll() {
  const keepSpill = $('.ki-spill');
  live.clumps = [];
  drawRidges(cv(layers.ridge, 0, 380, 1600, 340)[1]);
  drawTown(cv(layers.hills, 0, 520, 1600, 270)[1]);
  drawPole(cv(layers.pole, 640, 280, 960, 560)[1]);
  const [treeC, tg] = cv(layers.tree, 860, -40, 800, 870);
  paintTree(tg, treeShape(1432, 806, 640, 77, 1.05), 1, P.sil, 2.4);
  tg.fillStyle = '#5d4330'; tg.beginPath(); tg.ellipse(1430, 804, 56, 9, 0, 0, 6.283); tg.fill();
  for (let i = 0; i < 8; i++) { tg.fillStyle = i % 2 ? '#8a3a34' : '#b9a59a'; tg.fillRect(1374 + i * 14, 804, 14, 14); }
  treeC.style.transformOrigin = `${1432 - 860}px ${806 + 40}px`; live.clumps.push(treeC);
  const ground = groundArt(), shop = shopArt();
  await Promise.all([bake(layers.ground, 0, 740, 1600, 160, ground[0], ground[1]), bake(layers.shop, 40, 220, 700, 610, shop[0], shop[1])]);
  const sh = shutterArt(); const clip = document.createElement('div'); clip.className = 'ki-clip';
  layers.shop.appendChild(clip);
  live.shutter = await bake(clip, 182, 548, 426, 226, sh[0]); live.shutter.style.left = '0px'; live.shutter.style.top = '0px';
  const glow = document.createElement('div'); glow.className = 'ki-glow ki-interior'; layers.shop.appendChild(glow);
  const aw = awningArt(); live.awning = await bake(layers.shop, 156, 494, 482, 76, aw[0], aw[1]); live.awning.style.transformOrigin = '50% 0%';
  const sa = sariArt(); live.sari = await bake(layers.shop, 462, 346, 132, 74, sa[0]); live.sari.style.transformOrigin = '50% 0%';
  const kg = document.createElement('div'); kg.className = 'ki-glow ki-kandil'; layers.shop.appendChild(kg);
  const ln = lanternArt(); live.lantern = await bake(layers.shop, 556, 544, 64, 112, ln[0]); live.lantern.style.transformOrigin = '32px 2px';
  const sign = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sign.setAttribute('class', 'ki-sign'); sign.setAttribute('viewBox', '172 432 446 70');
  sign.innerHTML = `<text x="395" y="476" text-anchor="middle" font-family="'Yatra One', Kalam, sans-serif" font-size="36" fill="#fff6dc" stroke="${P.sign}" stroke-width=".5">शर्मा जनरल स्टोर</text><text x="395" y="493" text-anchor="middle" font-family="'Geist Variable', Geist, sans-serif" font-weight="600" font-size="10.5" letter-spacing="2.4" fill="#ffd27a">SHARMA GENERAL STORE · KARVE ROAD, KOTHRUD</text>`;
  layers.shop.appendChild(sign);
  layers.shop.appendChild(keepSpill);
  const fr = frontArt();
  await bake(layers.front, -30, 760, 280, 150, fr[0]); await bake(layers.front, 1420, 790, 200, 120, fr[0]);
  live.corner = await bake(layers.front, 1380, -60, 260, 220, fr[1]); live.corner.style.transformOrigin = '100% 0%';
  buildCat(); buildBirds();
}

function buildCat() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ki-cat'); svg.setAttribute('viewBox', '-60 -40 110 60');
  svg.innerHTML = `<ellipse cx="-4" cy="14" rx="40" ry="5" fill="${P.shadow}" opacity=".3"/><g class="ki-tail"><path d="M-24 6 C -48 4 -52 -12 -40 -18" stroke="#e98a38" stroke-width="7" fill="none" stroke-linecap="round"/></g><ellipse cx="0" cy="2" rx="27" ry="13" fill="#f6a24f"/><path d="M-8 -10 q4 10 0 24 M4 -11 q4 10 0 26" stroke="#e07f32" stroke-width="3" fill="none"/><ellipse cx="6" cy="-6" rx="14" ry="5" fill="#ffd29a" opacity=".55"/><circle cx="22" cy="-5" r="11" fill="#f6a24f"/><g class="ki-ears"><path d="M14 -13 l3 -10 l6 7z M25 -15 l6 -8 l2 10z" fill="#f6a24f"/><path d="M16 -14 l2 -5 l3 4z" fill="#ffb7a0"/></g><path d="M18 -5 q3 2 6 0 M26 -5 q2 1.5 4 0" stroke="#5a3a1e" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="27" cy="0" r="1.4" fill="#d9706a"/>`;
  layers.shop.appendChild(svg);
}
const quad = (t, x1, y1, cx, cy, x2, y2) => { const u = 1 - t; return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]; };
function buildBirds() {
  const svg = $('.ki-birds'); svg.innerHTML = '';
  for (const t of [0.1, 0.135, 0.17]) {
    const [x, y] = quad(t, 732, 312, 1166, 410, 1600, 296);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.dataset.x = x; g.dataset.y = y;
    g.innerHTML = `<g class="b"><path d="M-12 2 l-9 5 l7 -7z" fill="#1d1219"/><ellipse cx="0" cy="-1" rx="11" ry="7.5" fill="#24161d"/><path d="M8 -6 q-12 -6 -18 4" stroke="#ff9a52" stroke-width="1.2" fill="none" opacity=".7"/><circle cx="9" cy="-8" r="6" fill="#1a1016"/><path d="M14 -8 l6 1.5 l-6 1.5z" fill="#f2c200"/><path d="M-2 6 v6 M3 6 v6" stroke="#f2c200" stroke-width="1.6"/></g>`;
    svg.appendChild(g); gsap.set(g, { x, y: y - 12 });
  }
}

// grass that moves as a wave of light, petals and dust on the wind
const wind = { g: 0 };
let grassC, gctx, fxC, fctx, blades = [], parts = [];
function initGrass() {
  const q = Math.min(Q, low ? 0.7 : 1.5); grassC.width = 1600 * q; grassC.height = 170 * q; gctx.setTransform(q, 0, 0, q, 0, 0);
  const r = rng(5); blades = [];
  for (let i = 0; i < (low ? 420 : 1100); i++) { const x = r() * 1600; if (x > 145 && x < 650) continue; const d = Math.pow(r(), 0.65), y = 92 + d * 70; blades.push({ x, y, h: (7 + d * 24) * (0.6 + r() * 0.6), w: 1 + d * 1.6, f: r() < 0.05, ph: r() * 6 }); }
  blades.sort((a, b) => a.y - b.y);
}
function drawGrass(t) {
  gctx.clearRect(0, 0, 1600, 170);
  const steps = 6, buckets = Array.from({ length: steps * 2 }, () => []);
  const cols = Array.from({ length: steps }, (_, i) => mix(P.grassMid, P.grassLight, i / (steps - 1)));
  const flowers = [];
  for (const b of blades) {
    const wave = Math.sin(b.x * 0.008 - t * 1.7 + Math.sin(b.x * 0.002) * 2) * 0.5 + 0.5;
    const bend = (0.25 + wave * 0.75) * (4 + wind.g * 16) * (b.h / 28) + Math.sin(t * 3 + b.ph) * 0.6;
    const tx = b.x + bend, ty = b.y - b.h + Math.abs(bend) * 0.3;
    buckets[Math.min(steps - 1, Math.floor(wave * wave * steps)) * 2 + (b.w > 1.8 ? 1 : 0)].push([b.x, b.y, b.x + bend * 0.25, b.y - b.h * 0.6, tx, ty]);
    if (b.f) flowers.push([tx, ty]);
  }
  gctx.lineCap = 'round';
  buckets.forEach((arr, i) => { if (!arr.length) return; gctx.strokeStyle = cols[Math.floor(i / 2)]; gctx.lineWidth = i % 2 ? 2.4 : 1.4; gctx.beginPath(); for (const [x, y, cx, cy, ex, ey] of arr) { gctx.moveTo(x, y); gctx.quadraticCurveTo(cx, cy, ex, ey); } gctx.stroke(); });
  gctx.fillStyle = P.flower; for (const [x, y] of flowers) { gctx.beginPath(); gctx.arc(x, y, 2.2, 0, 6.283); gctx.fill(); }
}
function initFx() {
  const q = Math.min(Q, low ? 0.6 : 1.25); fxC.width = 1600 * q; fxC.height = 900 * q; fctx.setTransform(q, 0, 0, q, 0, 0);
  const r = rng(13); parts = [];
  for (let i = 0, N = low ? 8 : 34; i < N; i++) { const k = r(); parts.push({ x: r() * 1600, y: 120 + r() * 650, s: 0.7 + r() * 0.8, ph: r() * 6, vr: (r() - 0.5) * 3, rot: r() * 6, type: k < 0.45 ? 'petal' : k < 0.8 ? 'leaf' : 'mote', c: ['#ff9f1c', '#ffc23d', '#ff7b54'][Math.floor(r() * 3)] }); }
}
function drawFx(t, dt) {
  fctx.clearRect(0, 0, 1600, 900);
  for (const p of parts) {
    const w = 0.5 + wind.g * 3.2;
    if (p.type === 'mote') { p.x += (8 + w * 20) * dt; p.y += Math.sin(t * 0.8 + p.ph) * 4 * dt; }
    else { p.x += (40 + w * 160) * p.s * dt; p.y += (Math.sin(t * 1.6 + p.ph) * 26 + 10 - wind.g * 30) * dt; p.rot += p.vr * dt * (1 + wind.g * 2); }
    if (p.x > 1640) { p.x = -30; p.y = 140 + Math.random() * 600; }
    if (p.y > 900) p.y = 120;
    if (p.y < 60) p.y = 700;
    fctx.save(); fctx.translate(p.x, p.y);
    if (p.type === 'mote') { fctx.fillStyle = `rgba(255,250,220,${0.35 + Math.sin(t * 2 + p.ph) * 0.25})`; fctx.beginPath(); fctx.arc(0, 0, 2.2 * p.s, 0, 6.283); fctx.fill(); }
    else { fctx.rotate(p.rot); fctx.scale(1, Math.sin(t * 4 + p.ph)); fctx.fillStyle = p.type === 'petal' ? p.c : P.leafMid; fctx.beginPath(); fctx.ellipse(0, 0, (p.type === 'petal' ? 6 : 8) * p.s, (p.type === 'petal' ? 3.6 : 3) * p.s, 0, 0, 6.283); fctx.fill(); }
    fctx.restore();
  }
}

const PAPERS = [
  { cls: 'pg', html: '<b>खाता · 12 अक्टू</b><div><span>दूध, ब्रेड</span><span>3,480</span></div><div><span>UPI</span><span>8,250</span></div><div><span>माल</span><span>21,600</span></div><div><span>उधार रमेश</span><span>450</span></div><div><span>बिजली</span><span>1,180</span></div>' },
  { cls: 'pg', html: '<b>13 अक्टू</b><div><span>बिक्री</span><span>14,200</span></div><div><span>किराना माल</span><span>6,200</span></div><div><span>उधार वापस</span><span>900</span></div><div><span>गैस</span><span>1,050</span></div><div><span>जमा</span><span>12,000</span></div>' },
  { cls: 'bill', html: '<header>गुप्ता ट्रेडर्स<small>GUPTA TRADERS · WHOLESALE</small></header><div><span>Atta 50 kg</span><span>9,800</span></div><div><span>Toor dal 20 kg</span><span>4,200</span></div><div><span>Oil 30 L</span><span>5,400</span></div><div><span>Sugar 25 kg</span><span>2,200</span></div><div class="tot"><span>Total</span><span>₹21,600</span></div>' },
  { cls: 'phone', html: '<div class="scr"><i><svg width="14" height="14" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></i><b>₹8,250</b><span>received today</span><span>UPI · 214 payments</span></div>' },
  { cls: 'elec', html: '<b><svg width="14" height="14" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-2 8 10-13h-6z" fill="#f08c00"/></svg>Electricity bill</b><div>October 2026</div><div>Units 412 kWh</div><div>Amount ₹1,180</div><span class="paid">Paid on time</span>' },
];

// where everything sits on this screen
function computeLayout() {
  const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight, portrait = W < H;
  const s = portrait ? Math.min(W / 860, H / 900) : Math.max(H / 900, W / 1600);
  let ox = W / 2 - (portrait ? 560 : 800) * s; ox = Math.min(0, Math.max(W - 1600 * s, ox));
  let oy = H - 900 * s;
  if (oy < 0) oy = Math.min(0, Math.max(H - 900 * s, 0.6 * H - 560 * s));
  const sun = { x: ox + SUN.x * s, y: oy + SUN.y * s };
  const khata = { x: ox + 365 * s, y: oy + 652 * s };
  let ps, fan, cs, card, mark;
  if (!portrait) {
    ps = Math.max(0.55, Math.min(W / 700, H / 330, 1.55));
    const gap = 128 * ps;
    fan = [0, 1, 2, 3, 4].map((i) => [W / 2 + (i - 2) * gap, H * 0.5 + Math.abs(i - 2) * 10 * ps, (i - 2) * 5]);
    cs = Math.max(0.5, Math.min((H * 0.66) / 400, (W * 0.34) / 300, 1.6));
    const cx = Math.min(W - 150 * cs - 16, Math.max(sun.x, W * 0.62)), cy = H * 0.5;
    card = { x: cx, y: cy };
    const left = Math.max(20, W * 0.07), room = cx - 150 * cs - left - 24, size = Math.max(34, Math.min(190, room / 3.3));
    mark = { left, top: cy - size * 0.72, width: room, size, align: 'left' };
  } else {
    ps = Math.max(0.55, Math.min(W / 396, H / 545, 1.4));
    const gap = 124 * ps, y1 = H * 0.42, y2 = y1 + 160 * ps;
    fan = [[W / 2 - gap, y1, -6], [W / 2, y1 - 8 * ps, 0], [W / 2 + gap, y1, 6], [W / 2 - gap / 2, y2, -4], [W / 2 + gap / 2, y2, 4]];
    cs = Math.max(0.5, Math.min((W * 0.74) / 300, (H * 0.5) / 400, 1.2));
    card = { x: W / 2, y: Math.max(H * 0.58, 200 * cs + H * 0.24) };
    const size = Math.max(40, Math.min(96, W / 3.6));
    mark = { left: 16, top: Math.max(28, card.y - 200 * cs - size * 1.75), width: W - 32, size, align: 'center' };
  }
  return { W, H, s, ox, oy, sun, khata, ps, fan, cs, card, mark, portrait };
}

let L = null, story = null, ambient = null, sky = null, raf = 0, dead = false, frozen = false;
function applyLayout() {
  L = computeLayout();
  const { W, H, s, ox, oy, sun, mark, card, cs } = L;
  $('.ki-scene').style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
  $('.ki-bg').style.transformOrigin = `${L.khata.x}px ${L.khata.y}px`;
  root.style.setProperty('--sx', sun.x + 'px'); root.style.setProperty('--sy', sun.y + 'px');
  const m = $('.ki-mark'); Object.assign(m.style, { left: mark.left + 'px', top: mark.top + 'px', width: mark.width + 'px', fontSize: mark.size + 'px', textAlign: mark.align });
  Object.assign($('.ki-card').style, { left: card.x - 150 + 'px', top: card.y - 200 + 'px' });
  Object.assign($('.ki-burst').style, { left: card.x - 320 * cs + 'px', top: card.y - 320 * cs + 'px', width: 640 * cs + 'px', height: 640 * cs + 'px' });
  if (sky) { sky.size(W, H, Math.min(devicePixelRatio || 1, 1.25) * (low ? 0.45 : 0.8)); sky.draw(performance.now() / 1000, sun, s); }
}

function makeSkyGL(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, SKY_VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, SKY_FRAG)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (k) => gl.getUniformLocation(pr, k);
  const uT = u('uTime'), uR = u('uRes'), uS = u('uSun'), uH = u('uHor'), uZ = u('uSunR');
  let w = 1, h = 1;
  return {
    size(W, H, q) { canvas.width = Math.max(1, Math.round(W * q)); canvas.height = Math.max(1, Math.round(H * q)); w = W; h = H; gl.viewport(0, 0, canvas.width, canvas.height); },
    draw(time, sun, s) { gl.uniform1f(uT, time); gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform2f(uS, sun.x / w, 1 - sun.y / h); gl.uniform1f(uH, 1 - (L.oy + 545 * s) / h); gl.uniform1f(uZ, (33 * s) / h); gl.drawArrays(gl.TRIANGLES, 0, 3); },
    lose() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}

function startAmbient() {
  ambient && ambient.kill();
  ambient = gsap.timeline();
  if (low) return;
  live.clumps.forEach((c) => ambient.to(c, { rotation: -0.35, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0));
  ambient.to(live.awning, { scaleY: 0.96, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
    .to(live.sari, { skewX: -6, scaleY: 0.94, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
    .to(live.lantern, { rotation: 5, duration: 1.7, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
    .to(live.corner, { rotation: 1.6, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
    .to($('.ki-tail'), { rotation: 12, svgOrigin: '-24 6', duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
}

// slow device mid-way: drop the expensive parts, keep the story
function degrade() {
  if (low) return;
  low = true;
  ambient && ambient.kill();
  root.firstElementChild.classList.add('ki-low');
}

// ───────────────────────── the story (about 3.8 seconds)
function buildStory(paperEls, sparkEls, streaks, onEnd) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' }, onComplete: onEnd });
  const { khata, fan, ps, card, cs, s } = L;
  const num = { v: 300 }, oks = paperEls.map((p) => p.querySelector('.ok')), score = $('.ki-score');
  tl.set($('.ki-bg'), { scale: 1, filter: 'blur(0px) brightness(1)' }).set($('.ki-veil'), { opacity: 0 })
    .set(live.shutter, { y: 0 }).set($('.ki-interior'), { opacity: 0.12 }).set($('.ki-spill'), { opacity: 0.15 })
    .set($('.ki-card'), { opacity: 0, scale: 0.35 * cs, rotationY: low ? 0 : -120, y: 20 })
    .set($('.ki-mark').children, { opacity: 0, y: 24 }).set($('.ki-arc'), { strokeDashoffset: 238.76 }).set($('.ki-burst-g'), { scale: 0, opacity: 0 })
    .set(wind, { g: 0.15 }).set(paperEls, { x: khata.x, y: khata.y, z: 0, scale: 0.3 * s, rotationX: 0, rotationY: 0, rotationZ: 0, opacity: 0 })
    .set(oks, { scale: 0 }).set(sparkEls, { opacity: 0 });
  root.querySelectorAll('.ki-birds > g').forEach((g) => tl.set(g, { x: +g.dataset.x, y: +g.dataset.y - 12, rotation: 0 }));
  // the full street; a slow multiplane drift; the shutter rolls up
  if (!low) root.querySelectorAll('.ki-scene > [data-d]').forEach((l) => tl.fromTo(l, { x: +l.dataset.d * 26 }, { x: 0, duration: 1.2, ease: 'power2.out' }, 0));
  tl.to($('.ki-bg'), { scale: 1.035, duration: 0.95, ease: 'sine.inOut' }, 0)
    .to(live.shutter, { y: -232, duration: 0.6, ease: 'power2.inOut' }, 0.05)
    .to($('.ki-interior'), { keyframes: [{ opacity: 0.6, duration: 0.05 }, { opacity: 0.2, duration: 0.06 }, { opacity: 0.9, duration: 0.25 }] }, 0.45)
    .to($('.ki-spill'), { opacity: 1, duration: 0.5 }, 0.55)
  // a gust; the mynas take off
    .to(wind, { g: 1, duration: 0.4, ease: 'power2.out' }, 0.7).to(wind, { g: 0.25, duration: 1.4, ease: 'sine.inOut' }, 1.5);
  if (!low) {
    live.clumps.forEach((c) => tl.to(c, { rotation: '-=0.9', duration: 0.45, ease: 'sine.out', yoyo: true, repeat: 1 }, 0.7));
    tl.to(live.sari, { skewX: -16, duration: 0.4, ease: 'sine.out', yoyo: true, repeat: 1 }, 0.7).to(live.lantern, { rotation: 14, duration: 0.4, ease: 'sine.out', yoyo: true, repeat: 1 }, 0.7)
      .to($('.ki-ears'), { rotation: -14, svgOrigin: '22 -12', duration: 0.1, yoyo: true, repeat: 3 }, 0.75);
    streaks.forEach((w, i) => tl.fromTo(w, { strokeDashoffset: 0.26 }, { strokeDashoffset: -1, duration: 1.1, ease: 'power1.inOut', immediateRender: false }, 0.62 + i * 0.08));
  }
  root.querySelectorAll('.ki-birds > g').forEach((g, i) => tl.to(g, { x: '+=' + (700 + i * 70), y: '-=' + (280 + i * 30), rotation: -12, duration: 1.8, ease: 'power1.in' }, 0.78 + i * 0.1).to(g.querySelector('.b'), { scaleY: -0.5, duration: 0.1, repeat: 15, yoyo: true, ease: 'sine.inOut' }, 0.78 + i * 0.1));
  // the khata and bills burst out of the shop, towards the screen
  paperEls.forEach((p, i) => {
    const [fx, fy, rz] = fan[i], at = 0.85 + i * 0.06;
    tl.to(p, { opacity: 1, duration: 0.1 }, at)
      .to(p, { motionPath: { path: [{ x: khata.x, y: khata.y }, { x: (khata.x + fx) / 2 + (i - 2) * 20 * ps, y: Math.min(khata.y, fy) - 40 * ps }, { x: fx, y: fy }], curviness: 1.1 }, duration: 0.85, ease: 'power2.out' }, at)
      .to(p, { scale: ps, duration: 0.85, ease: 'power2.out' }, at)
      .to(p, low ? { rotationZ: rz, duration: 0.85 } : { rotationX: (i % 2 ? 1 : -1) * 360, rotationY: (i % 2 ? -1 : 1) * 360, rotationZ: rz, duration: 0.85, ease: 'power2.out' }, at);
  });
  // focus pull: the street goes soft behind them (a dimming veil on slow devices)
  tl.add(() => {
    frozen = true
    ambient && ambient.pause();
    if (low) gsap.to($('.ki-veil'), { opacity: 0.62, duration: 0.6 });
    else gsap.to($('.ki-bg'), { filter: `blur(${Math.round(6 + 4 * Math.min(1, L.W / 1400))}px) brightness(.8)`, scale: 1.1, duration: 0.75, ease: 'power2.inOut' });
  }, 0.95);
  // cross-checked against each other
  [[0, 1], [1, 2], [2, 3], [3, 4], [0, 2], [2, 4], [1, 3]].forEach(([a, b], i) => {
    const at = 1.72 + i * 0.05, dy = -60 * ps;
    tl.fromTo(sparkEls[i], { x: fan[a][0], y: fan[a][1] + dy, opacity: 0 }, { x: fan[b][0], y: fan[b][1] + dy, opacity: 1, duration: 0.35, ease: 'power1.inOut', immediateRender: false }, at).to(sparkEls[i], { opacity: 0, duration: 0.15 }, at + 0.32);
  });
  tl.to(oks, { scale: 1, duration: 0.3, stagger: 0.06, ease: 'back.out(3)' }, 1.92)
  // they fold into the passport
    .to(paperEls, { x: card.x, y: card.y, scale: 0.3 * ps, rotationY: low ? 0 : '+=180', opacity: 0, duration: 0.42, stagger: 0.03, ease: 'power3.in' }, 2.35)
    .fromTo($('.ki-burst-g'), { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, 2.7)
    .to($('.ki-card'), { opacity: 1, scale: cs, rotationY: 0, y: 0, duration: 0.85, ease: 'back.out(1.5)' }, 2.65)
    .to($('.ki-arc'), { strokeDashoffset: 42.2, duration: 0.8, ease: 'power2.out' }, 2.95)
    .to(num, { v: 794, duration: 0.8, ease: 'power2.out', onUpdate: () => (score.textContent = String(Math.round(num.v))) }, 2.95)
    .to($('.ki-mark').children, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, 3.0)
    .to({}, { duration: 0.9 });
  return tl;
}

/**
 * Plays the opening in `el`. Calls onDone once it has finished, been skipped, or can't run well here
 * (reduced motion, no canvas, or painting too slow). Returns a cleanup function.
 */
export function startIntro(el, { tier = 'high', onDone = () => {} } = {}) {
  root = el; dead = false; frozen = false; low = tier === 'low';
  let finished = false;
  const finish = (fast) => {
    if (finished) return;
    finished = true;
    gsap.to(root.firstElementChild, { opacity: 0, duration: fast ? 0.3 : 0.6, ease: 'power2.out', onComplete: () => onDone() });
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { onDone(); return () => {}; }
  root.innerHTML = TEMPLATE;
  layers = {}; root.querySelectorAll('[data-k]').forEach((n) => (layers[n.dataset.k] = n));
  grassC = $('.ki-grass'); gctx = grassC.getContext('2d'); fxC = $('.ki-fx'); fctx = fxC.getContext('2d');
  if (!gctx || !fctx) { onDone(); return () => {}; }
  if (low) root.firstElementChild.classList.add('ki-low');
  sky = makeSkyGL($('.ki-sky'));
  if (!sky) $('.ki-sky').classList.add('ki-sky-css');
  applyLayout();
  Q = Math.min(1.5, Math.max(0.5, (devicePixelRatio || 1) * L.s)) * (low ? 0.6 : 1);
  // painted pieces
  const windSvg = $('.ki-wind'), streaks = [];
  for (const [d, w] of [['M-60 300 C 140 262, 300 330, 480 294 S 760 252, 900 286', 3], ['M300 410 C 480 380, 620 436, 820 402 S 1100 366, 1240 396', 2.6], ['M760 610 C 920 588, 1060 628, 1240 600 S 1480 576, 1640 598', 3], ['M-40 540 C 120 520, 260 556, 420 530', 2.2]]) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); p.setAttribute('stroke-width', w); p.setAttribute('pathLength', '1'); p.setAttribute('stroke-dasharray', '0.26 1'); p.setAttribute('stroke-dashoffset', '0.26'); p.setAttribute('opacity', '.75'); windSvg.appendChild(p); streaks.push(p);
  }
  $('.ki-burst-g').innerHTML = Array.from({ length: 16 }, (_, i) => `<polygon points="0,-5 300,0 0,5" fill="#fff8d6" transform="rotate(${i * 22.5})"/>`).join('') + '<circle r="64" fill="none" stroke="#ffd166" stroke-width="8"/><circle r="40" fill="#fffbe6" opacity=".8"/>';
  const papersEl = $('.ki-papers');
  const paperEls = PAPERS.map((p) => {
    const d = document.createElement('div'); d.className = 'paper' + (p.cls === 'phone' ? ' phone' : '');
    d.innerHTML = `<div class="face front ${p.cls === 'phone' ? '' : p.cls}">${p.html}</div><div class="face back"></div><span class="ok"><svg width="13" height="13" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    papersEl.appendChild(d); return d;
  });
  const sparkEls = Array.from({ length: 7 }, () => { const d = document.createElement('div'); d.className = 'spark'; papersEl.appendChild(d); return d; });

  // frame loop: sky clouds drift, grass and petals move; watches for a struggling device
  let last = performance.now(), acc = 0, slow = 0, frames = 0;
  const frame = (now) => {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (story && story.isActive()) { frames++; if (dt > 0.05) slow++; if (frames === 40 && slow > 16) degrade(); }
    acc += dt; if (acc < 1 / 30) return;
    const t = now / 1000;
    if (!frozen && (!low || wind.g > 0.3)) { drawGrass(t); drawFx(t, acc); }
    if (sky && !low && !frozen) sky.draw(t, L.sun, L.s);
    acc = 0;
  };
  raf = requestAnimationFrame(frame);

  const onResize = () => {
    if (!story) { applyLayout(); return; }
    const time = story.time(); story.kill(); applyLayout();
    story = buildStory(paperEls, sparkEls, streaks, () => finish(false)); story.play(time);
  };
  addEventListener('resize', onResize);
  const onKey = (e) => { if (e.key === 'Escape') finish(true); };
  addEventListener('keydown', onKey);
  $('.ki-skip').addEventListener('click', () => finish(true));

  // paint, then play; give up gracefully if painting takes too long on this device
  const t0 = performance.now();
  const giveUp = setTimeout(() => !story && finish(true), 4500);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(paintAll).then(() => {
    clearTimeout(giveUp);
    if (dead || finished) return;
    if (performance.now() - t0 > 3000) degrade();
    initGrass(); initFx(); drawGrass(0); drawFx(0, 0);
    root.firstElementChild.classList.add('ki-ready');
    startAmbient();
    story = buildStory(paperEls, sparkEls, streaks, () => finish(false));
    story.play(0);
    if (import.meta.env?.DEV) window.__kintro = story // lets the dev checks seek to exact moments
  }).catch(() => finish(true));

  return () => {
    dead = true; cancelAnimationFrame(raf); clearTimeout(giveUp);
    removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
    story && story.kill(); ambient && ambient.kill(); gsap.killTweensOf(root.querySelectorAll('*'));
    sky && sky.lose(); sky = null; story = null; root.innerHTML = '';
  };
}
