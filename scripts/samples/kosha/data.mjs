// All numbers for the Kosha sample documents. Every total is asserted.
// Run `node scripts/samples/kosha/generate.mjs` to rebuild the JPGs, README and manifest.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
export const sum = (a) => a.reduce((s, x) => s + x, 0);

export const D = (s) => new Date(s + 'T00:00:00Z');
export const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
export const iso = (d) => d.toISOString().slice(0, 10);
export const dow = (d) => d.getUTCDay(); // 0 Sun
export const range = (from, n) => Array.from({ length: n }, (_, i) => addDays(D(from), i));

/* ============================== SHOP A ============================== */
const A_days = range('2026-09-22', 21); // Tue 22 Sep .. Mon 12 Oct
const A_cash = [5480, 5620, 5310, 5890, 6540, 6610, 5150, 5260, 5480, 4960, 5920, 6380, 6480, 5340,
  5070, 5560, 5440, 6010, 6470, 6600];
A_cash.push(5750 * 21 - sum(A_cash));
assert(A_cash.length === 21 && sum(A_cash) === 120750, 'A cash sum');
assert(A_cash.every((x) => x >= 4900 && x <= 6800), 'A cash range');

// Invoices: [description, HSN, qty, unit, rate] (rates GST-inclusive)
export const A_invoices = [
  {
    file: 'shopA/invoice-1.jpg', supplier: 'agarwal', no: 'AT/26-27/1187', date: '2026-09-24',
    items: [
      ['Rice (Kolam) 25 kg bag', '1006', 3, 'Bag', 1350],
      ['Wheat Atta 10 kg', '1101', 5, 'Bag', 420],
      ['Toor Dal (loose)', '0713', 20, 'Kg', 142],
      ['Sugar (S-30)', '1701', 25, 'Kg', 44],
      ['Sunflower Oil 1 L pouch', '1512', 15, 'Pcs', 148],
      ['Tea CTC (loose)', '0902', 2, 'Kg', 290],
    ],
  },
  {
    file: 'shopA/invoice-2.jpg', supplier: 'agarwal', no: 'AT/26-27/1243', date: '2026-10-01',
    items: [
      ['Rice (Kolam) 25 kg bag', '1006', 3, 'Bag', 1350],
      ['Basmati Rice 5 kg', '1006', 3, 'Bag', 520],
      ['Wheat Atta 10 kg', '1101', 4, 'Bag', 420],
      ['Moong Dal (loose)', '0713', 10, 'Kg', 128],
      ['Toor Dal (loose)', '0713', 10, 'Kg', 142],
      ['Sunflower Oil 1 L pouch', '1512', 12, 'Pcs', 148],
      ['Iodised Salt 1 kg', '2501', 20, 'Pcs', 22],
    ],
  },
  {
    file: 'shopA/invoice-3.jpg', supplier: 'mahalaxmi', no: 'MD/2026/0864', date: '2026-10-03',
    items: [
      ['Tea Dust 1 kg pack', '0902', 3, 'Pcs', 460],
      ['Glucose Biscuits (ctn of 48)', '1905', 3, 'Ctn', 480],
      ['Bath Soap 100 g', '3401', 24, 'Pcs', 32],
      ['Detergent Powder 1 kg', '3402', 10, 'Pcs', 88],
      ['Toothpaste 150 g', '3306', 12, 'Pcs', 78],
      ['Groundnut Oil 1 L', '1508', 6, 'Pcs', 185],
      ['Poha 1 kg', '1904', 10, 'Pcs', 56],
      ['Besan 1 kg', '1106', 10, 'Pcs', 92],
    ],
  },
  {
    file: 'shopA/invoice-4.jpg', supplier: 'agarwal', no: 'AT/26-27/1302', date: '2026-10-08',
    items: [
      ['Rice (Kolam) 25 kg bag', '1006', 3, 'Bag', 1360],
      ['Wheat Atta 10 kg', '1101', 5, 'Bag', 420],
      ['Toor Dal (loose)', '0713', 12, 'Kg', 140],
      ['Chana Dal (loose)', '0713', 10, 'Kg', 96],
      ['Sugar (S-30)', '1701', 50, 'Kg', 44],
      ['Sunflower Oil 1 L pouch', '1512', 10, 'Pcs', 150],
      ['Tea CTC 250 g pack', '0902', 8, 'Pcs', 115],
    ],
  },
];
// Stock buying is sized to ~85% of TOTAL sales (cash + UPI), a normal kirana margin.
for (const inv of A_invoices) for (const it of inv.items) it[2] = Math.round(it[2] * 2.5);
for (const inv of A_invoices) inv.total = sum(inv.items.map((i) => i[2] * i[4]));

