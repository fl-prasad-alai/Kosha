// Illustrated "photo" shopfronts (SVG) for the Kosha samples.
import { rng } from './data.mjs';

const W = 1280, H = 860;

function qr(x, y, size, seed) {
  const r = rng(seed); const n = 21; const c = size / n; let s = '';
  const finder = (fx, fy) => `<rect x="${x + fx * c}" y="${y + fy * c}" width="${7 * c}" height="${7 * c}" fill="#111"/><rect x="${x + (fx + 1) * c}" y="${y + (fy + 1) * c}" width="${5 * c}" height="${5 * c}" fill="#fff"/><rect x="${x + (fx + 2) * c}" y="${y + (fy + 2) * c}" width="${3 * c}" height="${3 * c}" fill="#111"/>`;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const inF = (i < 8 && j < 8) || (i > 12 && j < 8) || (i < 8 && j > 12);
    if (!inF && r() > 0.52) s += `<rect x="${(x + i * c).toFixed(2)}" y="${(y + j * c).toFixed(2)}" width="${c.toFixed(2)}" height="${c.toFixed(2)}" fill="#111"/>`;
  }
  return s + finder(0, 0) + finder(14, 0) + finder(0, 14);
}

const PALETTE = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#d35400', '#16a085', '#e84393', '#f5f6fa', '#2d3436', '#fdcb6e', '#00b894', '#0984e3', '#b33939', '#ffb142'];

function shelfItems(r, x0, x1, yBase, maxH, density = 1) {
  let s = ''; let x = x0;
  while (x < x1 - 10) {
    const w = 14 + r() * 34 * density; const h = maxH * (0.45 + r() * 0.55);
    const col = PALETTE[Math.floor(r() * PALETTE.length)];
    const kind = r();
    if (kind < 0.25) { // bottle / jar
      s += `<rect x="${x.toFixed(1)}" y="${(yBase - h).toFixed(1)}" width="${(w * 0.8).toFixed(1)}" height="${h.toFixed(1)}" rx="${(w * 0.3).toFixed(1)}" fill="${col}" opacity=".92"/>`;
      s += `<rect x="${(x + w * 0.25).toFixed(1)}" y="${(yBase - h - 6).toFixed(1)}" width="${(w * 0.3).toFixed(1)}" height="7" fill="#ddd"/>`;
    } else { // box / packet
      s += `<rect x="${x.toFixed(1)}" y="${(yBase - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${col}"/>`;
      if (r() < 0.7) s += `<rect x="${(x + 3).toFixed(1)}" y="${(yBase - h * 0.7).toFixed(1)}" width="${(w - 6).toFixed(1)}" height="${(h * 0.22).toFixed(1)}" fill="${PALETTE[Math.floor(r() * PALETTE.length)]}" opacity=".85"/>`;
    }
    s += `<rect x="${x.toFixed(1)}" y="${(yBase - h).toFixed(1)}" width="${(w * 0.18).toFixed(1)}" height="${h.toFixed(1)}" fill="#fff" opacity=".15"/>`;
    x += w + 1 + r() * 3;
  }
  return s;
}

function strip(r, x, y, n, w, h, colors) {
  let s = `<line x1="${x + w / 2}" y1="${y - 14}" x2="${x + w / 2}" y2="${y + n * (h + 2)}" stroke="#555" stroke-width="1.2"/>`;
  const col = colors[Math.floor(r() * colors.length)];
  const col2 = PALETTE[Math.floor(r() * PALETTE.length)];
  for (let i = 0; i < n; i++) {
    const yy = y + i * (h + 2);
    s += `<rect x="${x}" y="${yy}" width="${w}" height="${h}" rx="2" fill="${col}"/>`;
    s += `<rect x="${x + 3}" y="${yy + h * 0.35}" width="${w - 6}" height="${h * 0.3}" rx="2" fill="${col2}" opacity=".9"/>`;
    s += `<rect x="${x}" y="${yy}" width="${w * 0.25}" height="${h}" fill="#fff" opacity=".25"/>`;
    s += `<line x1="${x}" y1="${yy + 2}" x2="${x + w}" y2="${yy + 2}" stroke="#000" stroke-opacity=".25" stroke-dasharray="2 2"/>`;
  }
  return s;
}

