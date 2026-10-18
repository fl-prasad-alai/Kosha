// Checks the identity rules (src/fb/identity.ts) on good and bad cases. Run: npx tsx scripts/identity-test.ts
import { buildIdentity, gstinCheckChar, validGstin, validPan } from '../src/fb/identity.ts'
import type { IdentityDoc, Profile } from '../shared/types.ts'

const profile: Profile = { shopName: 'Sharma General Store', ownerName: 'Sunita Sharma', address: 'Shop 4, Karve Road, Kothrud, Pune, Maharashtra 411038', shopType: 'Kirana', since: 2015, country: 'IN', language: 'hi', currency: 'INR' }
const pan = (o: Partial<IdentityDoc> = {}): IdentityDoc => ({ file: 0, kind: 'pan', number: 'ABCPS1234F', name: 'SUNITA SHARMA', nameLatin: 'SUNITA SHARMA', fatherName: '', dob: '1984-03-12', gender: '', address: '', specimen: false, tamperSigns: [], ...o })
const gstDoc = (number: string) => ({ file: 0, kind: 'gst' as const, number, legalName: 'SUNITA SHARMA', tradeName: 'SHARMA GENERAL STORE', ownerName: '', address: 'Shop 4, Karve Road, Kothrud, Pune, Maharashtra 411038', registeredOn: '2017-07-01', validTill: '', statusPrinted: 'Active', activity: '', specimen: false, tamperSigns: [] })
const qr = { signed: true as const, signedBy: 'UIDAI', version: 'V2', name: 'Sunita Sharma', dob: '1984-03-12', gender: 'Female', careOf: '', district: 'Pune', state: 'Maharashtra', pincode: '411038', locality: 'Kothrud', last4: '1234', generatedAt: '2026-01-01', hasMobile: true, hasEmail: false }

let failed = 0
function expect(name: string, got: unknown, want: unknown) {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${String(got)}, want ${String(want)})`}`)
}
const st = (r: ReturnType<typeof buildIdentity>, id: string) => r.checks.find((c) => c.id === id)?.status

expect('valid GSTIN check digit', validGstin('27AAPFU0939F1ZV'), true)
expect('one-character typo caught', validGstin('27AAPFU0939F1ZX'), false)
expect('sample GSTIN built from the PAN', gstinCheckChar('27ABCPS1234F1Z'), 'X')
expect('personal PAN accepted', validPan('ABCPS1234F'), true)
expect('bad PAN rejected', validPan('ABCDE1234F'), false)

let r = buildIdentity({ profile, identity: { documents: [pan()] }, business: { documents: [gstDoc('27ABCPS1234F1ZX')] } })
expect('consistent PAN + GST → same person passes', st(r, 'id_person'), 'pass')
expect('consistent PAN + GST → registration passes', st(r, 'id_business'), 'pass')
expect('document level', r.summary.person, 'document')

r = buildIdentity({ profile, identity: { documents: [pan({ nameLatin: 'RAJESH KUMAR', name: 'RAJESH KUMAR' })] } })
expect('PAN in another name fails', st(r, 'id_person'), 'fail')

r = buildIdentity({ profile, identity: { documents: [pan()] }, business: { documents: [gstDoc('27ABCPQ9999F1Z' + gstinCheckChar('27ABCPQ9999F1Z'))] } })
expect("GSTIN carrying someone else's PAN fails", st(r, 'id_business'), 'fail')

r = buildIdentity({ profile, input: { gstin: '27ABCPS1234F1ZY' } })
expect('typed GSTIN with a typo fails', st(r, 'id_business'), 'fail')

r = buildIdentity({ profile, identity: { documents: [pan({ tamperSigns: ['digits in a different font'] })] } })
expect('edited PAN card fails', st(r, 'id_person'), 'fail')

r = buildIdentity({ profile, identity: { documents: [pan({ specimen: true })] } })
expect('specimen card on a real shop fails', st(r, 'id_person'), 'fail')
r = buildIdentity({ profile, input: { sample: true }, identity: { documents: [pan({ specimen: true })] } })
expect('specimen card on a sample shop passes', st(r, 'id_person'), 'pass')

r = buildIdentity({ profile, identity: { documents: [pan({ dob: '1990-01-01' })] }, input: { aadhaar: qr } })
expect('Aadhaar and PAN dates of birth differ → fails', st(r, 'id_person'), 'fail')

r = buildIdentity({ profile, input: { aadhaar: qr }, identity: { documents: [pan()] } })
expect('signed Aadhaar QR → Govt-signed', r.summary.person, 'signed')
expect('Aadhaar area matches the shop', st(r, 'id_place'), 'pass')

r = buildIdentity({ profile, identity: { documents: [pan()] }, claim: 'taken' })
expect('PAN already used by another shop fails', st(r, 'id_unique'), 'fail')

r = buildIdentity({ profile })
expect('no identity → check not run', st(r, 'id_person'), 'missing')
expect('no identity → self-declared at best', r.summary.person, 'none')

console.log(failed ? `\n${failed} FAILED` : '\nAll identity checks passed')
process.exit(failed ? 1 : 0)