const invA = Object.fromEntries(A_invoices.map((i) => [i.date, i]));
// purchases: [date, supplier, billNo, amount]
export const A_purchases = [
  ['2026-09-24', 'agarwal', '1187', invA['2026-09-24'].total],
  ['2026-09-26', 'mahalaxmi', '0841', 21150],
  ['2026-09-28', 'agarwal', '1215', 32875],
  ['2026-10-01', 'agarwal', '1243', invA['2026-10-01'].total],
  ['2026-10-03', 'mahalaxmi', '0864', invA['2026-10-03'].total],
  ['2026-10-05', 'agarwal', '1271', 31950],
  ['2026-10-08', 'agarwal', '1302', invA['2026-10-08'].total],
  ['2026-10-10', 'mahalaxmi', '0887', 0],
  ['2026-10-12', 'agarwal', '1329', 34050],
];
export const A_PURCHASE_TOTAL = 260000;
A_purchases[7][3] = A_PURCHASE_TOTAL - sum(A_purchases.map((p) => p[3]));
assert(A_purchases[7][3] > 15000 && A_purchases[7][3] < 26000, 'A balancing purchase ' + A_purchases[7][3]);
for (const p of A_purchases) {
  const w = dow(D(p[0]));
  assert(p[1] === 'agarwal' ? (w === 1 || w === 4) : w === 6, 'A purchase weekday ' + p[0]);
}

// other rows: [date, kind, text, amount]
export const A_other = [
  ['2026-09-23', 'udhar', 'उधार — रमेश (दूध, चावल)', 850],
  ['2026-09-24', 'exp', 'मज़दूरी (माल उतराई)', 300],
  ['2026-09-25', 'udhar', 'उधार — कमला बाई (तेल, दाल)', 1150],
  ['2026-09-28', 'exp', 'चाय-नाश्ता', 120],
  ['2026-09-29', 'repay', 'रमेश से वापस', 600],
  ['2026-09-30', 'udhar', 'उधार — सलीम (बिस्किट, साबुन)', 980],
  ['2026-10-01', 'exp', 'किराया — दुकान (अक्टूबर)', 12000],
  ['2026-10-02', 'udhar', 'उधार — रमेश (आटा, चीनी)', 1200],
  ['2026-10-03', 'exp', 'मज़दूरी (माल उतराई)', 300],
  ['2026-10-04', 'repay', 'कमला बाई से वापस', 500],
  ['2026-10-06', 'exp', 'बिजली बिल (सितंबर)', 5480],
  ['2026-10-07', 'udhar', 'उधार — गणेश (दूध, ब्रेड)', 760],
  ['2026-10-08', 'exp', 'मज़दूरी (माल उतराई)', 250],
  ['2026-10-09', 'repay', 'सलीम से वापस', 400],
  ['2026-10-10', 'exp', 'चाय', 90],
  ['2026-10-11', 'udhar', 'उधार — कमला बाई (चावल)', 1100],
];
export const A_credit = {
  given: sum(A_other.filter((o) => o[1] === 'udhar').map((o) => o[3])),
  repaid: sum(A_other.filter((o) => o[1] === 'repay').map((o) => o[3])),
};
A_credit.net = A_credit.given - A_credit.repaid;
assert(A_credit.net >= 4000 && A_credit.net <= 5000, 'A credit net');

