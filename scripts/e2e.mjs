// End-to-end run of the sample-shop flow in real Chrome. Usage: node scripts/e2e.mjs [sampleIndex] [outDir]
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const BASE = process.env.KOSHA_URL ?? 'http://localhost:5173'
const sample = Number(process.argv[2] ?? 0)
const out = process.argv[3] ?? 'e2e-shots'
await mkdir(out, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1440, height: 1000 },
  protocolTimeout: 900000,
})
const page = await browser.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

const t0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)
const shot = async (name, full = true) => {
  await new Promise((r) => setTimeout(r, 1200))
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full })
  log('shot', name)
}
const clickText = async (text, sel = 'button') => {
  const ok = await page.evaluate(
    (t, s) => {
      const el = [...document.querySelectorAll(s)].find((b) => b.textContent?.trim().includes(t) && !b.disabled)
      el?.click()
      return !!el
    },
    text,
    sel,
  )
  if (!ok) throw new Error(`No enabled ${sel} with text "${text}"`)
}
const fail = async (what, e) => {
  console.error('FAILED waiting for', what, e.message)
  await page.screenshot({ path: `${out}/error.png`, fullPage: true }).catch(() => {})
  console.log('page text:', (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 900))
  console.log('console errors:', errors)
  await browser.close()
  process.exit(1)
}
const waitText = (text, timeout = 180000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 500 }, text).catch((e) => fail(text, e))
const waitGone = (text, timeout = 180000) => page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout, polling: 500 }, text).catch((e) => fail(`no "${text}"`, e))

process.on('unhandledRejection', async (e) => {
  console.error('FAILED:', e.message)
  await page.screenshot({ path: `${out}/error.png` }).catch(() => {})
  console.log('page text:', (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 1500))
  console.log('console errors:', errors)
  await browser.close()
  process.exit(1)
})

await page.evaluateOnNewDocument(() => { try { sessionStorage.setItem('kosha-intro-seen', '1') } catch {} })
await page.goto(BASE, { waitUntil: 'networkidle2' })
await shot('01-landing', false)
await page.waitForSelector('#samples button')
await page.evaluate((i) => document.querySelectorAll('#samples button')[i].click(), sample)
log('opened sample', sample)

await waitText('lines read', 240000)
await shot('02-ledger')
await clickText('Continue')
await page.waitForFunction(() => !/Gemini is reading \d/.test(document.body.innerText), { timeout: 240000, polling: 500 }).catch((e) => fail('proof reads', e))
await shot('03-proof')
await clickText('Continue')
await page.waitForFunction(() => document.body.innerText.includes('Location strength'), { timeout: 180000, polling: 500 }).catch(() => log('location not ready'))
await shot('04-place')
await clickText('Continue')
await waitText('Hear the question')
await new Promise((r) => setTimeout(r, 800))
for (let q = 0; q < 5; q++) {
  if (q === 0) await clickText('Type instead')
  await page.waitForSelector('textarea')
  await page.waitForFunction(() => document.querySelector('textarea')?.value.length > 0, { timeout: 10000 })
  await clickText('Send answer')
  await page.waitForFunction((n) => document.body.innerText.includes(`${n} of 5 answered`), { timeout: 120000, polling: 500 }, q + 1).catch((e) => fail(`answer ${q + 1}`, e))
  if (q === 1) await shot('05-voice')
  if (q < 4) await clickText('Next question')
}
await clickText('Review & issue')
await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Build the credit passport') && !b.disabled), { timeout: 240000, polling: 500 })
await shot('06-ready', false)
await clickText('Build the credit passport')
await waitText('Do the sources agree?', 240000)
await new Promise((r) => setTimeout(r, 5000))
await shot('07-passport-top', false)
await shot('08-passport-full')
const id = await page.evaluate(() => document.body.innerText.match(/KSH-[A-Z]{2}-[0-9A-F]{6}/)?.[0])
log('passport', id)
if (id) {
  await page.goto(`${BASE}/passport/${id}`, { waitUntil: 'networkidle2' })
  await waitText('Do the sources agree?')
  await shot('09-public')
}
await page.evaluate(() => fetch('/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'lender' }) }))
await page.goto(`${BASE}/lender`, { waitUntil: 'networkidle2' })
await waitText('Passports waiting for a decision')
await shot('10-lender', false)
await page.setViewport({ width: 400, height: 860 })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
await shot('11-phone', false)

console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
