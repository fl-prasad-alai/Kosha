// End-to-end walkthrough of the third sample shop (Verma Kirana & Dairy), where the owner adds his identity by hand.
// Usage: node scripts/e2e-shopc.mjs [outDir]   (KOSHA_BAKE=1 also saves Gemini's results into cache/)
import { mkdir, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const BASE = process.env.KOSHA_URL ?? 'http://localhost:5175'
const out = process.argv[2] ?? 'e2e-shots/shopc'
await mkdir(out, { recursive: true })
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1440, height: 1000 }, protocolTimeout: 600000 })
const p = await browser.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); if (/\[gemini\].*failed/.test(m.text())) console.log('   ', m.text().slice(0, 140)) })
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  · ${detail}` : ''}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const text = () => p.evaluate(() => document.body.innerText)
const st = (fn) => p.evaluate(fn)
const idle = async (timeout = 240000) => {
  const t0 = Date.now()
  for (;;) {
    const busy = await st(() => { const s = window.__kosha.getState(); return Object.values(s.pending).some((x) => x?.status === 'reading') || Object.values(s.docs).some((d) => d.status === 'reading') || s.location.status === 'reading' || s.qr.status === 'reading' })
    if (!busy) return
    if (Date.now() - t0 > timeout) throw new Error('still reading')
    await sleep(800)
  }
}
const click = (label, sel = 'button') => p.evaluate((l, s) => { const b = [...document.querySelectorAll(s)].find((x) => x.textContent?.trim().includes(l) && !x.disabled); b?.click(); return !!b }, label, sel)
// the sample helper's buttons, matched exactly
const sampleDoc = (label) => p.evaluate((l) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === l); b?.click(); return !!b }, label)

await p.evaluateOnNewDocument(() => { try { sessionStorage.setItem('kosha-intro-seen', '1') } catch {} })
await p.goto(BASE, { waitUntil: 'networkidle2' })
await p.waitForSelector('#samples button')
const cards = await p.$$eval('#samples button', (b) => b.map((x) => x.textContent))
check('Landing shows the third sample shop', cards.some((c) => c.includes('Verma Kirana')) && cards.some((c) => c.includes('Add ID yourself')))
await p.evaluate(() => [...document.querySelectorAll('#samples button')].find((x) => x.textContent.includes('Verma Kirana')).click())
await p.waitForFunction(() => location.pathname === '/build', { timeout: 30000 })
await sleep(1500)
let t = await text()
check('Walkthrough starts at "Who you are"', t.includes('Show who runs the shop'))
check('No error shown before anything is uploaded', !/Add at least one photo|went wrong|Try again/i.test(t))
check('Sample helper offers his documents', t.includes("Try the uploads with Ramesh's documents"))
await p.screenshot({ path: `${out}/01-start.png` })

// a wrong document first
await sampleDoc('a wrong document')
// (when the result is already cached it is instant, so the reading note may never show)
const sawReading = await p.waitForFunction(() => document.body.innerText.includes('Reading your PAN card'), { timeout: 3000, polling: 50 }).then(() => true).catch(() => false)
check('While reading: a reading note, no preview', sawReading || !(await p.$('img[alt^="Page"]')), sawReading ? 'reading note shown' : 'result was cached (instant)')
await idle(); await sleep(500)
t = await text()
check('A wrong document is refused with a clear reason', /not a PAN card|doesn't look like a PAN card/.test(t), (await st(() => window.__kosha.getState().pending.identity?.message)) ?? '')
check('…and nothing is kept', (await st(() => window.__kosha.getState().docs.identity.files.length)) === 0)
await p.screenshot({ path: `${out}/02-wrong-doc.png` })

// the right documents
await sampleDoc('PAN card'); await idle(); await sleep(500)
t = await text()
check('PAN card accepted and masked', t.includes('ABCPV****Q'))
await sampleDoc('Aadhaar card'); await idle()
await p.waitForFunction(() => document.body.innerText.includes('•••• •••• 7712'), { timeout: 20000 }).catch(() => {})
t = await text()
check('Aadhaar card accepted, only the last 4 digits kept', t.includes('•••• •••• 7712') && !/9876\s?5432\s?7712/.test(t + JSON.stringify(await st(() => window.__kosha.getState().docs.identity.result))))
await sampleDoc('Udyam Assist certificate'); await idle(); await sleep(500)
t = await text()
check('Udyam Assist certificate accepted', t.includes('UDYAM-MP-24-0098765'))
check('Live checks: same person and registration', t.includes("The owner's identity is consistent") && t.includes('The business registration fits'))
await p.screenshot({ path: `${out}/03-identity-done.png`, fullPage: true })
const levels = await st(() => { const { buildIdentity } = window; return null })
void levels

// shop details from the documents, then the rest of the walkthrough
if (t.includes('Use these details')) await click('Use these details')
await click('Continue')
await p.waitForFunction(() => document.body.innerText.includes('Tell Kosha about the shop'), { timeout: 20000 }).catch(() => {})
await sleep(600)
t = await p.evaluate(() => document.body.innerText + [...document.querySelectorAll('input,textarea')].map((e) => e.value).join(' '))
check('Shop details filled in', t.includes('Verma Kirana') && t.includes('Indore'))
await p.screenshot({ path: `${out}/04-shop.png` })
await click('Continue'); await sleep(800)
await p.waitForFunction(() => document.body.innerText.includes('lines read'), { timeout: 240000 })
await idle()
t = await text()
check('Ledger read', /\d+ lines read/.test(t), t.match(/\d+ lines read[^\n]*/)?.[0])
await p.screenshot({ path: `${out}/05-ledger.png` })
await click('Continue'); await idle(); await sleep(800)
await p.screenshot({ path: `${out}/06-proof.png`, fullPage: true })
await click('Continue'); await idle(); await sleep(800)
check('Neighbourhood scanned', (await text()).includes('Location strength'))
await click('Continue'); await sleep(800)
await p.waitForFunction(() => document.body.innerText.includes('Hear the question'), { timeout: 60000 })
await click('Type instead'); await sleep(400)
for (let q = 0; q < 5; q++) {
  await p.waitForFunction(() => document.querySelector('textarea')?.value.length > 0, { timeout: 15000 })
  await click('Send answer')
  await p.waitForFunction((n) => document.body.innerText.includes(`${n} of 5 answered`), { timeout: 120000, polling: 500 }, q + 1)
  if (q < 4) { await click('Next question'); await sleep(500) }
}
check('Interview answered', (await text()).includes('5 of 5 answered'))
await click('Review & issue'); await sleep(800)
await p.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Build the credit passport') && !b.disabled), { timeout: 240000 })
await idle()
await click('Build the credit passport')
await p.waitForFunction(() => document.body.innerText.includes('Do the sources agree?'), { timeout: 240000 })
await sleep(4000)
const a = await st(() => { const x = window.__kosha.getState().assessment; return { id: x.id, score: x.score, band: x.band, status: x.offer.status, limit: x.offer.limit, identity: x.identity, idChecks: x.checks.filter((c) => c.id.startsWith('id_')).map((c) => `${c.id}=${c.status}`) } })
check('Passport issued', !!a.id, `${a.id} · score ${a.score} (${a.band}) · ${a.status} · limit ₹${a.limit?.toLocaleString('en-IN')}`)
check('Identity: read from documents (person and business)', a.identity?.person === 'document' && a.identity?.business === 'document', a.idChecks.join(' '))
check('Identity checks pass', a.idChecks.every((c) => c.endsWith('=pass')))
check('Passport lists Udyam Assist and masked IDs', JSON.stringify(a.identity.facts).includes('UDYAM-MP-24-0098765') && JSON.stringify(a.identity.facts).includes('ABCPV****Q') && JSON.stringify(a.identity.facts).includes('7712'))
await p.screenshot({ path: `${out}/07-passport.png` })
await p.evaluate(() => [...document.querySelectorAll('.eyebrow')].find((e) => /verified identity/i.test(e.textContent))?.scrollIntoView({ block: 'center' })); await sleep(800)
await p.screenshot({ path: `${out}/08-passport-identity.png` })

if (process.env.KOSHA_BAKE) {
  const entries = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kosha-gemini:')).map((k) => [k.slice(13), localStorage.getItem(k)]))
  let n = 0
  for (const [key, value] of entries) {
    const v = JSON.parse(value)
    if (v.task?.startsWith('narrate')) continue
    await writeFile(`cache/${key}.json`, JSON.stringify({ task: v.task, data: v.data, meta: v.meta, grounding: v.grounding })); n++
  }
  console.log('baked', n, 'results into cache/')
}
await writeFile(`${out}/results.json`, JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, errors, passport: a, results }, null, 2))
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed · console errors: ${errors.length ? errors.slice(0, 3).join(' | ') : 'none'}`)
await browser.close()