const A_supName = { agarwal: 'अग्रवाल ट्रेडर्स', mahalaxmi: 'महालक्ष्मी डिस्ट्रीब्यूटर्स' };
export const A_rows = [];
A_days.forEach((d, i) => {
  const k = iso(d);
  A_rows.push({ date: k, text: 'बिक्री — नकद', amt: A_cash[i], kind: 'sale', strike: k === '2026-09-30' ? 5840 : null });
  for (const p of A_purchases.filter((p) => p[0] === k))
    A_rows.push({ date: k, text: `माल — ${A_supName[p[1]]} (बिल ${p[2]})`, amt: p[3], kind: 'purchase' });
  for (const o of A_other.filter((o) => o[0] === k)) A_rows.push({ date: k, text: o[2], amt: o[3], kind: o[1] });
});
export const A_pages = [
  { file: 'shopA/ledger-1.jpg', title: 'सितंबर 2026 — पेज 1', from: '2026-09-22', to: '2026-09-28' },
  { file: 'shopA/ledger-2.jpg', title: 'सितंबर–अक्टूबर 2026 — पेज 2', from: '2026-09-29', to: '2026-10-05' },
  { file: 'shopA/ledger-3.jpg', title: 'अक्टूबर 2026 — पेज 3', from: '2026-10-06', to: '2026-10-12' },
].map((p) => ({ ...p, rows: A_rows.filter((r) => r.date >= p.from && r.date <= p.to) }));
export const A_cashDays = A_days.map((d, i) => [iso(d), A_cash[i]]);

// UPI statement 13 Sep .. 12 Oct (30 days), avg 8250, weekends ~25% higher
export let A_upi;
{
  const r = rng(77);
  const days = range('2026-09-13', 30);
  const wk = 247500 / (21 + 9 * 1.25);
  A_upi = days.map((d) => {
    const we = dow(d) === 0 || dow(d) === 6;
    return { date: iso(d), we, amt: Math.round(((we ? wk * 1.25 : wk) * (1 + (r() - 0.5) * 0.12)) / 10) * 10 };
  });
  let diff = 247500 - sum(A_upi.map((x) => x.amt));
  const wd = A_upi.filter((x) => !x.we);
  for (let i = 0; diff !== 0; i = (i + 1) % wd.length) {
    const step = Math.sign(diff) * Math.min(Math.abs(diff), 40);
    wd[i].amt += step; diff -= step;
  }
  for (const x of A_upi) x.count = Math.max(38, Math.min(70, Math.round(x.amt / (150 + r() * 30))));
  assert(sum(A_upi.map((x) => x.amt)) === 247500, 'A upi sum');
}

export const A_elec = [
  { file: 'shopA/electricity-1.jpg', month: 'Jul 2026', period: '01-07-2026 to 31-07-2026', billDate: '05-08-2026', due: '19-08-2026', billNo: 'PPD/2607/0459812', prev: 18234, kwh: 412, total: 4870,
    lastPay: { amt: 4690, date: '15-07-2026', forMonth: 'Jun 2026', due: '17-07-2026' } },
  { file: 'shopA/electricity-2.jpg', month: 'Aug 2026', period: '01-08-2026 to 31-08-2026', billDate: '04-09-2026', due: '18-09-2026', billNo: 'PPD/2608/0461377', prev: 18646, kwh: 438, total: 5160,
    lastPay: { amt: 4870, date: '16-08-2026', forMonth: 'Jul 2026', due: '19-08-2026' } },
  { file: 'shopA/electricity-3.jpg', month: 'Sep 2026', period: '01-09-2026 to 30-09-2026', billDate: '05-10-2026', due: '19-10-2026', billNo: 'PPD/2609/0462904', prev: 19084, kwh: 465, total: 5480,
    lastPay: { amt: 5160, date: '14-09-2026', forMonth: 'Aug 2026', due: '18-09-2026' } },
];
for (const b of A_elec) {
  const r2 = (x) => Math.round(x * 100) / 100;
  b.fixed = 470;
  b.energy = r2(b.kwh * 8.2);
  b.wheeling = r2(b.kwh * 1.17);
  const base = r2(b.fixed + b.energy + b.wheeling);
  b.duty = r2(base * 0.12);
  b.fac = r2(b.total - base - b.duty);
  assert(b.fac > 0 && b.fac < 200, 'A fac');
}

/* ============================== SHOP B ============================== */
const B_days = range('2026-09-24', 18); // Thu 24 Sep .. Sun 11 Oct
const B_cash = [4520, 4780, 5120, 5240, 4310, 4450, 5180, 4870, 4690, 5060, 5210, 4160, 4380, 4140, 4410, 4650, 4980];
B_cash.push(4700 * 18 - sum(B_cash));
assert(sum(B_cash) === 84600 && B_cash.every((x) => x >= 4100 && x <= 5300), 'B cash');

