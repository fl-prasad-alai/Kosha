// Kosha sample document images (HTML -> PNG via headless Chrome -> JPEG via sips),
// plus public/samples/README.md and manifest.json.
// Usage: node scripts/samples/kosha/generate.mjs [filter-substring] [--no-docs]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as M from './data.mjs';
import { shopfrontA, shopfrontB } from './shopfront.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(ROOT, 'public/samples');
const BUILD = path.join(HERE, 'build');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(path.join(OUT, 'shopA'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'shopB'), { recursive: true });

const sum = M.sum;
const inr = (n) => n.toLocaleString('en-IN');
const inr2 = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const php = (n) => n.toLocaleString('en-US');
const php2 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dmy = (s) => { const [y, m, d] = s.split('-'); return `${d}-${m}-${y}`; };
const dMonY = (s) => { const d = M.D(s); return `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const SAMPLE = 'SAMPLE – for demo only';

export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&family=Caveat:wght@400;600;700&family=Inter:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;700&family=Roboto:wght@400;700;900&family=Noto+Sans+Devanagari:wght@400;600&family=Homemade+Apple&display=block" rel="stylesheet">`;

const svgUrl = (svg) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
const paperNoise = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch' seed='3'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.40  0 0 0 0 0.30  0 0 0 0.16 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
const blotch = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.006' numOctaves='3' seed='9'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 0 0.3  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' filter='url(#b)'/></svg>`);
const woodGrain = svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><filter id='w'><feTurbulence type='fractalNoise' baseFrequency='0.004 0.09' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 0.12  0 0 0 0 0.07  0 0 0 0 0.03  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(#w)'/></svg>`);

const TABLES = {
  wood: `background:#4a3324 ${woodGrain}; background-blend-mode:multiply;`,
  grey: `background: radial-gradient(ellipse at 40% 40%, #6b6a66, #3b3a37 80%);`,
  cloth: `background: radial-gradient(ellipse at 60% 30%, #5a6b78, #2d3740 85%);`,
};

