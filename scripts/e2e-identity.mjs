// End-to-end test of identity verification against the local dev server and Firebase emulators.
// Usage: npm run emulators & npm run seed:emulators & npx vite --port 5175 ; node scripts/e2e-identity.mjs [outDir]
import { mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import QRCode from 'qrcode'
import puppeteer from 'puppeteer-core'

const BASE = process.env.KOSHA_URL ?? 'http://localhost:5175'
const out = process.argv[2] ?? 'e2e-shots/identity'
await mkdir(out, { recursive: true })
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1440, height: 1000 }, protocolTimeout: 600000 })
const results = []
const errors = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  · ${detail}` : ''}`)
}
const stamp = Date.now().toString().slice(-6)
// a fresh PAN for every run (4th letter P = individual, 5th = S for Sharma) and a GSTIN built from it
const CP = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const checkChar = (f) => { let k = 2, sum = 0; for (let i = f.length - 1; i >= 0; i--) { const d = k * CP.indexOf(f[i]); k = k === 2 ? 1 : 2; sum += Math.floor(d / 36) + (d % 36) } return CP[(36 - (sum % 36)) % 36] }
const PAN = `ABCPS${stamp.slice(-4)}K`
const GSTIN = `27${PAN}1Z${checkChar(`27${PAN}1Z`)}`
const PAN_MASKED = `${PAN.slice(0, 5)}****${PAN.slice(9)}`