// [description, qty, unit, unit price]
export const B_invoices = [
  { file: 'shopB/invoice-1.jpg', no: '004517', date: '2026-09-25', items: [
    ['Rice (Well-milled) 25 kg sack', 2, 'sack', 1250],
    ['Canned Sardines 155 g (case/100)', 2, 'case', 1980],
    ['Instant Noodles (case/72)', 3, 'case', 610],
    ['3-in-1 Coffee (pack/30)', 8, 'pack', 165],
    ['Cooking Oil 1 L', 24, 'btl', 98],
    ['Softdrinks 1.5 L (case/12)', 3, 'case', 780],
  ] },
  { file: 'shopB/invoice-2.jpg', no: '004602', date: '2026-10-02', items: [
    ['Rice (Well-milled) 25 kg sack', 3, 'sack', 1250],
    ['Canned Sardines 155 g (case/100)', 2, 'case', 1980],
    ['Instant Noodles (case/72)', 3, 'case', 610],
    ['3-in-1 Coffee (pack/30)', 10, 'pack', 165],
    ['Cooking Oil 1 L', 12, 'btl', 98],
    ['Softdrinks 1.5 L (case/12)', 3, 'case', 780],
  ] },
  { file: 'shopB/invoice-3.jpg', no: '004688', date: '2026-10-09', items: [
    ['Rice (Well-milled) 25 kg sack', 3, 'sack', 1280],
    ['Canned Sardines 155 g (case/100)', 2, 'case', 1980],
    ['Instant Noodles (case/72)', 4, 'case', 615],
    ['3-in-1 Coffee (pack/30)', 10, 'pack', 165],
    ['Cooking Oil 1 L', 12, 'btl', 98],
    ['Softdrinks 1.5 L (case/12)', 4, 'case', 780],
  ] },
];
for (const inv of B_invoices) for (const it of inv.items) it[1] = Math.round(it[1] * 1.4);
for (const inv of B_invoices) inv.total = sum(inv.items.map((i) => i[1] * i[3]));
const invB = Object.fromEntries(B_invoices.map((i) => [i.date, i]));
export const B_purchases = [
  ['2026-09-25', invB['2026-09-25'].total],
  ['2026-09-29', 20510],
  ['2026-10-02', invB['2026-10-02'].total],
  ['2026-10-06', 0],
  ['2026-10-09', invB['2026-10-09'].total],
];
export const B_PURCHASE_TOTAL = 104000;
B_purchases[3][1] = B_PURCHASE_TOTAL - sum(B_purchases.map((p) => p[1]));
assert(B_purchases[3][1] > 15000 && B_purchases[3][1] < 26000, 'B balancing purchase ' + B_purchases[3][1]);
for (const p of B_purchases) assert([2, 5].includes(dow(D(p[0]))), 'B purchase weekday');

export const B_other = [
  ['2026-09-26', 'utang', 'Utang — Aling Rosa (sardinas, bigas)', 385],
  ['2026-09-28', 'utang', 'Utang — Mang Ben (kape, asukal)', 460],
  ['2026-09-30', 'repay', 'Bayad utang — Mang Ben', 300],
  ['2026-10-01', 'utang', 'Utang — Tess (noodles, itlog)', 310],
  ['2026-10-04', 'repay', 'Bayad utang — Aling Rosa', 200],
  ['2026-10-05', 'utang', 'Utang — Aling Rosa (mantika, sabon)', 540],
  ['2026-10-08', 'utang', 'Utang — Kuya Jun (bigas 5 kg)', 475],
  ['2026-10-10', 'exp', 'Kuryente (Sept bill)', 2530],
];
export const B_credit = {
  given: sum(B_other.filter((o) => o[1] === 'utang').map((o) => o[3])),
  repaid: sum(B_other.filter((o) => o[1] === 'repay').map((o) => o[3])),
};
B_credit.net = B_credit.given - B_credit.repaid;
assert(B_credit.net >= 1500 && B_credit.net <= 2000, 'B credit net');

