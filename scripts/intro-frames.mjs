import puppeteer from 'puppeteer-core'
const out = process.argv[2]
const times = (process.argv[3] ?? '0.6,1.5,2.4,2.8,3.4,4.0').split(',')
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 300000 })
for (const [name, vp] of [['desk', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  for (const t of times) {
    const p = await b.newPage()
    await p.setViewport(vp)
    const errs = []
    p.on('pageerror', (e) => errs.push(String(e)))
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
    await p.goto(`http://localhost:5173/?introAt=${t}`, { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 3200))
    await p.screenshot({ path: `${out}/${name}-${t}.png` })
    if (errs.length) console.log(name, t, errs)
    await p.close()
  }
}
await b.close()
console.log('done')