async function newPage() {
  const ctx = await browser.createBrowserContext()
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
  await p.evaluateOnNewDocument(() => { try { sessionStorage.setItem('kosha-intro-seen', '1') } catch {} })
  return p
}
const text = (p) => p.evaluate(() => document.body.innerText)
async function demo(p, label) {
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await p.waitForFunction(() => document.body.innerText.includes('Admin demo'))
  await p.evaluate((l) => [...document.querySelectorAll('button')].find((x) => x.textContent.includes(l)).click(), label)
  await p.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })
}
async function signupShop(p, name, shop) {
  await p.goto(`${BASE}/login?mode=signup`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('#org')
  for (const [id, v] of [['name', name], ['org', shop], ['email', `${name.split(' ')[0].toLowerCase()}.${stamp}@shop.test`], ['password', 'password123']]) await p.type(`#${id}`, v)
  await p.evaluate(() => document.querySelector('#org').closest('form').requestSubmit())
  await p.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })
}
/** Loads Sunita's sample documents through the app's own store, but as a real (non-sample) shop. */
async function realShopFromSample(p, identity, keepIdDocs = false) {
  await p.goto(`${BASE}/build`, { waitUntil: 'networkidle2' })
  await p.evaluate(async (identity, keepIdDocs) => {
    const useKosha = window.__kosha
    const m = await (await fetch('/samples/manifest.json')).json()
    const x = m.shops[0]
    const s = { id: x.id, docs: x.docs, interview: x.interview, profile: { shopName: x.shopName, ownerName: x.ownerName, address: x.address, shopType: x.shopType, since: x.since, country: x.country, language: x.language, currency: x.currency } }
    await useKosha.getState().loadSample(s)
    useKosha.setState({ sampleId: null })
    if (!keepIdDocs) { useKosha.getState().setFiles('identity', []); useKosha.getState().setFiles('business', []) }
    useKosha.getState().setIdInput(identity)
  }, identity, keepIdDocs)
  await waitDocs(p, ['ledger', 'invoice', 'payments', 'electricity'])
}
async function issue(p) {
  // go to the last step and press the real button, as a shop owner would
  await p.evaluate(() => [...document.querySelectorAll('nav[aria-label=Steps] button')].at(-1).click())
  await p.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Build the credit passport') && !b.disabled), { timeout: 240000, polling: 500 })
  await sleep(500)
  await p.evaluate(() => { window.__kosha.setState({ agreed: true }); [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Build the credit passport')).click() })
  for (let i = 0; i < 240; i++) {
    await sleep(1000)
    const r = await p.evaluate(() => { const st = window.__kosha.getState(); const a = st.assessment; return a ? { id: a.id, status: a.offer.status, score: a.score, identity: a.identity, checks: a.checks.filter((c) => c.id.startsWith('id_')).map((c) => [c.id, c.status, c.finding]) } : st.assessStatus === 'error' ? { error: st.assessError } : null })
    if (r) return r
  }
  return { error: 'timed out' }
}
/** Polls the app's own store until every listed document has finished reading. */
async function waitDocs(p, kinds, timeout = 240000) {
  const t0 = Date.now()
  for (;;) {
    const st = await p.evaluate(async (kinds) => { const useKosha = window.__kosha; const d = useKosha.getState().docs; return kinds.map((k) => d[k].status) }, kinds).catch(() => [])
    if (st.length && st.every((x) => x === 'done' || x === 'error')) return st
    if (Date.now() - t0 > timeout) throw new Error(`documents not read: ${kinds.map((k, i) => `${k}=${st[i]}`).join(' ')}`)
    await sleep(1000)
  }
}
const idc = (a, id) => a.checks?.find((c) => c[0] === id)?.[1]

console.log('starting')
// ─── 1. Sample shop: identity read from the specimen PAN, GST and Udyam
let samplePassport
{
  const p = await newPage()
  await p.goto(BASE, { waitUntil: 'networkidle2' })
  await p.waitForSelector('#samples button')
  await p.evaluate(() => document.querySelectorAll('#samples button')[0].click())
  await waitDocs(p, ['identity', 'business', 'ledger'])
  await p.evaluate(() => [...document.querySelectorAll('nav[aria-label=Steps] button')][0].click()); await sleep(2500)
  await p.screenshot({ path: `${out}/01-identity-step.png`, fullPage: true })
  const t = await text(p)
  check('Sample: identity step reads the PAN card', t.includes('ABCPS****F') || t.includes('ABCPS1234F'))
  check('Sample: GST and Udyam certificates read', t.includes('GST certificate') && t.includes('Udyam certificate'))
  check('Sample: live check shows the same person', t.includes("The owner's identity is consistent"))
  // answer the five interview questions with the sample's own answers, as the full walkthrough does
  await p.evaluate(async () => { const st = window.__kosha.getState(); await Promise.all(Object.entries(st.sampleAnswers).map(([id, text]) => st.answer(id, { text }))) })
  const a = await issue(p)
  samplePassport = a.id
  check('Sample: passport issued with the same result as before', a.status === 'offer' && a.score === 794, `${a.id} · score ${a.score} · ${a.status}`)
  check('Sample: identity level = read from document', a.identity?.person === 'document' && a.identity?.business === 'document')
  check('Sample: identity checks pass', idc(a, 'id_person') === 'pass' && idc(a, 'id_business') === 'pass', a.checks.map((c) => `${c[0]}=${c[1]}`).join(' '))
  await p.goto(`${BASE}/passport/${a.id}`, { waitUntil: 'networkidle2' }); await sleep(3000)
  await p.evaluate(() => [...document.querySelectorAll('.eyebrow')].find((e) => /verified identity/i.test(e.textContent))?.scrollIntoView({ block: 'center' })); await sleep(800)
  await p.screenshot({ path: `${out}/02-passport-identity.png` })
  // public view of the same passport: levels only, never numbers
  const q = await newPage()
  await q.goto(`${BASE}/passport/${a.id}`, { waitUntil: 'networkidle2' }); await sleep(3000)
  const pt = await text(q)
  check('Public QR page shows the identity level', /Read from document/.test(pt))
  check('Public QR page never shows the PAN or GSTIN', !pt.includes('ABCPS') && !pt.includes('27ABCPS'))
  await q.screenshot({ path: `${out}/03-public.png` })
}

// ─── 2. A real shop that types its PAN and GSTIN: self-declared, claims the PAN
let firstId
{
  const p = await newPage()
  await signupShop(p, 'Kavita Sharma', 'Kavita Kirana')
  await realShopFromSample(p, { pan: PAN, gstin: GSTIN, dob: '1984-03-12' })
  const a = await issue(p)
  firstId = a.id
  check('Real shop: typed PAN + valid GSTIN → passport issued', !!a.id, `${a.id} · ${a.status}`)
  check('Real shop: PAN claimed for this shop (one identity, one shop)', idc(a, 'id_unique') === 'pass' && a.identity?.claim === 'new')
  check('Real shop: typed numbers count as self-declared', a.identity?.person === 'self' && a.identity?.business === 'self')
}

// ─── 3. A second shop reusing the same PAN → held
{
  const p = await newPage()
  await signupShop(p, 'Sunil Sharma', 'Sunil Stores')
  await realShopFromSample(p, { pan: PAN })
  const a = await issue(p)
  check('Duplicate PAN: second shop is caught', idc(a, 'id_unique') === 'fail', a.checks.find((c) => c[0] === 'id_unique')?.[2])
  check('Duplicate PAN: offer is held', a.status === 'hold')
  await p.goto(`${BASE}/passport/${a.id}`, { waitUntil: 'networkidle2' }); await sleep(3000)
  await p.evaluate(() => [...document.querySelectorAll('*')].find((e) => e.children.length < 3 && /One identity, one shop/.test(e.textContent))?.scrollIntoView({ block: 'center' })); await sleep(800)
  await p.screenshot({ path: `${out}/04-duplicate-pan.png` })
}

// ─── 4. Wrong GSTIN, and a specimen card on a real shop → held
{
  const p = await newPage()
  await signupShop(p, 'Meena Sharma', 'Meena Mart')
  await realShopFromSample(p, { gstin: '27ABCPS1234F1ZY' }, true)
  const a = await issue(p)
  check('Typo in GSTIN is caught', idc(a, 'id_business') === 'fail', a.checks.find((c) => c[0] === 'id_business')?.[2]?.slice(0, 120))
  check('Specimen ID card on a real shop is refused', idc(a, 'id_person') === 'fail', a.checks.find((c) => c[0] === 'id_person')?.[2]?.slice(0, 120))
  check('Identity failure holds the offer', a.status === 'hold')
}

// ─── 5. Aadhaar Secure QR scanned from a photo (synthetic, unsigned: must NOT count as govt-signed)
{
  const fields = ['V2', '2', '9876' + '20260101123000123', 'Kavita Sharma', '12-03-1984', 'F', 'W/O Raj Sharma', 'Pune', '', 'Shop 4', 'Kothrud', '411038', 'Kothrud', 'Maharashtra', 'Karve Road', 'Haveli', 'Pune']
  const bytes = []
  for (const f of fields) bytes.push(...Buffer.from(f, 'utf8'), 255)
  bytes.push(...new Array(300).fill(7), ...new Array(32).fill(9), ...new Array(256).fill(1))
  const digits = BigInt('0x' + gzipSync(Buffer.from(bytes)).toString('hex')).toString()
  await QRCode.toFile(`${out}/synthetic-aadhaar-qr.png`, digits, { errorCorrectionLevel: 'L', width: 1400, margin: 4 })
  const p = await newPage()
  await demo(p, 'Shop owner demo')
  await p.goto(`${BASE}/build`, { waitUntil: 'networkidle2' }); await sleep(1500)
  const input = await p.$('input[type=file][accept="image/*"]')
  await input.uploadFile(`${out}/synthetic-aadhaar-qr.png`)
  await p.waitForFunction(() => /•••• •••• 9876|not a|could not|No QR/i.test(document.body.innerText), { timeout: 30000 }).catch(() => {})
  await sleep(1000)
  const t = await text(p)
  check('Aadhaar QR is decoded from a photo', t.includes('•••• •••• 9876') && t.includes('Kavita Sharma'))
  check('Unsigned QR is NOT treated as govt-signed', t.includes('could not confirm') && !/Signature verified/.test(t))
  await p.screenshot({ path: `${out}/05-aadhaar-qr.png` })
}

// ─── 6. Lender: identity column, filters, ask for documents, KYC summary
let lenderPassport
{
  const p = await newPage()
  await demo(p, 'Lender demo')
  await p.goto(`${BASE}/lender`, { waitUntil: 'networkidle2' }); await sleep(3000)
  const t = await text(p)
  check('Lender queue has an Identity column', /IDENTITY/i.test(t) && /Read from document|Self-declared/.test(t))
  await p.screenshot({ path: `${out}/06-lender-queue.png` })
  const before = await p.$$eval('tbody tr', (r) => r.length)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Registered business')).click()); await sleep(800)
  const after = await p.$$eval('tbody tr', (r) => r.length)
  check('"Registered business" filter narrows the queue', after > 0 && after < before, `${before} → ${after} rows`)
  // the public demo lender is sandboxed: a real shop's passport opens only as its public record
  await p.goto(`${BASE}/passport/${firstId}`, { waitUntil: 'networkidle2' }); await sleep(3000)
  const rt = await text(p)
  check("Demo lender cannot open a real shop's full passport", rt.includes('This is the public record') && !rt.includes('Do the sources agree?'))
  check('Demo lender queue lists only demo passports', !t.includes(firstId), `real passport ${firstId} not in the queue`)
  lenderPassport = samplePassport
  await p.goto(`${BASE}/passport/${lenderPassport}`, { waitUntil: 'networkidle2' }); await sleep(3000)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Ask for documents')).click()); await sleep(500)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim().endsWith('Latest electricity bill'))?.click()); await sleep(300)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim().endsWith('GST, Udyam or shop licence'))?.click()); await sleep(300)
  await p.evaluate(() => document.querySelector('#decision-note')?.closest('.edge-gold')?.scrollIntoView({ block: 'start' })); await sleep(500)
  await p.screenshot({ path: `${out}/07-ask-documents.png` })
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Send decision|Update decision/.test(x.textContent)).click())
  await p.waitForFunction(() => document.body.innerText.includes('Sent.'), { timeout: 20000 }).catch(() => {})
  check('Lender sends "ask for documents" with a checklist', (await text(p)).includes('Sent.'))
  await p.goto(`${BASE}/passport/${lenderPassport}/kyc`, { waitUntil: 'networkidle2' }); await sleep(2500)
  const k = await text(p)
  check('KYC summary renders for the lender', /KYC & credit summary/i.test(k) && /Identity and registration/i.test(k) && k.includes('ABCPS****F'))
  // a GSTIN contains its owner's PAN by design (public registry data); outside it, the PAN never appears
  check('KYC summary never shows the full PAN', !k.replaceAll('27ABCPS1234F1ZX', '').includes('ABCPS1234F'))
  await p.screenshot({ path: `${out}/08-kyc.png`, fullPage: true })
}

// ─── 7. The shop sees the checklist
{
  const p = await newPage()
  await demo(p, 'Shop owner demo')
  await p.goto(`${BASE}/passport/${lenderPassport}`, { waitUntil: 'networkidle2' }); await sleep(3000)
  const t = await text(p)
  check('Shop sees exactly what the lender asked for', t.includes('To add') && t.includes('Latest electricity bill') && t.includes('Update my passport'))
  await p.evaluate(() => [...document.querySelectorAll('div')].find((e) => e.textContent.trim() === 'To add')?.scrollIntoView({ block: 'center' })); await sleep(600)
  await p.screenshot({ path: `${out}/09-shop-checklist.png` })
}

// ─── 8. Lender sign-up needs a registration number; admin sees it; shops see "Regulated"
{
  const p = await newPage()
  await p.goto(`${BASE}/login?mode=signup&role=lender`, { waitUntil: 'networkidle2' })
  await p.waitForSelector('#regNo')
  for (const [id, v] of [['name', 'Ayu Pratiwi'], ['org', 'Bandung Digital Bank'], ['email', `ayu.${stamp}@bandungbank.test`], ['password', 'password123']]) await p.type(`#${id}`, v)
  await p.evaluate(() => document.querySelector('#org').closest('form').requestSubmit()); await sleep(1500)
  check('Lender sign-up without a registration number is refused', (await text(p)).includes('registration or licence number'))
  await p.type('#regNo', 'N-13.02345')
  await p.evaluate(() => document.querySelector('#org').closest('form').requestSubmit())
  await p.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })
  const a = await newPage()
  await demo(a, 'Admin demo')
  await a.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' }); await sleep(2500)
  const t = await text(a)
  check('Admin sees lender type and registration number', t.includes('Reg. N-13.02345') && t.includes('NBFC'))
  check('Admin sees a work-email check', /work email matches|check domain|personal email/.test(t))
  await a.screenshot({ path: `${out}/10-admin.png` })
  await a.evaluate(() => { const tr = [...document.querySelectorAll('tr')].find((x) => x.textContent.includes('Bandung Digital Bank')); [...tr.querySelectorAll('button')].find((b) => b.textContent.includes('Approve')).click() }); await sleep(700)
  await a.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Verify organisation') && x.getBoundingClientRect().width > 0).click())
  await a.waitForFunction(() => [...document.querySelectorAll('tr')].find((x) => x.textContent.includes('Bandung'))?.textContent.includes('Verified'), { timeout: 20000 }).catch(() => {})
  await a.evaluate(() => [...document.querySelectorAll('button[role=tab]')].find((x) => x.textContent.includes('Audit log')).click()); await sleep(2000)
  const demoLog = await text(a)
  check("Demo admin's audit log shows no real shop's activity", !demoLog.includes('Sunil Stores') && !demoLog.includes('Kavita Kirana'))
  // the real admin (a private account, never on the sign-in page) sees the real shops' identity alert
  if (process.env.KOSHA_ADMIN_EMAIL) {
    const r = await newPage()
    await r.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
    await r.type('#email', process.env.KOSHA_ADMIN_EMAIL); await r.type('#password', process.env.KOSHA_ADMIN_PASSWORD)
    await r.evaluate(() => document.querySelector('#email').closest('form').requestSubmit())
    await r.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })
    await r.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' }); await sleep(2000)
    await r.evaluate(() => [...document.querySelectorAll('button[role=tab]')].find((x) => x.textContent.includes('Audit log')).click()); await sleep(2500)
    const rl = await text(r)
    check('Real admin sees the duplicate-PAN identity alert', rl.includes('Sunil Stores') && /Identity alert/.test(rl))
    await r.screenshot({ path: `${out}/11-audit.png` })
  }
  const s = await newPage()
  await demo(s, 'Shop owner demo')
  await s.goto(`${BASE}/passport/KSH-IN-8BE504`, { waitUntil: 'networkidle2' }); await sleep(2500)
  await s.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Manage sharing'))?.click()); await sleep(800)
  await s.evaluate(() => [...document.querySelectorAll('button, label')].find((x) => /lenders I choose|Only lenders/i.test(x.textContent))?.click()); await sleep(1500)
  const st = await text(s)
  check('Shops see which lenders are regulated', st.includes('Regulated') && st.includes('Bandung Digital Bank'))
  await s.screenshot({ path: `${out}/12-regulated-lenders.png` })
}

const summary = { passed: results.filter((r) => r.ok).length, total: results.length, errors, results }
await writeFile(`${out}/results.json`, JSON.stringify(summary, null, 2))
console.log(`\n${summary.passed}/${summary.total} passed · console errors: ${errors.length ? errors.slice(0, 5).join(' | ') : 'none'}`)
await browser.close()
process.exit(summary.passed === summary.total ? 0 : 1)