export const B_rows = [];
B_days.forEach((d, i) => {
  const k = iso(d);
  B_rows.push({ date: k, text: 'Benta (cash)', amt: B_cash[i], kind: 'sale', strike: k === '2026-10-03' ? 5600 : null });
  for (const p of B_purchases.filter((p) => p[0] === k))
    B_rows.push({ date: k, text: 'Bili — Balintawak Wholesale', amt: p[1], kind: 'purchase' });
  for (const o of B_other.filter((o) => o[0] === k)) B_rows.push({ date: k, text: o[2], amt: o[3], kind: o[1] });
});
export const B_pages = [
  { file: 'shopB/ledger-1.jpg', title: 'Sept – Oct 2026 · Page 1', from: '2026-09-24', to: '2026-10-02' },
  { file: 'shopB/ledger-2.jpg', title: 'Oct 2026 · Page 2', from: '2026-10-03', to: '2026-10-11' },
].map((p) => ({ ...p, rows: B_rows.filter((r) => r.date >= p.from && r.date <= p.to) }));
export const B_cashDays = B_days.map((d, i) => [iso(d), B_cash[i]]);

// PayLakbay wallet, 13 Sep .. 12 Oct, 5 screenshots x 6 days, genuine total 63,000 (avg 2,100/day)
export let B_walletDays;
{
  const r = rng(2026);
  const names = ['Juan D.', 'Maria S.', 'Jose R.', 'Ana L.', 'Mark T.', 'Liza P.', 'Carlo M.', 'Grace B.', 'Rodel A.', 'Joy C.',
    'Paolo V.', 'Kristine F.', 'Ramon G.', 'Tess Q.', 'Arnel B.', 'Mylene D.', 'Bong E.', 'Cherry N.', 'Dindo L.', 'Weng R.'];
  const days = range('2026-09-13', 30);
  const wk = 63000 / (21 + 9 * 1.15);
  const targets = days.map((d) => Math.round(((dow(d) % 6 === 0) ? wk * 1.15 : wk) * (1 + (r() - 0.5) * 0.14) / 5) * 5);
  let diff = 63000 - sum(targets);
  for (let i = 0; diff !== 0; i = (i + 1) % 30) { const s = Math.sign(diff) * Math.min(Math.abs(diff), 25); targets[i] += s; diff -= s; }
  B_walletDays = days.map((d, di) => {
    const T = targets[di];
    for (let n = T > 2150 ? 5 : 4; ; n = n === 4 ? 5 : 4) {
      for (let tries = 0; tries < 2000; tries++) {
        const a = Array.from({ length: n - 1 }, () => Math.round((40 + r() * 610) / 5) * 5);
        const last = T - sum(a);
        if (last >= 40 && last <= 650 && last % 5 === 0) {
          a.push(last);
          const times = a.map(() => 390 + Math.floor(r() * 900)).sort((x, y) => x - y);
          return { date: iso(d), total: T, rows: a.map((amt, j) => ({ amt, t: times[j], name: names[Math.floor(r() * names.length)] })) };
        }
      }
    }
  });
  assert(sum(B_walletDays.map((d) => d.total)) === 63000, 'B wallet');
}
export const B_walletOut = [
  { date: '2026-09-16', t: 1210, label: 'Cash out — Agent (Kamuning)', amt: 3000 },
  { date: '2026-09-22', t: 1145, label: 'Cash out — Agent (Kamuning)', amt: 2500 },
  { date: '2026-09-27', t: 1250, label: 'Cash out — Agent (Kamuning)', amt: 3000 },
  { date: '2026-10-03', t: 1180, label: 'Bills payment — Water', amt: 412 },
  { date: '2026-10-09', t: 1300, label: 'Cash out — Agent (Kamuning)', amt: 3500 },
];
export const B_tamper = { date: '2026-09-28', t: 854, name: 'J. Santos', amt: 48000 };
export const B_walletStart = 4812.5;
export const B_wallet = [0, 1, 2, 3, 4].map((k) => ({ file: `shopB/wallet-${k + 1}.jpg`, days: B_walletDays.slice(k * 6, k * 6 + 6) }));
{
  let bal = B_walletStart;
  for (const s of B_wallet) {
    const from = s.days[0].date, to = s.days[5].date;
    s.out = B_walletOut.filter((o) => o.date >= from && o.date <= to);
    s.incoming = sum(s.days.map((d) => d.total));
    bal = bal + s.incoming - sum(s.out.map((o) => o.amt));
    s.trueBalance = bal;
    s.tampered = B_tamper.date >= from && B_tamper.date <= to;
    s.shownBalance = s.tampered ? bal + B_tamper.amt : bal;
  }
  assert(B_wallet[2].tampered && B_wallet.filter((s) => s.tampered).length === 1, 'tamper in wallet-3');
}