/** Wrap a paper document in a "phone photo" frame. */
function photo({ W, H, pw, ph, rot = -1, tilt = 1.5, table = 'wood', paper = '#f6f2e8', inner, css = '', light = '28% 22%' }) {
  const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  *{box-sizing:border-box} html,body{margin:0;padding:0}
  body{width:${W}px;height:${H}px;overflow:hidden;position:relative;${TABLES[table]}}
  .paper{position:absolute;left:${px}px;top:${py}px;width:${pw}px;height:${ph}px;background:${paper};
    transform:perspective(2200px) rotateX(${tilt}deg) rotate(${rot}deg);transform-origin:50% 50%;
    box-shadow:0 2px 3px rgba(0,0,0,.35), 8px 22px 40px rgba(0,0,0,.5);overflow:hidden}
  .paper > .tex{position:absolute;inset:0;pointer-events:none;background:${paperNoise};z-index:50}
  .paper > .blot{position:absolute;inset:0;pointer-events:none;background:${blotch};opacity:.6;z-index:49}
  .paper > .light{position:absolute;inset:0;pointer-events:none;z-index:51;
    background:radial-gradient(ellipse 75% 60% at ${light}, rgba(255,255,245,.22), rgba(255,255,245,0) 70%),
      linear-gradient(118deg, rgba(0,0,0,0) 50%, rgba(40,30,10,.13) 100%)}
  .vign{position:absolute;inset:0;pointer-events:none;z-index:100;background:radial-gradient(ellipse 85% 80% at 50% 48%, rgba(0,0,0,0) 60%, rgba(0,0,0,.35) 100%)}
  .sample{position:absolute;right:26px;bottom:14px;font:500 12px/1 Inter,sans-serif;color:rgba(90,90,90,.75);letter-spacing:.3px;z-index:40}
  ${css}
  </style></head><body><div class="paper"><div class="blot"></div><div class="tex"></div><div class="light"></div>${inner}</div><div class="vign"></div></body></html>`;
}

/* ---------------------------- handwritten ledger ---------------------------- */
function ledgerHtml({ rows, shop, title, cols, fmtAmt, fmtDate, font, fontSize, seed, lang, rot, tilt, light, descMax }) {
  const r = M.rng(seed);
  const L = 56; // ruled line spacing
  const j = () => (r() - 0.5);
  const hand = (txt, extra = '', scale = 1) => `<span class="h" style="transform:translate(${(j() * 6).toFixed(1)}px,${(j() * 5).toFixed(1)}px) rotate(${(j() * 1.8).toFixed(2)}deg);font-size:${(fontSize * scale * (1 + j() * 0.09)).toFixed(1)}px;${extra}">${txt}</span>`;
  let lastDate = null;
  const body = rows.map((row) => {
    const showDate = row.date !== lastDate; lastDate = row.date;
    const amtTxt = (row.strike ? `<span class="strike">${fmtAmt(row.strike)}</span> ` : '') + fmtAmt(row.amt);
    const sc = row.text.length > descMax ? 0.84 : row.text.length > descMax - 6 ? 0.92 : 1;
    return `<div class="row"><div class="c date">${hand(fmtDate(row.date), showDate ? '' : 'opacity:.92')}</div><div class="c desc">${hand(esc(row.text), '', sc)}</div>
      <div class="c amt">${hand(amtTxt)}</div></div>`;
  }).join('');
  const pw = 880, ph = 1300;
  const css = `
  .ink{position:absolute;inset:0;z-index:20;color:#1f3a8a;font-family:${font};}
  .ruled{position:absolute;left:0;right:0;top:140px;bottom:30px;background:repeating-linear-gradient(to bottom, transparent 0, transparent ${L - 2}px, rgba(70,120,190,.38) ${L - 2}px, rgba(70,120,190,.38) ${L}px);z-index:5}
  .vline{position:absolute;top:88px;bottom:16px;width:2px;z-index:6}
  .hdr{position:absolute;left:130px;right:36px;top:22px;height:60px;display:flex;justify-content:space-between;align-items:flex-end;z-index:20;color:#1f3a8a;font-family:${font}}
  .hdr .shop{font-size:${fontSize + 6}px;font-weight:700;transform:rotate(-0.8deg);white-space:nowrap}
  .hdr .pg{font-size:${fontSize - 1}px;transform:rotate(0.6deg);white-space:nowrap}
  .grid{position:absolute;left:0;right:0;top:${140 - L}px}
  .row{display:grid;grid-template-columns:116px 544px 220px;height:${L}px;align-items:end}
  .row.head .c{font-weight:700;color:#1f3a8a;font-size:${fontSize}px;text-align:center}
  .c{padding:0 8px 8px 12px;white-space:nowrap;overflow:visible}
  .c.amt{text-align:right;padding-right:22px;padding-bottom:11px}
  .h{display:inline-block;line-height:1.05}
  .strike{position:relative;color:#1f3a8a;opacity:.85;font-size:.85em;margin-right:8px}
  .strike::after{content:'';position:absolute;left:-4px;right:-4px;top:52%;height:2.5px;background:#1f3a8a;transform:rotate(-8deg)}
  .sample{color:rgba(110,110,110,.85)}
  `;
  const inner = `<div class="ruled"></div>
   <div class="vline" style="left:110px;background:rgba(200,40,40,.7)"></div><div class="vline" style="left:115px;background:rgba(200,40,40,.7)"></div>
   <div class="vline" style="left:660px;background:rgba(70,120,190,.45)"></div>
   <div class="hdr" lang="${lang}"><span class="shop">${shop}</span><span class="pg">${title}</span></div>
   <div class="ink" lang="${lang}"><div class="grid">
     <div class="row head"><div class="c">${cols[0]}</div><div class="c">${cols[1]}</div><div class="c">${cols[2]}</div></div>
     ${body}
   </div></div>
   <div class="sample">${SAMPLE}</div>`;
  return photo({ W: 1000, H: 1400, pw, ph, rot, tilt, table: 'wood', paper: '#f3eedb', inner, css, light });
}

const A_ledgers = M.A_pages.map((p, i) => ({
  file: p.file, W: 1000, H: 1400,
  html: ledgerHtml({
    rows: p.rows, shop: 'शर्मा जनरल स्टोर — खाता', title: p.title, cols: ['तारीख', 'विवरण', 'रकम (₹)'],
    fmtAmt: (n) => String(n) + '/-',
    fmtDate: (s) => { const d = M.D(s); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; },
    font: "'Kalam', cursive", fontSize: 27, seed: 11 + i, lang: 'hi', descMax: 34,
    rot: [-1.2, 0.8, -0.6][i], tilt: [1.5, 2, 1][i], light: ['25% 20%', '70% 15%', '40% 30%'][i],
  }),
}));
const B_ledgers = M.B_pages.map((p, i) => ({
  file: p.file, W: 1000, H: 1400,
  html: ledgerHtml({
    rows: p.rows, shop: "Nena's Sari-Sari — Listahan", title: p.title, cols: ['Petsa', 'Detalye', 'Halaga (₱)'],
    fmtAmt: (n) => php(n),
    fmtDate: (s) => { const d = M.D(s); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; },
    font: "'Caveat', cursive", fontSize: 35, seed: 31 + i, lang: 'tl', descMax: 32,
    rot: [1.1, -0.9][i], tilt: [1.8, 1.2][i], light: ['30% 25%', '65% 20%'][i],
  }),
}));

/* ---------------------------- India invoices ---------------------------- */
function wordsIN(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
  const parts = [];
  const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
  if (cr) parts.push(two(cr) + ' Crore'); if (lk) parts.push(two(lk) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (n) parts.push(three(n));
  return parts.join(' ');
}
const SUPPLIERS_A = {
  agarwal: { name: 'AGARWAL TRADERS', sub: 'Wholesale Grains, Pulses & Edible Oils', addr: 'Shop No. 27, Market Yard, Gultekdi, Pune 411037', gst: '27ABCDE1234F1Z5', terms: 'Credit 15 days', color: '#7a1f1f', sign: 'R. Agarwal' },
  mahalaxmi: { name: 'MAHALAXMI DISTRIBUTORS', sub: 'FMCG & Provision Distributors', addr: '512, Bhawani Peth, Pune 411042', gst: '27PQRSX5678K1Z2', terms: 'Paid – Cash', color: '#14532d', sign: 'S. Kulkarni' },
};
function invoiceA(inv, i) {
  const s = SUPPLIERS_A[inv.supplier];
  const rows = inv.items.map((it, k) => `<tr><td>${k + 1}</td><td class="l">${it[0]}</td><td>${it[1]}</td><td>${it[2]}</td><td>${it[3]}</td><td class="r">${inr2(it[4])}</td><td class="r">${inr2(it[2] * it[4])}</td></tr>`).join('');
  const css = `
  .doc{position:absolute;inset:0;padding:46px 52px;color:#1d1d1d;font-family:Inter,sans-serif;z-index:20}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px double ${s.color};padding-bottom:12px}
  .nm{font:800 34px/1.1 Inter;color:${s.color};letter-spacing:1px}
  .sub{font-size:15px;margin-top:4px;color:#333}
  .ad{font-size:14px;margin-top:4px}
  .ti{text-align:right;font-size:14px}
  .ti b{display:block;font-size:20px;letter-spacing:2px;border:2px solid ${s.color};color:${s.color};padding:4px 10px;margin-bottom:8px}
  .meta{display:grid;grid-template-columns:1.3fr 1fr;gap:0;margin-top:14px;border:1.5px solid #333;font-size:15px}
  .meta>div{padding:10px 12px}.meta>div+div{border-left:1.5px solid #333}
  .meta .k{color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.6px}
  table{width:100%;border-collapse:collapse;margin-top:16px;font:15px/1.3 'Roboto Mono',monospace}
  th{background:rgba(0,0,0,.06);font:600 13px Inter;text-transform:uppercase;letter-spacing:.4px;padding:8px 6px;border:1.5px solid #333}
  td{border-left:1.5px solid #333;border-right:1.5px solid #333;padding:9px 6px;text-align:center}
  td.l{text-align:left}td.r{text-align:right}
  tr.fill td{height:${Math.max(40, 330 - inv.items.length * 38)}px}
  tr.tot td{border:1.5px solid #333;font-weight:700;font-size:17px;padding:10px 6px}
  .words{margin-top:12px;font-size:15px;border:1.5px solid #333;padding:10px 12px}
  .bottom{display:flex;justify-content:space-between;margin-top:18px;font-size:14px}
  .terms{border:1.5px dashed #555;padding:10px 14px;font-weight:700;font-size:17px;display:inline-block;margin-top:8px}
  .sig{text-align:right}.sig .s{font:400 40px/1 'Homemade Apple',cursive;color:#1e3a8a;transform:rotate(-6deg);display:inline-block;margin:16px 10px 4px}
  .stamp{position:absolute;right:90px;bottom:150px;width:150px;height:150px;border:4px double rgba(30,58,138,.5);border-radius:50%;color:rgba(30,58,138,.5);display:flex;align-items:center;justify-content:center;text-align:center;font:700 13px/1.3 Inter;transform:rotate(-14deg)}
  .note{font-size:12px;color:#444;margin-top:8px}
  `;
  const inner = `<div class="doc">
   <div class="top"><div><div class="nm">${s.name}</div><div class="sub">${s.sub}</div><div class="ad">${s.addr}</div><div class="ad">GSTIN: <b>${s.gst}</b> &nbsp;·&nbsp; State: Maharashtra (27)</div></div>
     <div class="ti"><b>TAX INVOICE</b>Original for Recipient</div></div>
   <div class="meta"><div><div class="k">Bill to</div><b>Sharma General Store</b><br>Shop 4, Karve Road, Kothrud, Pune 411038<br>GSTIN: Unregistered</div>
     <div><div class="k">Invoice No.</div><b>${inv.no}</b><div class="k" style="margin-top:8px">Invoice Date</div><b>${dmy(inv.date)}</b></div></div>
   <table><tr><th>#</th><th>Description of Goods</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Amount (₹)</th></tr>
   ${rows}<tr class="fill"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
   <tr class="tot"><td></td><td class="l">TOTAL</td><td></td><td></td><td></td><td></td><td class="r">₹ ${inr2(inv.total)}</td></tr></table>
   <div class="note">All rates inclusive of applicable GST. Round off: 0.00</div>
   <div class="words"><b>Amount in words:</b> Rupees ${wordsIN(inv.total)} Only</div>
   <div class="bottom"><div>Payment terms:<br><span class="terms">${s.terms}</span><div class="note">Goods once sold will not be taken back. Subject to Pune jurisdiction.</div></div>
   <div class="sig">For ${s.name.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase())}<br><span class="s">${s.sign}</span><br>Authorised Signatory</div></div>
   </div><div class="stamp">${s.name}<br>PUNE</div><div class="sample">${SAMPLE}</div>`;
  return photo({ W: 1000, H: 1400, pw: 880, ph: 1245, rot: [0.9, -1.4, 1.6, -0.7][i], tilt: [1.2, 2, 1.5, 1][i], table: ['grey', 'wood', 'cloth', 'grey'][i], paper: '#f7f5ef', inner, css, light: ['30% 20%', '70% 30%', '40% 25%', '60% 15%'][i] });
}

/* ---------------------------- Philippines invoices ---------------------------- */
function invoiceB(inv, i) {
  const vatable = Math.round((inv.total / 1.12) * 100) / 100;
  const vat = Math.round((inv.total - vatable) * 100) / 100;
  const rows = inv.items.map((it) => `<tr><td>${it[1]}</td><td>${it[2]}</td><td class="l">${it[0]}</td><td class="r">${php2(it[3])}</td><td class="r">${php2(it[1] * it[3])}</td></tr>`).join('');
  const css = `
  .doc{position:absolute;inset:0;padding:40px 48px;color:#1b1b1b;font-family:Inter,sans-serif;z-index:20}
  .h{text-align:center;border-bottom:2px solid #1b1b1b;padding-bottom:10px}
  .h .n{font:800 30px/1.15 Inter;color:#0b3d6e;letter-spacing:.5px}.h .a{font-size:14px;margin-top:3px}
  .t{display:flex;justify-content:space-between;align-items:center;margin-top:14px}
  .t .ti{font:800 24px Inter;letter-spacing:3px}
  .t .no{font:700 22px 'Roboto Mono';color:#b91c1c}
  .f{display:grid;grid-template-columns:1fr 280px;gap:10px 24px;margin-top:14px;font-size:16px}
  .f .u{border-bottom:1.5px solid #333;padding:2px 4px;font-family:Caveat,cursive;font-size:28px;color:#1e3a8a;line-height:1}
  .f .k{font-size:12px;color:#444;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;margin-top:18px;font:15px/1.35 'Roboto Mono',monospace}
  th{border:1.5px solid #222;padding:7px 6px;font:700 13px Inter;text-transform:uppercase;background:rgba(11,61,110,.08)}
  td{border:1.5px solid #222;padding:8px 6px;text-align:center}td.l{text-align:left}td.r{text-align:right}
  tr.e td{height:36px}
  .sum{margin-left:auto;width:420px;margin-top:12px;font:16px 'Roboto Mono'}
  .sum div{display:flex;justify-content:space-between;padding:4px 6px}
  .sum .g{border-top:2px solid #222;font-weight:700;font-size:20px;margin-top:4px;padding-top:8px}
  .terms{margin-top:18px;font-size:16px}.terms b{border:2px solid #222;padding:4px 14px;margin-left:8px}
  .rcv{display:flex;justify-content:space-between;margin-top:56px;font-size:13px}
  .rcv div{width:42%;border-top:1.5px solid #333;padding-top:4px;text-align:center;position:relative}
  .rcv .s{position:absolute;top:-46px;left:0;right:0;font:400 30px 'Homemade Apple';color:#1e3a8a;transform:rotate(-4deg)}
  .bir{margin-top:26px;font-size:11px;color:#555;text-align:center}
  `;
  const empties = Array.from({ length: Math.max(0, 11 - inv.items.length) }, () => '<tr class="e"><td></td><td></td><td></td><td></td><td></td></tr>').join('');
  const inner = `<div class="doc">
   <div class="h"><div class="n">BALINTAWAK WHOLESALE TRADING</div><div class="a">Stall 112–114, Balintawak Market, Quezon City</div>
   <div class="a">VAT Reg. TIN 000-123-456-00000 · Wholesale Grocery &amp; Beverages</div></div>
   <div class="t"><span class="ti">SALES INVOICE</span><span class="no">No. ${inv.no}</span></div>
   <div class="f"><div><div class="k">Sold to</div><div class="u">Nena's Sari-Sari Store</div></div><div><div class="k">Date</div><div class="u">${dMonY(inv.date)}</div></div>
     <div><div class="k">Address</div><div class="u">Project 4, QC</div></div><div><div class="k">Terms</div><div class="u">Cash</div></div></div>
   <table><tr><th>Qty</th><th>Unit</th><th>Articles</th><th>Unit Price</th><th>Amount</th></tr>${rows}${empties}</table>
   <div class="sum"><div><span>VATable Sales</span><span>${php2(vatable)}</span></div><div><span>VAT (12%)</span><span>${php2(vat)}</span></div>
     <div class="g"><span>TOTAL AMOUNT DUE</span><span>₱${php2(inv.total)}</span></div></div>
   <div class="terms">Terms of payment: <b>Cash</b></div>
   <div class="rcv"><div><span class="s">N. Dizon</span>Received the goods in good order</div><div><span class="s">L. Cruz</span>Cashier / Authorized Representative</div></div>
   <div class="bir">Fictional business — sample document, not valid for claim of input tax.</div>
   </div><div class="sample">${SAMPLE}</div>`;
  return photo({ W: 1000, H: 1400, pw: 860, ph: 1240, rot: [-1.3, 1.0, -0.5][i], tilt: [1.6, 1, 2][i], table: ['wood', 'cloth', 'grey'][i], paper: '#f8f6f0', inner, css, light: ['35% 20%', '65% 25%', '45% 30%'][i] });
}

/* ---------------------------- UPI statement ---------------------------- */
function upiStatement() {
  const rows = M.A_upi;
  const tot = sum(rows.map((x) => x.amt)), cnt = sum(rows.map((x) => x.count));
  const tr = rows.map((x) => { const d = M.D(x.date); return `<tr${x.we ? ' class="we"' : ''}><td>${dMonY(x.date)}</td><td>${DOW[d.getUTCDay()]}</td><td class="c">${x.count}</td><td class="r">${inr2(x.amt)}</td></tr>`; }).join('');
  const css = `
  .doc{position:absolute;inset:0;padding:38px 48px;color:#1a1a1a;font-family:Inter,sans-serif;z-index:20}
  .bh{display:flex;align-items:center;gap:16px;border-bottom:3px solid #0f4c5c;padding-bottom:12px}
  .logo{width:58px;height:58px;border-radius:50%;background:#0f4c5c;color:#fff;display:flex;align-items:center;justify-content:center;font:800 20px Inter}
  .bn{font:800 25px/1.1 Inter;color:#0f4c5c}.bs{font-size:13px;color:#444;margin-top:3px}
  h1{font:700 21px Inter;margin:16px 0 8px;letter-spacing:.3px}
  .mi{display:grid;grid-template-columns:1fr 1fr;gap:4px 30px;font-size:14px;border:1.2px solid #999;padding:10px 14px;background:rgba(15,76,92,.04)}
  .mi span{color:#555}
  table{width:100%;border-collapse:collapse;margin-top:12px;font:14px/1 'Roboto Mono',monospace}
  th{background:#0f4c5c;color:#fff;font:600 13px Inter;padding:8px;text-align:left}
  td{padding:6.4px 8px;border-bottom:1px solid #ccc}
  td.r,th.r{text-align:right}td.c,th.c{text-align:center}
  tr.we td{background:rgba(15,76,92,.06)}
  tr.t td{font-weight:700;border-top:2px solid #333;border-bottom:2px solid #333;font-size:15px;padding:9px 8px}
  .sb{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
  .sb div{border:1.5px solid #0f4c5c;padding:10px;font-size:12px;color:#444}
  .sb b{display:block;font:700 19px 'Roboto Mono';color:#111;margin-top:4px}
  .ft{margin-top:12px;font-size:11.5px;color:#555;line-height:1.45}
  `;
  const inner = `<div class="doc">
   <div class="bh"><div class="logo">PMC</div><div><div class="bn">Pune Merchants Co-operative Bank Ltd.</div><div class="bs">Kothrud Branch, Paud Road, Pune 411038</div></div></div>
   <h1>UPI Merchant Collections Statement</h1>
   <div class="mi"><div><span>Merchant name:</span> <b>SHARMA GENERAL STORE</b></div><div><span>Statement period:</span> <b>13 Sep 2026 – 12 Oct 2026</b></div>
     <div><span>UPI ID:</span> <b>sharmagenstore@pmcb</b></div><div><span>Settlement A/c:</span> <b>XXXXXX4417</b></div>
     <div><span>Address:</span> Shop 4, Karve Road, Kothrud, Pune 411038</div><div><span>Generated on:</span> 13 Oct 2026, 09:14</div></div>
   <table><tr><th>Date</th><th>Day</th><th class="c">No. of payments</th><th class="r">Amount received (₹)</th></tr>${tr}
   <tr class="t"><td>Total (30 days)</td><td></td><td class="c">${cnt}</td><td class="r">${inr2(tot)}</td></tr></table>
   <div class="sb"><div>Total received<b>₹${inr2(tot)}</b></div><div>Total payments<b>${cnt}</b></div><div>Unique payers<b>412</b></div><div>Repeat payers<b>71%</b></div></div>
   <div class="ft">Average per day: ₹${inr2(tot / 30)}. Amounts are credited to the settlement account on T+0. This is a computer-generated statement and does not require a signature.</div>
   </div><div class="sample">${SAMPLE}</div>`;
  return photo({ W: 1000, H: 1600, pw: 900, ph: 1500, rot: -0.7, tilt: 1.4, table: 'grey', paper: '#fafaf7', inner, css, light: '35% 18%' });
}

/* ---------------------------- India electricity ---------------------------- */
function elecA(b, i) {
  const lines = [['Fixed / Demand Charges', '', b.fixed], ['Energy Charges', `${b.kwh} kWh × 8.20`, b.energy], ['Wheeling Charges', `${b.kwh} kWh × 1.17`, b.wheeling],
    ['Electricity Duty (12%)', '', b.duty], ['Fuel Adjustment Charge', '', b.fac]];
  const css = `
  .doc{position:absolute;inset:0;padding:34px 44px;color:#1b1b1b;font-family:Inter,sans-serif;z-index:20}
  .bh{display:flex;justify-content:space-between;align-items:center;background:#b45309;color:#fff;margin:-34px -44px 0;padding:18px 44px}
  .bh .n{font:800 26px Inter}.bh .s{font-size:13px;opacity:.9}
  .bolt{width:52px;height:52px;border-radius:10px;background:#fff;color:#b45309;font:900 34px Inter;display:flex;align-items:center;justify-content:center;margin-right:14px}
  .t{font:700 18px Inter;margin:16px 0 10px;letter-spacing:1px}
  .g{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #555;font-size:14.5px}
  .g div{padding:7px 12px;border-bottom:1px solid #bbb}.g div:nth-child(odd){border-right:1px solid #bbb}
  .g span{display:block;color:#555;font-size:11.5px;text-transform:uppercase;letter-spacing:.5px}
  .due{display:flex;gap:14px;margin-top:16px}
  .due div{flex:1;border:2px solid #b45309;padding:12px;text-align:center;font-size:13px;color:#444}
  .due b{display:block;font:800 26px 'Roboto Mono';color:#111;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:16px;font:15px 'Roboto Mono'}
  th{background:rgba(180,83,9,.12);padding:8px;font:600 13px Inter;text-align:left;border:1px solid #999}
  td{padding:8px;border:1px solid #bbb}td.r{text-align:right}
  tr.t td{font-weight:800;font-size:17px;border-top:2px solid #333}
  .lp{margin-top:16px;border:1.5px dashed #444;padding:12px 14px;font-size:15px;background:rgba(22,101,52,.06)}
  .lp b{color:#166534}
  .hist{margin-top:14px;font-size:13px;color:#333}
  .ft{position:absolute;left:44px;right:44px;bottom:40px;font-size:11.5px;color:#555;border-top:1px solid #aaa;padding-top:8px}
  `;
  const inner = `<div class="doc">
   <div class="bh"><div style="display:flex;align-items:center"><div class="bolt">ϟ</div><div><div class="n">Pune Power Distribution Co.</div><div class="s">Kothrud Sub-Division, Pune</div></div></div><div style="text-align:right;font-size:14px">ELECTRICITY BILL<br><b style="font-size:18px">${b.month}</b></div></div>
   <div class="t">CONSUMER DETAILS</div>
   <div class="g"><div><span>Consumer name</span><b>SUNITA SHARMA (SHARMA GENERAL STORE)</b></div><div><span>Consumer No.</span><b>170023456781</b></div>
   <div><span>Service address</span>Shop 4, Karve Road, Kothrud, Pune 411038</div><div><span>Tariff</span><b>LT-II Commercial</b> · Sanctioned load 4 kW</div>
   <div><span>Bill No.</span>${b.billNo}</div><div><span>Billing period</span>${b.period}</div>
   <div><span>Meter reading (prev → current)</span>${b.prev} → ${b.prev + b.kwh}</div><div><span>Units consumed</span><b>${b.kwh} kWh</b></div></div>
   <div class="due"><div>Bill date<b>${b.billDate}</b></div><div>Due date<b>${b.due}</b></div><div>Amount payable<b>₹${inr2(b.total)}</b></div></div>
   <table><tr><th>Charge head</th><th>Basis</th><th style="text-align:right">Amount (₹)</th></tr>
   ${lines.map((l) => `<tr><td>${l[0]}</td><td>${l[1]}</td><td class="r">${inr2(l[2])}</td></tr>`).join('')}
   <tr><td>Arrears / Previous balance</td><td></td><td class="r">0.00</td></tr>
   <tr class="t"><td>NET BILL AMOUNT</td><td></td><td class="r">${inr2(b.total)}</td></tr></table>
   <div class="lp">Last payment received: <b>₹${inr2(b.lastPay.amt)} on ${b.lastPay.date}</b> against ${b.lastPay.forMonth} bill (due date ${b.lastPay.due}) — <b>Paid on time</b>. Thank you.</div>
   <div class="hist">Pay before the due date to avoid delayed payment charges. Prompt payment discount of 1% is available if paid within 7 days of bill date.</div>
   <div class="ft">Fictional utility — sample bill created for software demonstration only.</div>
   </div><div class="sample">${SAMPLE}</div>`;
  return photo({ W: 1000, H: 1400, pw: 870, ph: 1240, rot: [1.2, -0.8, 0.6][i], tilt: [1.5, 1.2, 2][i], table: ['wood', 'grey', 'cloth'][i], paper: '#f9f8f3', inner, css, light: ['30% 25%', '60% 20%', '40% 15%'][i] });
}

/* ---------------------------- PH electricity ---------------------------- */
function elecB(b, i) {
  const lp = b.lastPay;
  const lpStatus = lp.late ? `<b style="color:#b91c1c">Received ${lp.late} days after due date</b>` : '<b style="color:#166534">Paid on time</b>';
  const css = `
  .doc{position:absolute;inset:0;padding:32px 42px;color:#1b1b1b;font-family:Inter,sans-serif;z-index:20}
  .bh{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #e0a800;padding-bottom:12px}
  .lg{display:flex;align-items:center;gap:12px}.lg i{width:54px;height:54px;border-radius:50%;background:#123b7a;display:flex;align-items:center;justify-content:center;color:#ffd23f;font:900 30px Inter;font-style:normal}
  .n{font:800 25px Inter;color:#123b7a}.s{font-size:12.5px;color:#555}
  .box{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:16px}
  .ci{font-size:14.5px;line-height:1.55}.ci span{color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.4px}
  .amt{background:#123b7a;color:#fff;padding:16px;text-align:center;border-radius:6px}
  .amt .v{font:800 34px 'Roboto Mono';margin:6px 0}.amt .d{font-size:14px}
  table{width:100%;border-collapse:collapse;margin-top:16px;font:14.5px 'Roboto Mono'}
  th{background:#e8eef8;padding:8px;font:600 12.5px Inter;text-align:left;border-bottom:2px solid #123b7a}
  td{padding:7px 8px;border-bottom:1px solid #ccc}td.r{text-align:right}
  tr.t td{font-weight:800;font-size:17px;border-top:2px solid #222;border-bottom:none}
  .lp{margin-top:16px;padding:12px 14px;border-left:5px solid #e0a800;background:rgba(224,168,0,.08);font-size:15px}
  .stamp{position:absolute;right:64px;bottom:150px;border:4px solid rgba(185,28,28,.6);color:rgba(185,28,28,.68);padding:6px 14px;font:900 24px/1.1 'Roboto Mono';transform:rotate(-12deg);text-align:center;z-index:30;border-radius:6px}
  .stamp small{display:block;font-size:15px;font-weight:700}
  .ft{position:absolute;left:42px;right:42px;bottom:40px;font-size:11.5px;color:#555;border-top:1px solid #aaa;padding-top:8px}
  `;
  const inner = `<div class="doc">
   <div class="bh"><div class="lg"><i>M</i><div><div class="n">Metro Luzon Power Co.</div><div class="s">Quezon City Business Center</div></div></div><div style="text-align:right;font-size:13px">STATEMENT OF ACCOUNT<br><b style="font-size:17px">${b.month}</b></div></div>
   <div class="box"><div class="ci"><span>Customer name</span><br><b>NENA DIZON</b><br><span>Account no.</span><br><b>4420-1187-03</b><br><span>Service address</span><br>18 J.P. Rizal St., Project 4, Quezon City<br><span>Rate type</span> Residential / Small Business</div>
   <div class="amt"><div class="d">Total Amount Due</div><div class="v">₱${php2(b.total)}</div><div class="d">Due date: <b>${b.due}</b></div><div class="d" style="margin-top:6px;opacity:.85">Bill date: ${b.billDate}</div></div></div>
   <div class="ci" style="margin-top:12px">Bill no. ${b.billNo} · Billing period ${b.period} · Meter reading ${b.prev} → ${b.prev + b.kwh} · <b>Consumption: ${b.kwh} kWh</b></div>
   <table><tr><th>Charges</th><th>Basis</th><th style="text-align:right">Amount (₱)</th></tr>
   ${b.lines.map((l) => `<tr><td>${l[0]}</td><td>${l[1]}</td><td class="r">${php2(l[2])}</td></tr>`).join('')}
   <tr><td>Government Taxes (VAT 12%)</td><td></td><td class="r">${php2(b.vat)}</td></tr>
   <tr><td>Universal Charges / FIT-All / Others</td><td></td><td class="r">${php2(b.universal)}</td></tr>
   <tr><td>Previous balance</td><td></td><td class="r">0.00</td></tr>
   <tr class="t"><td>TOTAL AMOUNT DUE</td><td></td><td class="r">${php2(b.total)}</td></tr></table>
   <div class="lp">Last payment received: <b>₱${php2(lp.amt)} on ${lp.date}</b> for ${lp.forMonth} bill (due ${lp.due}) — ${lpStatus}.</div>
   <div class="ft">Fictional utility — sample statement for software demonstration only.</div>
   </div>${b.paidStamp ? `<div class="stamp">PAID<small>${b.paidStamp}</small></div>` : ''}<div class="sample">${SAMPLE}</div>`;
  return photo({ W: 1000, H: 1400, pw: 870, ph: 1240, rot: [-0.9, 1.2, -1.0][i], tilt: [1.4, 2, 1][i], table: ['cloth', 'wood', 'grey'][i], paper: '#fbfaf6', inner, css, light: ['35% 25%', '55% 20%', '30% 30%'][i] });
}

/* ---------------------------- PayLakbay wallet screenshots ---------------------------- */
const hm = (t) => { const h = Math.floor(t / 60), m = t % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
function wallet(s, k) {
  const last = s.days[5].date;
  const RH = 37, DH = 29;
  const groups = [...s.days].reverse().map((d) => {
    const items = d.rows.map((r) => ({ t: r.t, html: `<div class="tx"><i>${r.name[0]}</i><div class="nm">${r.name}<small>Received · ${hm(r.t)}</small></div><div class="am in">+₱${php2(r.amt)}</div></div>` }));
    for (const o of s.out.filter((o) => o.date === d.date)) items.push({ t: o.t, html: `<div class="tx"><i class="o">↑</i><div class="nm">${o.label}<small>Sent · ${hm(o.t)}</small></div><div class="am">−₱${php2(o.amt)}</div></div>` });
    if (s.tampered && d.date === M.B_tamper.date) items.push({ t: M.B_tamper.t, html: `<div class="tx"><i>J</i><div class="nm">${M.B_tamper.name}<small>Received · ${hm(M.B_tamper.t)}</small></div><div class="am in tamper">+₱${php2(M.B_tamper.amt)}</div></div>` });
    items.sort((a, b) => b.t - a.t);
    const dd = M.D(d.date);
    return `<div class="day">${DOW[dd.getUTCDay()]}, ${dMonY(d.date)}</div>${items.map((x) => x.html).join('')}`;
  }).join('');
  const nRows = s.days.reduce((a, d) => a + d.rows.length, 0) + s.out.length + (s.tampered ? 1 : 0);
  const H = Math.max(1480, 300 + nRows * RH + 6 * DH + 46);
  const statusTime = ['9:52', '10:07', '9:38', '9:45', '10:12'][k];
  return {
    H,
    html: `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  *{box-sizing:border-box}html,body{margin:0}body{width:720px;height:${H}px;overflow:hidden;background:#f3f5f9;font-family:Inter,sans-serif;color:#151a24;position:relative}
  .sb{height:38px;background:#0d6e6e;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:0 22px;font:600 15px Inter}
  .ab{background:#0d6e6e;color:#fff;padding:4px 22px 14px;display:flex;align-items:center;gap:16px;font:600 20px Inter}
  .card{background:linear-gradient(135deg,#0d6e6e,#14958f);color:#fff;padding:4px 26px 20px}
  .card .m{font:700 15px Inter;letter-spacing:1px;opacity:.9}.card .id{font-size:12.5px;opacity:.75;margin-top:2px}
  .card .bl{font-size:13px;opacity:.85;margin-top:10px}.card .bv{font:800 38px Inter;margin-top:2px;letter-spacing:-.5px}.card .as{font-size:12px;opacity:.75}
  .chips{display:flex;gap:10px;padding:12px 22px 6px}.chips span{padding:6px 14px;border-radius:16px;background:#e2e7ef;font:600 13px Inter;color:#4a5568}.chips span.on{background:#0d6e6e;color:#fff}
  .day{padding:8px 22px 5px;font:700 13px Inter;color:#64748b;background:#eef1f6;border-top:1px solid #e2e6ee;height:${DH}px}
  .tx{display:flex;align-items:center;gap:12px;padding:0 22px;height:${RH}px;background:#fff;border-bottom:1px solid #edf0f4}
  .tx i{width:26px;height:26px;border-radius:50%;background:#d7efec;color:#0d6e6e;font:700 12px Inter;font-style:normal;display:flex;align-items:center;justify-content:center;flex:none}
  .tx i.o{background:#fde7e7;color:#b42318}
  .tx .nm{flex:1;font:600 14.5px/1.1 Inter;display:flex;align-items:baseline;gap:10px}.tx .nm small{font:400 12px Inter;color:#7b8794}
  .tx .am{font:600 15px Inter;font-variant-numeric:tabular-nums;color:#b42318}.tx .am.in{color:#0f7b3f}
  .tx .am.tamper{font-family:Roboto,Arial,sans-serif;font-weight:900;font-size:16.5px;color:#0c7a3a;transform:translate(4px,3px);letter-spacing:.3px}
  .ft{text-align:center;font:500 11.5px Inter;color:#94a3b8;padding:10px 0}
  .nav{position:absolute;bottom:0;left:0;right:0;height:16px;display:flex;justify-content:center;align-items:center}.nav b{width:130px;height:5px;border-radius:3px;background:#1f2937;opacity:.6}
  </style></head><body>
  <div class="sb"><span>${statusTime}</span><span>▂▄▆ &nbsp;LTE &nbsp;▮ 78%</span></div>
  <div class="ab">‹ &nbsp;Transaction History</div>
  <div class="card"><div class="m">NENA'S SARI-SARI</div><div class="id">PayLakbay Merchant · ID PLK-0093-4471</div>
   <div class="bl">Wallet balance</div><div class="bv">₱${php2(s.shownBalance)}</div><div class="as">as of ${dMonY(last)}, ${['9:48 PM', '10:02 PM', '9:31 PM', '9:40 PM', '10:05 PM'][k]}</div></div>
  <div class="chips"><span class="on">All</span><span>Received</span><span>Sent</span><span>${dMonY(s.days[0].date).slice(0, 6)} – ${dMonY(last).slice(0, 6)}</span></div>
  ${groups}
  <div class="ft">${SAMPLE}</div><div class="nav"><b></b></div>
  </body></html>`,
  };
}

/* ---------------------------- render ---------------------------- */
const jobs = [
  ...A_ledgers,
  ...M.A_invoices.map((inv, i) => ({ file: inv.file, html: invoiceA(inv, i), W: 1000, H: 1400 })),
  { file: 'shopA/upi-statement.jpg', html: upiStatement(), W: 1000, H: 1600 },
  ...M.A_elec.map((b, i) => ({ file: b.file, html: elecA(b, i), W: 1000, H: 1400 })),
  { file: 'shopA/shopfront.jpg', html: shopfrontA(FONTS, SAMPLE), W: 1280, H: 860 },
  ...B_ledgers,
  ...M.B_invoices.map((inv, i) => ({ file: inv.file, html: invoiceB(inv, i), W: 1000, H: 1400 })),
  ...M.B_wallet.map((s, k) => { const w = wallet(s, k); return { file: s.file, html: w.html, W: 720, H: w.H }; }),
  ...M.B_elec.map((b, i) => ({ file: b.file, html: elecB(b, i), W: 1000, H: 1400 })),
  { file: 'shopB/shopfront.jpg', html: shopfrontB(FONTS, SAMPLE), W: 1280, H: 860 },
];

const run = (cmd, args, timeout = 90000) => new Promise((res, rej) => execFile(cmd, args, { timeout }, (err, so, se) => (err ? rej(new Error(err.message + se)) : res(so))));
async function render(job) {
  const base = job.file.replace(/[\/]/g, '__').replace('.jpg', '');
  const htmlPath = path.join(BUILD, base + '.html');
  const pngPath = path.join(BUILD, base + '.png');
  fs.writeFileSync(htmlPath, job.html);
  const out = path.join(OUT, job.file);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'koshachrome-'));
  try {
    await run(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${prof}`,
      '--force-device-scale-factor=1', `--window-size=${job.W},${job.H}`, '--virtual-time-budget=10000', `--screenshot=${pngPath}`, `file://${htmlPath}`]);
  } finally { fs.rmSync(prof, { recursive: true, force: true }); }
  await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', pngPath, '--out', out]);
  return out;
}

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('--'));
if (!args.includes('--no-render')) {
  const todo = jobs.filter((j) => !filter || j.file.includes(filter));
  for (let i = 0; i < todo.length; i += 4) {
    const done = await Promise.all(todo.slice(i, i + 4).map(render));
    for (const f of done) console.log('rendered', path.relative(ROOT, f), Math.round(fs.statSync(f).size / 1024) + ' KB');
  }
}

/* ---------------------------- README + manifest ---------------------------- */
const kindA = { sale: 'cash sale', purchase: 'purchase', udhar: 'credit given', repay: 'credit repaid', exp: 'expense' };
const kindB = { sale: 'cash sale', purchase: 'purchase', utang: 'credit given', repay: 'credit repaid', exp: 'expense' };
const md = `# Kosha sample documents

Every image here is a **fictional SAMPLE (for demo only)** and carries the mark "SAMPLE – for demo only". All businesses, suppliers, utilities, banks and wallets are invented.
Generated by \`scripts/samples/kosha/generate.mjs\` (numbers in \`scripts/samples/kosha/data.mjs\`, which asserts every total; shopfront art in \`scripts/samples/kosha/shopfront.mjs\`).
Re-run: \`node scripts/samples/kosha/generate.mjs\` (optional filter substring, e.g. \`shopB/wallet\`).

## Files

| File | What it is |
|---|---|
| shopA/ledger-1.jpg | Handwritten Hindi khata, 22/9–28/9 (सितंबर 2026 — पेज 1) |
| shopA/ledger-2.jpg | Khata 29/9–5/10 (पेज 2). 30/9 sale has a struck-out "5840/-" corrected to 5480/- |
| shopA/ledger-3.jpg | Khata 6/10–12/10 (अक्टूबर 2026 — पेज 3) |
| shopA/invoice-1..4.jpg | Supplier tax invoices; each matches one ledger purchase row (date + total) |
| shopA/upi-statement.jpg | UPI merchant collections statement, Pune Merchants Co-operative Bank (fictional), 13 Sep – 12 Oct 2026 |
| shopA/electricity-1..3.jpg | Pune Power Distribution Co. (fictional) bills, Jul / Aug / Sep 2026 |
| shopA/shopfront.jpg | Illustrated shop exterior (signboard शर्मा जनरल स्टोर / SHARMA GENERAL STORE, QR sticker) |
| shopB/ledger-1.jpg | Handwritten Taglish listahan 9/24–10/2 |
| shopB/ledger-2.jpg | Listahan 10/3–10/11. 10/3 Benta has a struck-out "5,600" corrected to 5,060 |
| shopB/invoice-1..3.jpg | Balintawak Wholesale Trading (fictional) sales invoices; each matches a ledger "Bili" row |
| shopB/wallet-1..5.jpg | PayLakbay (fictional e-wallet) merchant history screenshots, 6 days each, 13 Sep – 12 Oct 2026. **wallet-3 is TAMPERED** |
| shopB/electricity-1..3.jpg | Metro Luzon Power Co. (fictional) bills, Jul / Aug / Sep 2026 |
| shopB/shopfront.jpg | Illustrated sari-sari store (grille window, sachet strips, sign NENA'S SARI-SARI STORE) |

## Shop A — Sharma General Store (Pune · Hindi · ₹)

Ledger period 22 Sep – 12 Oct 2026 (21 days). Columns: तारीख | विवरण | रकम.

### Daily cash sales (बिक्री — नकद)
| Date | ₹ |
|---|---|
${M.A_cashDays.map(([d, a]) => `| ${d} (${DOW[M.D(d).getUTCDay()]}) | ${inr(a)} |`).join('\n')}
| **Total (21 days)** | **${inr(sum(M.A_cashDays.map((x) => x[1])))}** |
| **Average / day** | **${inr(sum(M.A_cashDays.map((x) => x[1])) / 21)}** |

### Wholesale purchases (Agarwal Traders Mon+Thu, Mahalaxmi Distributors Sat)
| Date | Supplier | Bill no. | ₹ | Invoice image |
|---|---|---|---|---|
${M.A_purchases.map((p) => { const inv = M.A_invoices.find((i) => i.date === p[0]); return `| ${p[0]} (${DOW[M.D(p[0]).getUTCDay()]}) | ${p[1] === 'agarwal' ? 'Agarwal Traders' : 'Mahalaxmi Distributors'} | ${p[2]} | ${inr(p[3])} | ${inv ? inv.file + ' (' + inv.no + ')' : '—'} |`; }).join('\n')}
| **Total** | | | **${inr(sum(M.A_purchases.map((p) => p[3])))}** (= ${(sum(M.A_purchases.map((p) => p[3])) / 120750 * 100).toFixed(1)}% of cash sales) | |

### Invoice line items (qty × rate)
${M.A_invoices.map((inv) => `- **${inv.file}** — ${inv.no}, ${dmy(inv.date)}, ${inv.supplier === 'agarwal' ? 'Agarwal Traders, terms "Credit 15 days"' : 'Mahalaxmi Distributors, terms "Paid – Cash"'}: ${inv.items.map((it) => `${it[0]} ${it[2]} ${it[3]} × ${it[4]} = ${it[2] * it[4]}`).join('; ')} → **₹${inr(inv.total)}**`).join('\n')}

### Credit and expense rows
| Date | Row (as written) | ₹ | Type |
|---|---|---|---|
${M.A_other.map((o) => `| ${o[0]} | ${o[2]} | ${inr(o[3])} | ${kindA[o[1]]} |`).join('\n')}

Customer credit: given ₹${inr(M.A_credit.given)} − repaid ₹${inr(M.A_credit.repaid)} = **₹${inr(M.A_credit.net)} outstanding** (interview says "करीब साढ़े चार हज़ार").

### Full ledger, page by page
${M.A_pages.map((p) => `**${p.file}** (${p.title})\n\n| Date | विवरण | ₹ |\n|---|---|---|\n${p.rows.map((r) => `| ${r.date} | ${r.text}${r.strike ? ` (struck "${r.strike}")` : ''} | ${inr(r.amt)} |`).join('\n')}`).join('\n\n')}

### UPI collections (13 Sep – 12 Oct 2026)
| Date | Payments | ₹ |
|---|---|---|
${M.A_upi.map((x) => `| ${x.date} (${DOW[M.D(x.date).getUTCDay()]}) | ${x.count} | ${inr(x.amt)} |`).join('\n')}
| **Total** | **${sum(M.A_upi.map((x) => x.count))}** | **${inr(sum(M.A_upi.map((x) => x.amt)))}** |

Average ₹${inr(sum(M.A_upi.map((x) => x.amt)) / 30)}/day; weekday avg ₹${inr(Math.round(sum(M.A_upi.filter((x) => !x.we).map((x) => x.amt)) / M.A_upi.filter((x) => !x.we).length))}, weekend avg ₹${inr(Math.round(sum(M.A_upi.filter((x) => x.we).map((x) => x.amt)) / M.A_upi.filter((x) => x.we).length))}. Unique payers 412, repeat payers 71%.

### Electricity — consumer 170023456781, LT-II Commercial
| File | Month | kWh | Amount ₹ | Bill date | Due | Last payment line |
|---|---|---|---|---|---|---|
${M.A_elec.map((b) => `| ${b.file} | ${b.month} | ${b.kwh} | ${inr(b.total)} | ${b.billDate} | ${b.due} | ₹${inr(b.lastPay.amt)} on ${b.lastPay.date} for ${b.lastPay.forMonth} (due ${b.lastPay.due}) — on time |`).join('\n')}

The ledger row "बिजली बिल (सितंबर) 5480/-" on 6/10 pays the Sep bill (₹5,480).

## Shop B — Nena's Sari-Sari Store (Quezon City · Taglish · ₱)

Ledger period 24 Sep – 11 Oct 2026 (18 days). Columns: Petsa | Detalye | Halaga.

### Daily Benta (cash)
| Date | ₱ |
|---|---|
${M.B_cashDays.map(([d, a]) => `| ${d} (${DOW[M.D(d).getUTCDay()]}) | ${php(a)} |`).join('\n')}
| **Total (18 days)** | **${php(sum(M.B_cashDays.map((x) => x[1])))}** |
| **Average / day** | **${php(sum(M.B_cashDays.map((x) => x[1])) / 18)}** |

### Purchases — "Bili — Balintawak Wholesale" (Tue & Fri)
| Date | ₱ | Invoice image |
|---|---|---|
${M.B_purchases.map((p) => { const inv = M.B_invoices.find((i) => i.date === p[0]); return `| ${p[0]} (${DOW[M.D(p[0]).getUTCDay()]}) | ${php(p[1])} | ${inv ? inv.file + ' (No. ' + inv.no + ')' : '—'} |`; }).join('\n')}
| **Total** | **${php(sum(M.B_purchases.map((p) => p[1])))}** | |

### Invoice line items
${M.B_invoices.map((inv) => `- **${inv.file}** — No. ${inv.no}, ${dMonY(inv.date)}, Terms: Cash: ${inv.items.map((it) => `${it[0]} ${it[1]} ${it[2]} × ${it[3]} = ${it[1] * it[3]}`).join('; ')} → **₱${php(inv.total)}** (VAT-inclusive)`).join('\n')}

### Credit and expense rows
| Date | Row (as written) | ₱ | Type |
|---|---|---|---|
${M.B_other.map((o) => `| ${o[0]} | ${o[2]} | ${php(o[3])} | ${kindB[o[1]]} |`).join('\n')}

Customer credit: utang ₱${php(M.B_credit.given)} − bayad ₱${php(M.B_credit.repaid)} = **₱${php(M.B_credit.net)} outstanding** (interview says "mga 1,700 pesos").

### Full ledger, page by page
${M.B_pages.map((p) => `**${p.file}** (${p.title})\n\n| Date | Detalye | ₱ |\n|---|---|---|\n${p.rows.map((r) => `| ${r.date} | ${r.text}${r.strike ? ` (struck "${php(r.strike)}")` : ''} | ${php(r.amt)} |`).join('\n')}`).join('\n\n')}

### PayLakbay wallet (13 Sep – 12 Oct 2026)
Genuine incoming ₱${php(sum(M.B_walletDays.map((d) => d.total)))} over 30 days = **₱${php(sum(M.B_walletDays.map((d) => d.total)) / 30)}/day**. Opening balance before 13 Sep: ₱${php2(M.B_walletStart)}.

| Screenshot | Days | Genuine incoming ₱ | Cash-outs | Balance shown | True balance |
|---|---|---|---|---|---|
${M.B_wallet.map((s) => `| ${s.file} | ${s.days[0].date} – ${s.days[5].date} | ${php(s.incoming)} | ${s.out.map((o) => `${o.label} ₱${php(o.amt)} (${o.date})`).join(', ')} | ${php2(s.shownBalance)} | ${php2(s.trueBalance)} |`).join('\n')}

Every incoming row:
${M.B_walletDays.map((d) => `- ${d.date} (total ₱${php(d.total)}): ${d.rows.map((r) => `${hm(r.t)} ${r.name} ₱${php(r.amt)}`).join('; ')}`).join('\n')}

**Tampering (wallet-3.jpg):** an extra incoming row on 28 Sep 2026, ${hm(M.B_tamper.t)}, "${M.B_tamper.name}" **+₱48,000.00**, its digits in a heavier weight, a different font (Roboto Black vs Inter) and offset a few pixels. wallet-3's balance (₱${php2(M.B_wallet[2].shownBalance)}) includes it, but wallet-4's balance ₱${php2(M.B_wallet[3].shownBalance)} = true wallet-3 balance ₱${php2(M.B_wallet[2].trueBalance)} + ₱${php(M.B_wallet[3].incoming)} − ₱${php(sum(M.B_wallet[3].out.map((o) => o.amt)))}, i.e. it does NOT include the ₱48,000, so continuity breaks by exactly ₱48,000. wallet-1→2 and wallet-4→5 reconcile (balance = previous + incoming − cash-outs); wallet-2→3 reconciles only if the fake row is counted.

### Electricity — Metro Luzon Power Co., account 4420-1187-03
| File | Month | kWh | Amount ₱ | Bill date | Due | Payment evidence |
|---|---|---|---|---|---|---|
${M.B_elec.map((b) => `| ${b.file} | ${b.month} | ${b.kwh} | ${php(b.total)} | ${b.billDate} | ${b.due} | Last payment line: ₱${php(b.lastPay.amt)} on ${b.lastPay.date} for ${b.lastPay.forMonth} (due ${b.lastPay.due})${b.lastPay.late ? ` — ${b.lastPay.late} days LATE` : ' — on time'}${b.paidStamp ? `; PAID stamp ${b.paidStamp} (on time)` : ''} |`).join('\n')}

Payment history: Jul bill paid Aug 17 (due Aug 19, on time) · Aug bill paid Sep 24 (due Sep 18, **6 days late**) · Sep bill paid Oct 10 (due Oct 19, on time; matches ledger "Kuryente (Sept bill) 2,530" on 10/10).
`;
fs.writeFileSync(path.join(OUT, 'README.md'), md);

const manifest = {
  shops: [
    {
      id: 'shopA', country: 'IN', language: 'hi', currency: 'INR', shopName: 'Sharma General Store', ownerName: 'Sunita Sharma',
      address: 'Shop 4, Karve Road, Kothrud, Pune, Maharashtra 411038', shopType: 'Kirana (general store)', since: 2015,
      docs: {
        ledger: M.A_pages.map((p) => p.file), invoice: M.A_invoices.map((i) => i.file),
        payments: ['shopA/upi-statement.jpg'], electricity: M.A_elec.map((b) => b.file), shopfront: ['shopA/shopfront.jpg'],
      },
      interview: {
        years: 'हमारी दुकान 2015 से चल रही है, यानी करीब 11 साल हो गए। कोथरूड में सब लोग हमें जानते हैं।',
        suppliers: 'ज़्यादातर माल अग्रवाल ट्रेडर्स से आता है, हफ़्ते में दो बार — सोमवार और गुरुवार। हर शनिवार महालक्ष्मी डिस्ट्रीब्यूटर्स से साबुन, बिस्किट, चाय जैसा सामान लेते हैं।',
        busy: 'शनिवार-रविवार को सबसे ज़्यादा भीड़ रहती है। गणपति और दिवाली के समय तो बिक्री बहुत बढ़ जाती है।',
        credit: 'हाँ, पहचान वाले ग्राहकों को उधार देते हैं। अभी लोगों पर करीब साढ़े चार हज़ार रुपये बाकी हैं, ज़्यादातर महीने के अंदर लौटा देते हैं।',
        purpose: 'दूध, दही और कोल्ड ड्रिंक के लिए एक दूसरा फ्रिज लेना है, करीब 45 हज़ार का, और दिवाली के लिए ज़्यादा माल भरना है। इससे महीने में करीब 6 हज़ार रुपये ज़्यादा मुनाफ़ा होगा।',
      },
    },
    {
      id: 'shopB', country: 'PH', language: 'tl', currency: 'PHP', shopName: "Nena's Sari-Sari Store", ownerName: 'Nena Dizon',
      address: '18 J.P. Rizal St., Project 4, Quezon City, Metro Manila 1109', shopType: 'Sari-sari store', since: 2023,
      docs: {
        ledger: M.B_pages.map((p) => p.file), invoice: M.B_invoices.map((i) => i.file),
        payments: M.B_wallet.map((s) => s.file), electricity: M.B_elec.map((b) => b.file), shopfront: ['shopB/shopfront.jpg'],
      },
      interview: {
        years: 'Nagsimula po ako noong 2023, kaya mga 3 years na po itong tindahan.',
        suppliers: 'Sa Balintawak Wholesale po ako namimili, every Tuesday and Friday. Doon na po lahat — bigas, de-lata, noodles, kape, softdrinks.',
        busy: 'Pinakamalakas po kapag weekend at tuwing sweldo, mga 15 at 30. Tapos sobrang lakas po pag Christmas season.',
        credit: 'May mga suki po na nag-uutang, mga 1,700 pesos lahat-lahat ngayon. Nagbabayad naman po sila pag sweldo.',
        purpose: 'Gusto ko pong bumili ng chest freezer para sa ice candy at frozen goods, mga 18,000 pesos, tapos dagdag stock para sa Pasko. Siguro mga 2,500 pesos po ang dagdag kita ko kada buwan.',
      },
    },
  ],
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log('wrote README.md and manifest.json');