function sack(cx, by, w, h, fill, grain) {
  return `<g><path d="M${cx - w / 2},${by} Q${cx - w / 2 - 8},${by - h * 0.6} ${cx - w / 2 + 6},${by - h} L${cx + w / 2 - 6},${by - h} Q${cx + w / 2 + 8},${by - h * 0.6} ${cx + w / 2},${by} Z" fill="url(#burlap)"/>
   <path d="M${cx - w / 2},${by} Q${cx - w / 2 - 8},${by - h * 0.6} ${cx - w / 2 + 6},${by - h} L${cx + w / 2 - 6},${by - h} Q${cx + w / 2 + 8},${by - h * 0.6} ${cx + w / 2},${by} Z" fill="#000" opacity=".12" filter="url(#tex)"/>
   <ellipse cx="${cx}" cy="${by - h}" rx="${w / 2 - 4}" ry="13" fill="#8a6a3c"/>
   <ellipse cx="${cx}" cy="${by - h + 2}" rx="${w / 2 - 12}" ry="9" fill="${fill}"/>
   <ellipse cx="${cx}" cy="${by - h + 2}" rx="${w / 2 - 12}" ry="9" fill="${grain}" opacity=".5" filter="url(#tex)"/>
   <path d="M${cx - w / 2 + 6},${by - h * 0.55} Q${cx},${by - h * 0.5} ${cx + w / 2 - 6},${by - h * 0.55}" stroke="#5a4325" stroke-width="2" fill="none" opacity=".5"/></g>`;
}

const DEFS = `<defs>
  <filter id="tex"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <filter id="grime"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="4" seed="11"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .17  0 0 0 0 .12  0 0 0 .55 -.1"/></filter>
  <filter id="fine"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="2"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .3 0"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="0.7"/></filter>
  <filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
  <linearGradient id="burlap" x1="0" x2="1"><stop offset="0" stop-color="#9c7b4b"/><stop offset=".5" stop-color="#c4a26e"/><stop offset="1" stop-color="#8c6b3e"/></linearGradient>
  <linearGradient id="shutter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa0a6"/><stop offset=".5" stop-color="#c9cdd1"/><stop offset="1" stop-color="#7d8287"/></linearGradient>
  <linearGradient id="interior" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5040"/><stop offset=".25" stop-color="#3b3328"/><stop offset="1" stop-color="#1e1a15"/></linearGradient>
  <linearGradient id="pave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f6a62"/><stop offset="1" stop-color="#8c877e"/></linearGradient>
  <radialGradient id="tube" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#fffbe8" stop-opacity=".55"/><stop offset="1" stop-color="#fffbe8" stop-opacity="0"/></radialGradient>
  <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3d6" stop-opacity=".28"/><stop offset=".6" stop-color="#fff3d6" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".18" stop-color="#000" stop-opacity=".05"/><stop offset=".7" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
  <linearGradient id="sides" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".12" stop-color="#000" stop-opacity="0"/><stop offset=".88" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
  <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
</defs>`;

function page(fonts, svg, sample, extraCss = '') {
  return `<!doctype html><html><head><meta charset="utf-8">${fonts}
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Anton&family=Bowlby+One&display=block" rel="stylesheet">
<style>html,body{margin:0;padding:0;background:#222}body{width:${W}px;height:${H}px;overflow:hidden;position:relative}
svg{display:block;transform:rotate(-0.6deg) scale(1.02);filter:saturate(.9) contrast(1.05) blur(.45px)}
.mark{position:absolute;right:18px;bottom:12px;font:500 13px Inter,sans-serif;color:rgba(255,255,255,.8);text-shadow:0 1px 2px rgba(0,0,0,.6)}${extraCss}</style></head>
<body>${svg}<div class="mark">${sample}</div></body></html>`;
}