export const B_elec = [
  { file: 'shopB/electricity-1.jpg', month: 'July 2026', period: 'Jul 01 – Jul 31, 2026', billDate: 'Aug 05, 2026', due: 'Aug 19, 2026', billNo: 'MLP-2607-118703', prev: 7720, kwh: 188, total: 2290,
    lastPay: { amt: 2180, date: 'Jul 16, 2026', forMonth: 'June 2026', due: 'Jul 20, 2026' } },
  { file: 'shopB/electricity-2.jpg', month: 'August 2026', period: 'Aug 01 – Aug 31, 2026', billDate: 'Sep 04, 2026', due: 'Sep 18, 2026', billNo: 'MLP-2608-118703', prev: 7908, kwh: 195, total: 2410,
    lastPay: { amt: 2290, date: 'Aug 17, 2026', forMonth: 'July 2026', due: 'Aug 19, 2026' } },
  { file: 'shopB/electricity-3.jpg', month: 'September 2026', period: 'Sep 01 – Sep 30, 2026', billDate: 'Oct 05, 2026', due: 'Oct 19, 2026', billNo: 'MLP-2609-118703', prev: 8103, kwh: 203, total: 2530,
    lastPay: { amt: 2410, date: 'Sep 24, 2026', forMonth: 'August 2026', due: 'Sep 18, 2026', late: 6 }, paidStamp: 'OCT 10 2026' },
];
for (const b of B_elec) {
  const r2 = (x) => Math.round(x * 100) / 100;
  b.lines = [
    ['Generation Charge', `${b.kwh} kWh × 6.8500`, r2(b.kwh * 6.85)],
    ['Transmission Charge', `${b.kwh} kWh × 0.9800`, r2(b.kwh * 0.98)],
    ['System Loss Charge', `${b.kwh} kWh × 0.6200`, r2(b.kwh * 0.62)],
    ['Distribution Charge', `${b.kwh} kWh × 1.4500`, r2(b.kwh * 1.45)],
    ['Supply & Metering Charges', 'fixed', 21.38],
  ];
  const sub = r2(sum(b.lines.map((l) => l[2])));
  b.vat = r2(sub * 0.12);
  b.universal = r2(b.total - sub - b.vat);
  assert(b.universal > 0 && b.universal < 300, 'B universal');
}

/* ============================== SHOP C ============================== */
// Verma Kirana & Dairy, Indore. Same structure as shop A; the owner adds identity and registration by hand.
const C_days = range('2026-09-22', 21); // Tue 22 Sep .. Mon 12 Oct
const C_cash = [4180, 4320, 4050, 4610, 4980, 5060, 3920, 4010, 4260, 3880, 4470, 4890, 4930, 4090,
  3960, 4230, 4150, 4580, 4910, 5040];
C_cash.push(4400 * 21 - sum(C_cash));
assert(C_cash.length === 21 && sum(C_cash) === 92400, 'C cash sum');
assert(C_cash.every((x) => x >= 3800 && x <= 5200), 'C cash range ' + C_cash.at(-1));

