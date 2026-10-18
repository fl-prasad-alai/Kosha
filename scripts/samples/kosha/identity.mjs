// Draws the sample shops' identity and registration documents. Every card is fictional, uses placeholder
// numbers, carries no government emblem and is stamped SPECIMEN, so it can never pass as a real document.
// Usage: node scripts/samples/kosha/identity.mjs
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const OUT = path.resolve('public/samples')
const base = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#d9d6cf;display:grid;place-items:center;width:1200px;height:800px}
  .card{position:relative;overflow:hidden;box-shadow:0 30px 60px -20px rgba(0,0,0,.45)}
  .stamp{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
  .stamp span{transform:rotate(-22deg);font:800 64px/1 Arial;letter-spacing:.08em;color:rgba(200,30,30,.28);border:8px solid rgba(200,30,30,.28);padding:10px 28px;border-radius:14px;white-space:nowrap}
  .lbl{font-size:13px;letter-spacing:.06em;color:#555;text-transform:uppercase}
  .val{font-size:24px;font-weight:700;color:#111;margin-top:3px}
  .foot{position:absolute;left:0;right:0;bottom:10px;text-align:center;font-size:12px;color:#777}
`
const stamp = '<div class="stamp"><span>SPECIMEN · FICTIONAL</span></div>'

const DOCS = [
  {
    file: 'shopA/pan-card.jpg', w: 860, h: 540,
    html: `<div class="card" style="width:860px;height:540px;border-radius:26px;background:linear-gradient(135deg,#dbe9f7,#f5f9fd 55%,#d8e6f3);padding:34px 40px">
      <div style="display:flex;justify-content:space-between;align-items:center"><div style="font:700 22px Arial;color:#1d3c6e">PERMANENT ACCOUNT NUMBER CARD</div><div style="font:600 14px Arial;color:#1d3c6e">Sample · Kosha</div></div>
      <div style="display:flex;gap:34px;margin-top:34px">
        <div style="width:150px;height:185px;border-radius:12px;background:linear-gradient(#c8d3df,#a9b7c6);display:grid;place-items:center;font:600 14px Arial;color:#566">PHOTO</div>
        <div style="display:grid;gap:16px">
          <div><div class="lbl">Permanent Account Number</div><div class="val" style="font-size:36px;letter-spacing:.12em">ABCPS1234F</div></div>
          <div><div class="lbl">Name</div><div class="val">SUNITA SHARMA</div></div>
          <div><div class="lbl">Father's Name</div><div class="val">RAMESH KUMAR SHARMA</div></div>
          <div><div class="lbl">Date of Birth</div><div class="val">12/03/1984</div></div>
        </div>
      </div>
      <div class="foot">Fictional sample document for the Kosha demo. Not issued by any authority.</div>${stamp}</div>`,
  },
  {
    file: 'shopA/gst-certificate.jpg', w: 900, h: 1180,
    html: `<div class="card" style="width:900px;height:1180px;background:#fff;padding:56px 64px;font-size:19px;color:#222">
      <div style="text-align:center"><div style="font:700 26px Arial">Registration Certificate</div><div style="margin-top:6px;color:#555">Goods and Services Tax · Form GST REG-06 (sample layout)</div></div>
      <table style="width:100%;margin-top:40px;border-collapse:collapse;font-size:19px">
        ${[['Registration Number (GSTIN)', '<b style="font-size:24px;letter-spacing:.06em">27ABCPS1234F1ZX</b>'], ['Legal Name', 'SUNITA SHARMA'], ['Trade Name', 'SHARMA GENERAL STORE'], ['Constitution of Business', 'Proprietorship'], ['Address of Principal Place of Business', 'Shop 4, Karve Road, Kothrud, Pune, Maharashtra, 411038'], ['Date of Liability', '01/07/2017'], ['Date of Validity', 'From 01/07/2017 To Not Applicable'], ['Type of Registration', 'Regular'], ['Status', 'Active']].map(([k, v]) => `<tr><td style="padding:16px 12px;border:1px solid #ccc;width:42%;color:#555">${k}</td><td style="padding:16px 12px;border:1px solid #ccc">${v}</td></tr>`).join('')}
      </table>
      <div style="margin-top:46px;color:#555">Approved on 01/07/2017. This certificate is a fictional sample created for the Kosha demo.</div>
      <div class="foot" style="bottom:24px">Fictional sample document · not issued by any authority</div>${stamp}</div>`,
  },
  {
    file: 'shopA/udyam-certificate.jpg', w: 900, h: 1180,
    html: `<div class="card" style="width:900px;height:1180px;background:#fffdf6;padding:56px 64px;font-size:19px;color:#222;border:10px double #c9a24a">
      <div style="text-align:center"><div style="font:700 28px Arial">UDYAM REGISTRATION CERTIFICATE</div><div style="margin-top:6px;color:#555">Micro, Small and Medium Enterprises (sample layout)</div></div>
      <div style="margin-top:44px;text-align:center"><div class="lbl">Udyam Registration Number</div><div style="font:700 32px Arial;letter-spacing:.06em;margin-top:6px">UDYAM-MH-26-0012345</div></div>
      <table style="width:100%;margin-top:40px;border-collapse:collapse">
        ${[['Name of Enterprise', 'SHARMA GENERAL STORE'], ['Type of Enterprise', 'Micro'], ['Major Activity', 'Trading'], ['Name of Owner', 'SUNITA SHARMA'], ['Official Address', 'Shop 4, Karve Road, Kothrud, Pune, Maharashtra 411038'], ['Date of Incorporation', '05/01/2015'], ['Date of Udyam Registration', '14/09/2020'], ['NIC Code', '47211 · Retail sale of food in specialised stores']].map(([k, v]) => `<tr><td style="padding:15px 12px;border:1px solid #d8c9a0;width:42%;color:#555">${k}</td><td style="padding:15px 12px;border:1px solid #d8c9a0">${v}</td></tr>`).join('')}
      </table>
      <div class="foot" style="bottom:24px">Fictional sample document · not issued by any authority</div>${stamp}</div>`,
  },
  {
    file: 'shopB/philsys-id.jpg', w: 860, h: 540,
    html: `<div class="card" style="width:860px;height:540px;border-radius:26px;background:linear-gradient(135deg,#e7f0fb,#ffffff 50%,#fbe9ea);padding:34px 40px">
      <div style="display:flex;justify-content:space-between;align-items:center"><div style="font:700 22px Arial;color:#1d3c6e">NATIONAL ID · PHILIPPINE IDENTIFICATION CARD</div><div style="font:600 14px Arial;color:#1d3c6e">Sample · Kosha</div></div>
      <div style="display:flex;gap:34px;margin-top:30px">
        <div style="width:150px;height:185px;border-radius:12px;background:linear-gradient(#d3cdd8,#b5abbd);display:grid;place-items:center;font:600 14px Arial;color:#566">PHOTO</div>
        <div style="display:grid;gap:14px">
          <div><div class="lbl">PhilSys Card Number</div><div class="val" style="letter-spacing:.08em">1234-5678-9012-3456</div></div>
          <div><div class="lbl">Last Name / Apelyido</div><div class="val">DIZON</div></div>
          <div><div class="lbl">Given Names / Mga Pangalan</div><div class="val">NENA</div></div>
          <div><div class="lbl">Date of Birth / Petsa ng Kapanganakan</div><div class="val">JUNE 02, 1979</div></div>
          <div><div class="lbl">Address / Tirahan</div><div class="val" style="font-size:18px">18 J.P. Rizal St., Project 4, Quezon City, Metro Manila 1109</div></div>
        </div>
      </div>
      <div class="foot">Fictional sample document for the Kosha demo. Not issued by any authority.</div>${stamp}</div>`,
  },
  {
    file: 'shopB/dti-certificate.jpg', w: 900, h: 1180,
    html: `<div class="card" style="width:900px;height:1180px;background:#fff;padding:60px 64px;font-size:19px;color:#222;border:8px solid #2a4f8f">
      <div style="text-align:center"><div style="font:700 26px Arial">CERTIFICATE OF BUSINESS NAME REGISTRATION</div><div style="margin-top:6px;color:#555">Business Name Registration (sample layout)</div></div>
      <div style="margin-top:60px;text-align:center;font-size:22px;line-height:1.6">This certifies that<br><b style="font-size:34px">NENA'S SARI-SARI STORE</b><br>is a business name registered by<br><b style="font-size:26px">NENA DIZON</b></div>
      <table style="width:100%;margin-top:50px;border-collapse:collapse">
        ${[['Business Name No.', '<b>1234567</b>'], ['Scope', 'Barangay'], ['Business Address', '18 J.P. Rizal St., Project 4, Quezon City, Metro Manila 1109'], ['Date Registered', 'February 10, 2023'], ['Valid Until', 'February 10, 2028']].map(([k, v]) => `<tr><td style="padding:15px 12px;border:1px solid #c7d3ea;width:40%;color:#555">${k}</td><td style="padding:15px 12px;border:1px solid #c7d3ea">${v}</td></tr>`).join('')}
      </table>
      <div class="foot" style="bottom:24px">Fictional sample document · not issued by any authority</div>${stamp}</div>`,
  },
]

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const page = await browser.newPage()
for (const d of DOCS) {
  await page.setViewport({ width: d.w + 80, height: d.h + 80, deviceScaleFactor: 1 })
  await page.setContent(`<!doctype html><style>${base} body{width:${d.w + 80}px;height:${d.h + 80}px}</style>${d.html}`)
  const el = await page.$('.card')
  await el.screenshot({ path: path.join(OUT, d.file), type: 'jpeg', quality: 86 })
  console.log('wrote', d.file)
}
await browser.close()