export function shopfrontA(fonts, sample) {
  const r = rng(404);
  let shelves = '';
  const shelfY = [345, 425, 505, 585];
  for (const y of shelfY) {
    shelves += shelfItems(r, 190, 1090, y, 66);
    shelves += `<rect x="175" y="${y}" width="930" height="9" fill="#6b5236"/><rect x="175" y="${y + 9}" width="930" height="4" fill="#000" opacity=".35"/>`;
  }
  let strips = '';
  const sx = [200, 232, 264, 296, 328, 900, 932, 964, 996, 1028, 1060];
  for (const x of sx) strips += `<g transform="rotate(${((r() - 0.5) * 3).toFixed(2)} ${x} 280)">${strip(r, x, 285, 9 + Math.floor(r() * 4), 26, 30, ['#e74c3c', '#f39c12', '#f1c40f', '#27ae60', '#3498db', '#e84393'])}</g>`;
  // glass counter with jars
  let jars = '';
  for (let i = 0; i < 7; i++) {
    const x = 420 + i * 62, col = PALETTE[Math.floor(r() * PALETTE.length)];
    jars += `<rect x="${x}" y="584" width="46" height="58" rx="8" fill="#dfe8e8" opacity=".55"/><rect x="${x + 4}" y="604" width="38" height="36" rx="6" fill="${col}" opacity=".85"/><rect x="${x + 6}" y="576" width="34" height="10" rx="3" fill="#c0392b"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}
  <!-- facade -->
  <rect width="${W}" height="${H}" fill="#cbb995"/>
  <rect width="${W}" height="${H}" filter="url(#grime)"/>
  <rect x="0" y="0" width="${W}" height="40" fill="#a8977a"/>
  <!-- signboard -->
  <g filter="url(#soft)">
   <rect x="90" y="52" width="1100" height="178" fill="#f6c516"/>
   <rect x="90" y="52" width="1100" height="178" fill="none" stroke="#b3261e" stroke-width="10"/>
   <rect x="90" y="52" width="1100" height="178" filter="url(#grime)" opacity=".55"/>
   <text x="640" y="150" text-anchor="middle" font-family="'Baloo 2', 'Noto Sans Devanagari'" font-weight="800" font-size="96" fill="#b3261e">शर्मा जनरल स्टोर</text>
   <text x="640" y="208" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="46" letter-spacing="6" fill="#1b3f8f">SHARMA GENERAL STORE</text>
  </g>
  <!-- tube light glow -->
  <rect x="520" y="234" width="240" height="7" rx="3" fill="#fffef5"/>
  <!-- shutter box rolled up -->
  <rect x="150" y="238" width="980" height="38" fill="url(#shutter)"/>
  ${Array.from({ length: 6 }, (_, i) => `<line x1="150" x2="1130" y1="${242 + i * 6}" y2="${242 + i * 6}" stroke="#5f6468" stroke-width="1.2" opacity=".7"/>`).join('')}
  <rect x="150" y="270" width="980" height="8" fill="#555b60"/>
  <!-- opening / interior -->
  <rect x="160" y="278" width="960" height="440" fill="url(#interior)"/>
  <rect x="160" y="278" width="960" height="300" fill="url(#tube)"/>
  ${shelves}
  ${strips}
  <rect x="160" y="278" width="960" height="440" fill="url(#depth)"/><rect x="160" y="278" width="960" height="440" fill="url(#sides)"/>
  <!-- pillars -->
  <rect x="120" y="230" width="44" height="500" fill="#bfae8b"/><rect x="1116" y="230" width="44" height="500" fill="#bfae8b"/>
  <rect x="120" y="230" width="44" height="500" filter="url(#grime)"/><rect x="1116" y="230" width="44" height="500" filter="url(#grime)"/>
  <!-- counter -->
  <rect x="380" y="640" width="520" height="80" fill="#7a5a3a"/><rect x="380" y="640" width="520" height="8" fill="#9b7a55"/>
  <rect x="380" y="576" width="520" height="66" fill="#cfe3e6" opacity=".18" stroke="#9fb5b8" stroke-width="2"/>
  ${jars}
  <!-- pavement -->
  <rect x="0" y="718" width="${W}" height="142" fill="url(#pave)"/>
  <rect x="0" y="718" width="${W}" height="142" filter="url(#grime)" opacity=".7"/>
  <rect x="0" y="718" width="${W}" height="12" fill="#000" opacity=".25"/>
  <!-- step -->
  <rect x="100" y="718" width="1080" height="26" fill="#9a958b"/><rect x="100" y="742" width="1080" height="6" fill="#000" opacity=".2"/>
  <!-- sacks -->
  <ellipse cx="300" cy="812" rx="260" ry="18" fill="#000" opacity=".25" filter="url(#blur3)"/>
  ${sack(170, 812, 120, 130, '#f2ead6', '#bfb39a')}
  ${sack(290, 818, 120, 120, '#e8b13a', '#a87a1e')}
  ${sack(410, 812, 115, 125, '#efe6cf', '#b0a48a')}
  ${sack(1000, 816, 125, 128, '#d9a05b', '#8f5e27')}
  ${sack(1120, 812, 115, 118, '#f3eedf', '#bdb197')}
  <!-- QR board on right pillar -->
  <g transform="rotate(1.5 1060 470)">
   <rect x="1000" y="400" width="140" height="190" rx="6" fill="#fdfdfb" stroke="#333" stroke-width="2"/>
   <rect x="1000" y="400" width="140" height="34" rx="6" fill="#1f6f43"/>
   <text x="1070" y="423" text-anchor="middle" font-family="Inter" font-weight="800" font-size="15" fill="#fff">SCAN &amp; PAY</text>
   ${qr(1018, 442, 104, 17)}
   <text x="1070" y="566" text-anchor="middle" font-family="Inter" font-weight="700" font-size="11" fill="#222">UPI accepted</text>
   <text x="1070" y="581" text-anchor="middle" font-family="Inter" font-size="10" fill="#333">sharmagenstore@pmcb</text>
  </g>
  <!-- small chalk board left -->
  <g transform="rotate(-2 70 560)"><rect x="18" y="470" width="96" height="140" fill="#2e3b33" stroke="#6b5236" stroke-width="5"/>
   <text x="66" y="505" text-anchor="middle" font-family="Kalam" font-weight="700" font-size="20" fill="#f4f4ef">आज</text>
   <text x="66" y="535" text-anchor="middle" font-family="Kalam" font-size="17" fill="#f4f4ef">दूध 28/-</text>
   <text x="66" y="562" text-anchor="middle" font-family="Kalam" font-size="17" fill="#f4f4ef">ब्रेड 40/-</text>
   <text x="66" y="589" text-anchor="middle" font-family="Kalam" font-size="17" fill="#f4f4ef">अंडे 7/-</text></g>
  <!-- light, grain, vignette -->
  <rect width="${W}" height="${H}" fill="url(#sun)"/>
  <rect width="${W}" height="${H}" filter="url(#fine)"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  </svg>`;
  return page(fonts, svg, sample);
}

export function shopfrontB(fonts, sample) {
  const r = rng(909);
  const wx0 = 330, wx1 = 950, wy0 = 300, wy1 = 640;
  let inside = '';
  for (const y of [400, 480, 560, 630]) {
    inside += shelfItems(r, wx0 + 10, wx1 - 10, y, 62, 0.8);
    inside += `<rect x="${wx0}" y="${y}" width="${wx1 - wx0}" height="7" fill="#7b6046"/>`;
  }
  let strips = '';
  const sachetCols = ['#1e88e5', '#d81b60', '#fdd835', '#43a047', '#6d4c41', '#fb8c00', '#8e24aa', '#e53935', '#00acc1'];
  for (let x = wx0 + 14; x < wx1 - 20; x += 30 + r() * 10) {
    strips += `<g transform="rotate(${((r() - 0.5) * 4).toFixed(2)} ${x} ${wy0})">${strip(r, x, wy0 + 12, 6 + Math.floor(r() * 5), 22, 26, sachetCols)}</g>`;
  }
  // grille
  let grille = '';
  for (let x = wx0; x <= wx1; x += 28) grille += `<rect x="${x - 2}" y="${wy0}" width="4" height="${wy1 - wy0}" fill="#2f3438"/><rect x="${x - 2}" y="${wy0}" width="1.5" height="${wy1 - wy0}" fill="#9aa3a8" opacity=".6"/>`;
  for (let y = wy0; y <= wy1; y += 85) grille += `<rect x="${wx0}" y="${y - 3}" width="${wx1 - wx0}" height="6" fill="#2f3438"/>`;
  // crates
  let crates = '';
  for (let k = 0; k < 2; k++) {
    const cx = 990 + k * 10, cy = 760 - k * 62;
    crates += `<rect x="${cx}" y="${cy}" width="200" height="62" fill="#c62828" stroke="#7f1717" stroke-width="3"/>`;
    for (let i = 0; i < 6; i++) crates += `<rect x="${cx + 12 + i * 31}" y="${cy - 30}" width="18" height="40" rx="7" fill="#3e2723" opacity=".9"/><rect x="${cx + 16 + i * 31}" y="${cy - 38}" width="10" height="10" fill="#cfd8dc"/>`;
    crates += `<rect x="${cx + 70}" y="${cy + 16}" width="60" height="22" rx="3" fill="#7f1717"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}
  <rect width="${W}" height="${H}" fill="#7fb9ae"/>
  <rect width="${W}" height="${H}" filter="url(#grime)"/>
  <!-- corrugated roof edge -->
  <rect x="0" y="0" width="${W}" height="70" fill="#8d6e5a"/>
  ${Array.from({ length: 64 }, (_, i) => `<rect x="${i * 20}" y="0" width="10" height="70" fill="#5d4037" opacity=".45"/>`).join('')}
  <rect x="0" y="0" width="${W}" height="70" filter="url(#grime)"/>
  <rect x="0" y="66" width="${W}" height="10" fill="#000" opacity=".3"/>
  <!-- sign -->
  <g filter="url(#soft)" transform="rotate(-0.8 640 170)">
   <rect x="170" y="100" width="940" height="150" fill="#fbfaf3"/>
   <rect x="170" y="100" width="940" height="150" fill="none" stroke="#1a4f9c" stroke-width="8"/>
   <rect x="170" y="100" width="940" height="150" filter="url(#grime)" opacity=".5"/>
   <text x="640" y="196" text-anchor="middle" font-family="'Bowlby One', Impact, sans-serif" font-size="64" textLength="860" lengthAdjust="spacingAndGlyphs" fill="#c62828">NENA'S SARI-SARI STORE</text>
   <text x="640" y="235" text-anchor="middle" font-family="Inter" font-weight="800" font-size="20" letter-spacing="3" fill="#1a4f9c">BIGAS • DE-LATA • SOFTDRINKS • ICE</text>
  </g>
  <!-- window frame -->
  <rect x="${wx0 - 24}" y="${wy0 - 24}" width="${wx1 - wx0 + 48}" height="${wy1 - wy0 + 60}" fill="#e9e4d6"/>
  <rect x="${wx0 - 24}" y="${wy0 - 24}" width="${wx1 - wx0 + 48}" height="${wy1 - wy0 + 60}" filter="url(#grime)"/>
  <rect x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="${wy1 - wy0}" fill="url(#interior)"/>
  <rect x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="200" fill="url(#tube)"/>
  ${inside}
  ${strips}
  <rect x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="${wy1 - wy0}" fill="url(#depth)"/><rect x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="${wy1 - wy0}" fill="url(#sides)"/>
  ${grille}
  <!-- ledge with candy jars -->
  <rect x="${wx0 - 30}" y="${wy1}" width="${wx1 - wx0 + 60}" height="18" fill="#a1887f"/>
  ${[0, 1, 2, 3].map((i) => `<rect x="${wx0 + 20 + i * 70}" y="${wy1 - 54}" width="52" height="54" rx="9" fill="#e0f2f1" opacity=".5"/><rect x="${wx0 + 25 + i * 70}" y="${wy1 - 34}" width="42" height="32" rx="7" fill="${['#f06292', '#ffd54f', '#81c784', '#ff8a65'][i]}"/><rect x="${wx0 + 26 + i * 70}" y="${wy1 - 62}" width="40" height="10" rx="3" fill="#1565c0"/>`).join('')}
  <!-- cardboard signs -->
  <g transform="rotate(3 190 420)"><rect x="110" y="360" width="170" height="110" fill="#c8a165"/><rect x="110" y="360" width="170" height="110" filter="url(#grime)"/>
   <text x="195" y="410" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="40" fill="#1b1b1b">MAY LOAD</text>
   <text x="195" y="448" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="30" fill="#b71c1c">Ice candy ₱10</text></g>
  <!-- QR sticker -->
  <g transform="rotate(-2 1060 430)">
   <rect x="995" y="340" width="130" height="176" rx="8" fill="#fff" stroke="#0d6e6e" stroke-width="4"/>
   <rect x="995" y="340" width="130" height="32" rx="6" fill="#0d6e6e"/>
   <text x="1060" y="362" text-anchor="middle" font-family="Inter" font-weight="800" font-size="14" fill="#fff">SCAN TO PAY</text>
   ${qr(1012, 380, 96, 23)}
   <text x="1060" y="500" text-anchor="middle" font-family="Inter" font-weight="700" font-size="11" fill="#0d6e6e">PayLakbay</text>
  </g>
  <!-- ground -->
  <rect x="0" y="690" width="${W}" height="170" fill="url(#pave)"/>
  <rect x="0" y="690" width="${W}" height="170" filter="url(#grime)" opacity=".8"/>
  <rect x="0" y="690" width="${W}" height="10" fill="#000" opacity=".25"/>
  <!-- plastic stool -->
  <g><ellipse cx="200" cy="800" rx="80" ry="12" fill="#000" opacity=".3" filter="url(#blur3)"/>
   <rect x="140" y="730" width="120" height="16" rx="6" fill="#1e88e5"/><path d="M150,746 L136,800 L152,800 L166,746 Z M250,746 L264,800 L248,800 L234,746 Z" fill="#1565c0"/></g>
  ${crates}
  <rect width="${W}" height="${H}" fill="url(#sun)"/>
  <rect width="${W}" height="${H}" filter="url(#fine)"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  </svg>`;
  return page(fonts, svg, sample);
}