export const C_invoices = [
  {
    file: 'shopC/invoice-1.jpg', supplier: 'jain', no: 'JPS/26-27/0412', date: '2026-09-24',
    items: [
      ['Wheat Atta 10 kg', '1101', 10, 'Bag', 410],
      ['Rice (Kolam) 25 kg bag', '1006', 4, 'Bag', 1340],
      ['Chana Dal (loose)', '0713', 25, 'Kg', 94],
      ['Sugar (S-30)', '1701', 50, 'Kg', 43],
      ['Soyabean Oil 1 L pouch', '1507', 30, 'Pcs', 132],
      ['Poha 1 kg', '1904', 20, 'Pcs', 54],
      ['Tea CTC (loose)', '0902', 4, 'Kg', 285],
    ],
  },
  {
    file: 'shopC/invoice-2.jpg', supplier: 'malwa', no: 'MDA/2026/1876', date: '2026-10-03',
    items: [
      ['Toned Milk 500 ml (crate of 24)', '0401', 18, 'Crate', 312],
      ['Curd 400 g cup', '0403', 60, 'Pcs', 34],
      ['Paneer 200 g', '0406', 40, 'Pcs', 88],
      ['Butter 100 g', '0405', 30, 'Pcs', 56],
      ['Desi Ghee 1 L', '0405', 8, 'Pcs', 610],
    ],
  },
  {
    file: 'shopC/invoice-3.jpg', supplier: 'jain', no: 'JPS/26-27/0468', date: '2026-10-08',
    items: [
      ['Wheat Atta 10 kg', '1101', 10, 'Bag', 410],
      ['Basmati Rice 5 kg', '1006', 6, 'Bag', 515],
      ['Toor Dal (loose)', '0713', 25, 'Kg', 140],
      ['Sugar (S-30)', '1701', 50, 'Kg', 43],
      ['Soyabean Oil 1 L pouch', '1507', 24, 'Pcs', 132],
      ['Glucose Biscuits (ctn of 48)', '1905', 4, 'Ctn', 470],
    ],
  },
];
for (const inv of C_invoices) inv.total = sum(inv.items.map((i) => i[2] * i[4]));
const invC = Object.fromEntries(C_invoices.map((i) => [i.date, i]));
export const C_purchases = [
  ['2026-09-24', 'jain', '0412', invC['2026-09-24'].total],
  ['2026-09-26', 'malwa', '1851', 12880],
  ['2026-09-28', 'jain', '0427', 19650],
  ['2026-10-01', 'jain', '0441', 18920],
  ['2026-10-03', 'malwa', '1876', invC['2026-10-03'].total],
  ['2026-10-05', 'jain', '0453', 17460],
  ['2026-10-08', 'jain', '0468', invC['2026-10-08'].total],
  ['2026-10-10', 'malwa', '1902', 0],
  ['2026-10-12', 'jain', '0481', 18210],
];
export const C_PURCHASE_TOTAL = 160000;
C_purchases[7][3] = C_PURCHASE_TOTAL - sum(C_purchases.map((p) => p[3]));
assert(C_purchases[7][3] > 9000 && C_purchases[7][3] < 20000, 'C balancing purchase ' + C_purchases[7][3]);
for (const p of C_purchases) {
  const w = dow(D(p[0]));
  assert(p[1] === 'jain' ? (w === 1 || w === 4) : w === 6, 'C purchase weekday ' + p[0]);
}
export const C_other = [
  ['2026-09-23', 'udhar', 'उधार — सुरेश (दूध, ब्रेड)', 640],
  ['2026-09-25', 'exp', 'मज़दूरी (माल उतराई)', 250],
  ['2026-09-26', 'udhar', 'उधार — शांति बाई (आटा, तेल)', 920],
  ['2026-09-29', 'repay', 'सुरेश से वापस', 400],
  ['2026-10-01', 'exp', 'किराया — दुकान (अक्टूबर)', 9000],
  ['2026-10-02', 'udhar', 'उधार — इरफ़ान (दूध, पनीर)', 760],
  ['2026-10-04', 'exp', 'चाय-नाश्ता', 110],
  ['2026-10-06', 'exp', 'बिजली बिल (सितंबर)', 6630],
  ['2026-10-07', 'repay', 'शांति बाई से वापस', 500],
  ['2026-10-09', 'udhar', 'उधार — सुरेश (दही, ब्रेड)', 580],
  ['2026-10-10', 'exp', 'मज़दूरी (माल उतराई)', 250],
  ['2026-10-11', 'repay', 'इरफ़ान से वापस', 300],
];
export const C_credit = {
  given: sum(C_other.filter((o) => o[1] === 'udhar').map((o) => o[3])),
  repaid: sum(C_other.filter((o) => o[1] === 'repay').map((o) => o[3])),
};
C_credit.net = C_credit.given - C_credit.repaid;
assert(C_credit.net >= 1500 && C_credit.net <= 2500, 'C credit net ' + C_credit.net);
const C_supName = { jain: 'जैन प्रोविज़न स्टोर्स', malwa: 'मालवा डेयरी एजेंसी' };
export const C_rows = [];
C_days.forEach((d, i) => {
  const k = iso(d);
  C_rows.push({ date: k, text: 'बिक्री — नकद', amt: C_cash[i], kind: 'sale', strike: k === '2026-10-06' ? 4510 : null });
  for (const p of C_purchases.filter((p) => p[0] === k))
    C_rows.push({ date: k, text: `माल — ${C_supName[p[1]]} (बिल ${p[2]})`, amt: p[3], kind: 'purchase' });
  for (const o of C_other.filter((o) => o[0] === k)) C_rows.push({ date: k, text: o[2], amt: o[3], kind: o[1] });
});
export const C_pages = [
  { file: 'shopC/ledger-1.jpg', title: 'सितंबर 2026 — पन्ना 1', from: '2026-09-22', to: '2026-09-28' },
  { file: 'shopC/ledger-2.jpg', title: 'सितंबर–अक्टूबर 2026 — पन्ना 2', from: '2026-09-29', to: '2026-10-05' },
  { file: 'shopC/ledger-3.jpg', title: 'अक्टूबर 2026 — पन्ना 3', from: '2026-10-06', to: '2026-10-12' },
].map((p) => ({ ...p, rows: C_rows.filter((r) => r.date >= p.from && r.date <= p.to) }));
export const C_cashDays = C_days.map((d, i) => [iso(d), C_cash[i]]);

