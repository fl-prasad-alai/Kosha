// Sets up a Firebase project for Kosha: the demo accounts, the demo lender organisation and the
// two sample passports. Safe to run again; it overwrites the same records.
//
//   Emulators:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/seed.mjs demo-kosha
//   Live:       gcloud auth application-default login && node scripts/seed.mjs <project-id>
import { readFileSync, readdirSync } from 'node:fs'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.argv[2] ?? process.env.GCLOUD_PROJECT
if (!projectId) throw new Error('Usage: node scripts/seed.mjs <firebase-project-id>')
const emulated = !!process.env.FIRESTORE_EMULATOR_HOST
initializeApp(emulated ? { projectId } : { projectId, credential: applicationDefault() })
const auth = getAuth()
const db = getFirestore()

const PASSWORD = process.env.KOSHA_DEMO_PASSWORD ?? 'kosha-demo'
const created = '2026-10-01T00:00:00.000Z'
const DEMO_USERS = [
  { id: 'demo-shop', role: 'business', name: 'Sunita Sharma', email: 'shop@demo.kosha', org: 'Sharma General Store', createdAt: created, demo: true },
  { id: 'demo-nena', role: 'business', name: 'Nena Dizon', email: 'nena@demo.kosha', org: "Nena's Sari-Sari Store", createdAt: created, demo: true },
  { id: 'demo-lender', role: 'lender', name: 'Arjun Mehta', email: 'lender@demo.kosha', org: 'Pune Merchants Co-operative Bank', orgId: 'pune-merchants-co-op', status: 'verified', verifiedAt: created, createdAt: created, demo: true },
  { id: 'demo-admin', role: 'admin', name: 'Meera Iyer', email: 'admin@demo.kosha', org: 'Kosha Operations', createdAt: created, demo: true },
]

// Seals printed on the sample passports (and in the demo video), kept so their QR codes still verify.
const SEALS = { 'KSH-IN-8BE504': '3FFC-57E2', 'KSH-PH-56772F': '59A8-9005' }

const area = (address) => {
  const STREET = /\d|\b(road|rd|street|st|lane|ln|marg|avenue|ave|shop|no|plot|block|jalan|jl|gali|floor|bldg|building)\b\.?/i
  const parts = address.split(',').map((x) => x.replace(/\b\d{4,6}\b/g, '').trim()).filter(Boolean)
  let i = 0
  while (i < parts.length - 1 && STREET.test(parts[i])) i++
  return parts.slice(i, i + 2).join(', ')
}

for (const u of DEMO_USERS) {
  try {
    await auth.updateUser(u.id, { email: u.email, password: PASSWORD, displayName: u.name })
  } catch {
    await auth.createUser({ uid: u.id, email: u.email, password: PASSWORD, displayName: u.name })
  }
  await db.doc(`users/${u.id}`).set(u)
}
await db.doc('orgs/pune-merchants-co-op').set({ id: 'pune-merchants-co-op', org: 'Pune Merchants Co-operative Bank' })

for (const f of readdirSync('cache/passports').filter((x) => x.endsWith('.json'))) {
  const a = JSON.parse(readFileSync(`cache/passports/${f}`, 'utf8'))
  delete a.decisions
  delete a.access
  a.seal = SEALS[a.id] ?? a.seal
  await db.doc(`passports/${a.id}`).set(a)
  const c = a.consent
  await db.doc(`public/${a.id}`).set({
    redacted: true, id: a.id, createdAt: a.createdAt, shopName: a.profile.shopName,
    ownerFirstName: a.profile.ownerName.split(/\s+/)[0] ?? '', area: area(a.profile.address), country: a.profile.country,
    shopType: a.profile.shopType, score: a.score, band: a.band, status: a.offer.status,
    ...(c?.publicShowsOffer && a.offer.status === 'offer' ? { limit: a.offer.limit } : {}),
    currency: a.profile.currency, sourcesCount: a.sourcesUsed.length, seal: a.seal, ownerId: a.ownerId,
  })
}
console.log(`Seeded ${projectId}${emulated ? ' (emulators)' : ''}: ${DEMO_USERS.length} demo accounts, 1 lender organisation, sample passports.`)