// UPI statement 13 Sep .. 12 Oct (30 days), avg 5,400, weekends ~20% higher
export let C_upi;
{
  const r = rng(91);
  const days = range('2026-09-13', 30);
  const wk = 162000 / (21 + 9 * 1.2);
  C_upi = days.map((d) => {
    const we = dow(d) === 0 || dow(d) === 6;
    return { date: iso(d), we, amt: Math.round(((we ? wk * 1.2 : wk) * (1 + (r() - 0.5) * 0.12)) / 10) * 10 };
  });
  let diff = 162000 - sum(C_upi.map((x) => x.amt));
  const wd = C_upi.filter((x) => !x.we);
  for (let i = 0; diff !== 0; i = (i + 1) % wd.length) {
    const step = Math.sign(diff) * Math.min(Math.abs(diff), 40);
    wd[i].amt += step; diff -= step;
  }
  for (const x of C_upi) x.count = Math.max(30, Math.min(60, Math.round(x.amt / (130 + r() * 30))));
  assert(sum(C_upi.map((x) => x.amt)) === 162000, 'C upi sum');
}

export const C_elec = [
  { file: 'shopC/electricity-1.jpg', month: 'Jul 2026', period: '01-07-2026 to 31-07-2026', billDate: '06-08-2026', due: '20-08-2026', billNo: 'MPD/2607/2208134', prev: 30412, kwh: 528, total: 6170,
    lastPay: { amt: 6020, date: '14-07-2026', forMonth: 'Jun 2026', due: '18-07-2026' } },
  { file: 'shopC/electricity-2.jpg', month: 'Aug 2026', period: '01-08-2026 to 31-08-2026', billDate: '05-09-2026', due: '19-09-2026', billNo: 'MPD/2608/2210457', prev: 30940, kwh: 551, total: 6410,
    lastPay: { amt: 6170, date: '17-08-2026', forMonth: 'Jul 2026', due: '20-08-2026' } },
  { file: 'shopC/electricity-3.jpg', month: 'Sep 2026', period: '01-09-2026 to 30-09-2026', billDate: '06-10-2026', due: '20-10-2026', billNo: 'MPD/2609/2212981', prev: 31491, kwh: 572, total: 6630,
    lastPay: { amt: 6410, date: '15-09-2026', forMonth: 'Aug 2026', due: '19-09-2026' } },
];
for (const b of C_elec) {
  const r2 = (x) => Math.round(x * 100) / 100;
  b.fixed = 470;
  b.energy = r2(b.kwh * 8.2);
  b.wheeling = r2(b.kwh * 1.17);
  const base = r2(b.fixed + b.energy + b.wheeling);
  b.duty = r2(base * 0.12);
  b.fac = r2(b.total - base - b.duty);
  assert(b.fac > 0 && b.fac < 200, 'C fac ' + b.fac)
}
