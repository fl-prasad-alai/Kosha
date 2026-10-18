// Checks firestore.rules against the emulators: every role, allowed and refused.
// Run: npm run emulators (another terminal) && npm run seed:emulators && node scripts/rules-test.mjs
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocs, initializeFirestore, query, setDoc, updateDoc, where, orderBy, limit,
} from 'firebase/firestore'

let n = 0
let failed = 0
async function client(email, password, signup) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-kosha' }, `c${n++}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8180)
  if (email) await (signup ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email, password)
  return { app, auth, db, uid: auth.currentUser?.uid }
}
async function expect(name, ok, fn) {
  let got
  try { await fn(); got = true } catch (e) { got = false; if (ok) console.log('   ', e.code, e.message.slice(0, 140)) }
  const pass = got === ok
  if (!pass) failed++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${ok ? 'allows ' : 'refuses'}  ${name}`)
}

const IN = 'KSH-IN-8BE504'
const shop = await client('shop@demo.kosha', 'kosha-demo')
const lender = await client('lender@demo.kosha', 'kosha-demo')
const admin = await client('admin@demo.kosha', 'kosha-demo')
const anon = await client()
const stamp = Date.now()
const newLender = await client(`new${stamp}@bank.test`, 'password123', true)
const newShop = await client(`shop${stamp}@shop.test`, 'password123', true)

// accounts
await expect('a new lender to sign up as pending', true, () => setDoc(doc(newLender.db, 'users', newLender.uid), { id: newLender.uid, role: 'lender', name: 'New Lender', email: `new${stamp}@bank.test`, org: 'Test Bank', orgId: 'test-bank', status: 'pending', orgType: 'nbfc', regNo: 'N-13.01234', createdAt: new Date().toISOString() }))
await expect('a new shop to make itself admin', false, () => setDoc(doc(newShop.db, 'users', newShop.uid), { id: newShop.uid, role: 'admin', name: 'X', email: `shop${stamp}@shop.test`, org: 'X', createdAt: '' }))
await expect('a new shop to sign up', true, () => setDoc(doc(newShop.db, 'users', newShop.uid), { id: newShop.uid, role: 'business', name: 'New Shop', email: `shop${stamp}@shop.test`, org: 'New Store', createdAt: new Date().toISOString() }))
await expect('a pending lender to verify itself', false, () => updateDoc(doc(newLender.db, 'users', newLender.uid), { status: 'verified' }))
await expect('an account to sign out everywhere', true, () => updateDoc(doc(newShop.db, 'users', newShop.uid), { signedOutBefore: new Date(0).toISOString() }))
await expect('a shop to read another account', false, () => getDoc(doc(shop.db, 'users', 'demo-lender')))
await expect('admin to list lender accounts', true, () => getDocs(query(collection(admin.db, 'users'), where('role', '==', 'lender'))))
await expect('a shop to list lender accounts', false, () => getDocs(query(collection(shop.db, 'users'), where('role', '==', 'lender'))))
await expect('admin to change the demo lender', false, () => updateDoc(doc(admin.db, 'users', 'demo-lender'), { status: 'rejected' }))

// passports
await expect('the owner to read its passport', true, () => getDoc(doc(shop.db, 'passports', IN)))
await expect('the owner to list its passports', true, () => getDocs(query(collection(shop.db, 'passports'), where('ownerId', '==', shop.uid))))
await expect('a shop to read another shop\'s passport', false, () => getDoc(doc(newShop.db, 'passports', IN)))
await expect('a verified lender to read a passport shared with all', true, () => getDoc(doc(lender.db, 'passports', IN)))
// the demo lender is sandboxed: it lists demo passports only
await expect('the demo lender to list demo passports shared with all', true, () => getDocs(query(collection(lender.db, 'passports'), where('consent.scope', '==', 'all'), where('demo', '==', true))))
await expect('the demo lender to list every passport shared with all', false, () => getDocs(query(collection(lender.db, 'passports'), where('consent.scope', '==', 'all'))))
await expect('the demo lender to list demo passports shared with its organisation', true, () => getDocs(query(collection(lender.db, 'passports'), where('consent.scope', '==', 'selected'), where('consent.lenderIds', 'array-contains', 'pune-merchants-co-op'), where('demo', '==', true))))
await expect('a verified lender to list every passport', false, () => getDocs(collection(lender.db, 'passports')))
await expect('a pending lender to read a shared passport', false, () => getDoc(doc(newLender.db, 'passports', IN)))
await expect('admin to read a full passport', false, () => getDoc(doc(admin.db, 'passports', IN)))
await expect('anyone to read the public record', true, () => getDoc(doc(anon.db, 'public', IN)))
await expect('a visitor to list every public record', false, () => getDocs(collection(anon.db, 'public')))
await expect('a signed-in shop to list every public record', false, () => getDocs(collection(newShop.db, 'public')))
await expect('a visitor to read a full passport', false, () => getDoc(doc(anon.db, 'passports', IN)))
await expect('the owner to change its score', false, () => updateDoc(doc(shop.db, 'passports', IN), { score: 900 }))
await expect('a lender to change consent', false, () => updateDoc(doc(lender.db, 'passports', IN), { consent: { scope: 'none', lenderIds: [], publicShowsOffer: false, at: '', version: 1 } }))
await expect('a shop to fake the public score', false, async () => setDoc(doc(shop.db, 'public', IN), { ...(await getDoc(doc(shop.db, 'public', IN))).data(), score: 900 }))

// a new shop issues, then shares only with chosen lenders
const NEW = `KSH-IN-T${String(stamp).slice(-6)}`
const passport = { id: NEW, createdAt: new Date().toISOString(), ownerId: newShop.uid, score: 700, band: 'B', offer: { status: 'offer', limit: 1000 }, seal: 'AAAA-BBBB', consent: { scope: 'selected', lenderIds: ['test-bank'], publicShowsOffer: false, at: '', version: 1 }, profile: { shopName: 'New Store' } }
await expect('a shop to issue its own passport', true, () => setDoc(doc(newShop.db, 'passports', NEW), passport))
await expect('a shop to issue a passport for someone else', false, () => setDoc(doc(newShop.db, 'passports', `${NEW}X`), { ...passport, id: `${NEW}X`, ownerId: 'demo-shop' }))
await expect('the owner to write a matching public record', true, () => setDoc(doc(newShop.db, 'public', NEW), { id: NEW, ownerId: newShop.uid, score: 700, band: 'B', status: 'offer', seal: 'AAAA-BBBB', redacted: true }))
await expect('a lender not chosen to read it', false, () => getDoc(doc(lender.db, 'passports', NEW)))
await expect('the owner to change consent', true, () => updateDoc(doc(newShop.db, 'passports', NEW), { 'consent.scope': 'all' }))
await expect("the demo lender to read a real shop's passport shared with all", false, () => getDoc(doc(lender.db, 'passports', NEW)))

// decisions and access log
const decision = { lenderId: lender.uid, orgId: 'pune-merchants-co-op', lenderName: 'Arjun', org: 'Pune', status: 'approved', note: '', at: new Date().toISOString() }
await expect('a shared lender to record its decision', true, () => setDoc(doc(lender.db, 'passports', IN, 'decisions', 'pune-merchants-co-op'), decision))
await expect('a lender to decide for another organisation', false, () => setDoc(doc(lender.db, 'passports', IN, 'decisions', 'other-bank'), { ...decision, orgId: 'other-bank' }))
await expect('a pending lender to decide', false, () => setDoc(doc(newLender.db, 'passports', IN, 'decisions', 'test-bank'), { ...decision, lenderId: newLender.uid, orgId: 'test-bank' }))
await expect('the owner to read all decisions', true, () => getDocs(collection(shop.db, 'passports', IN, 'decisions')))
await expect('a lender to read its own decision', true, () => getDoc(doc(lender.db, 'passports', IN, 'decisions', 'pune-merchants-co-op')))
await expect('a shared lender to log its view', true, () => setDoc(doc(collection(lender.db, 'passports', IN, 'access')), { lenderId: lender.uid, org: 'Pune', at: new Date().toISOString() }))
await expect('a lender to read its own views', true, () => getDocs(query(collection(lender.db, 'passports', IN, 'access'), where('lenderId', '==', lender.uid))))
await expect('the owner to read its access log', true, () => getDocs(collection(shop.db, 'passports', IN, 'access')))
await expect('another shop to read the access log', false, () => getDocs(collection(newShop.db, 'passports', IN, 'access')))

// audit log
const entry = (c, extra) => ({ id: crypto.randomUUID(), at: new Date().toISOString(), type: 'decision', actorId: c.uid, actorName: 'x', actorRole: 'lender', detail: 'x', ...extra })
const e1 = entry(lender, { passportId: IN, ownerId: 'demo-shop' })
await expect('a lender to log a decision on the shop\'s trail', true, () => setDoc(doc(lender.db, 'audit', e1.id), e1))
const e2 = entry(lender, { passportId: IN, ownerId: newShop.uid })
await expect('a lender to plant an entry on someone else\'s trail', false, () => setDoc(doc(lender.db, 'audit', e2.id), e2))
const e3 = entry(shop, {})
await expect('anyone to write an entry as someone else', false, () => setDoc(doc(shop.db, 'audit', e3.id), { ...e3, actorId: 'demo-admin' }))
const e4 = { id: crypto.randomUUID(), at: new Date().toISOString(), type: 'login_failed', actorId: null, actorName: 'Unknown', actorRole: null, detail: 'x' }
await expect('a visitor to log a failed sign-in', true, () => setDoc(doc(anon.db, 'audit', e4.id), e4))
await expect('the owner to read its passport trail', true, () => getDocs(query(collection(shop.db, 'audit'), where('ownerId', '==', shop.uid), where('passportId', '==', IN))))
await expect('a shop to read the whole log', false, () => getDocs(collection(shop.db, 'audit')))
await expect('the demo admin to read the whole log', false, () => getDocs(query(collection(admin.db, 'audit'), orderBy('at', 'desc'), limit(50))))
await expect('the demo admin to read the demo part of the log', true, () => getDocs(query(collection(admin.db, 'audit'), where('demo', '==', true), orderBy('at', 'desc'), limit(50))))
await expect('anyone to edit a log entry', false, () => updateDoc(doc(admin.db, 'audit', e1.id), { detail: 'changed' }))

// one identity, one shop
const FP = `fp${stamp}`
await expect('a shop to claim a new PAN fingerprint', true, () => setDoc(doc(newShop.db, 'identities', FP), { ownerId: newShop.uid, at: new Date().toISOString() }))
await expect('the claimant to read its claim', true, () => getDoc(doc(newShop.db, 'identities', FP)))
await expect('another shop to read that claim', false, () => getDoc(doc(shop.db, 'identities', FP)))
await expect('another shop to claim the same PAN', false, () => setDoc(doc(shop.db, 'identities', FP), { ownerId: shop.uid, at: new Date().toISOString() }))
await expect('anyone to list claims', false, () => getDocs(collection(shop.db, 'identities')))
await expect('a lender to claim a PAN', false, () => setDoc(doc(lender.db, 'identities', `${FP}b`), { ownerId: lender.uid, at: '' }))

// lender organisations
await expect('a signed-in shop to list verified organisations', true, () => getDocs(collection(shop.db, 'orgs')))
await expect('a lender to add its own organisation', false, () => setDoc(doc(newLender.db, 'orgs', 'test-bank'), { id: 'test-bank', org: 'Test Bank' }))
await expect('the demo admin to verify a lender without sandboxing it', false, () => updateDoc(doc(admin.db, 'users', newLender.uid), { status: 'verified', verifiedAt: new Date().toISOString() }))
await expect('the demo admin to verify a lender as a sandbox lender', true, () => updateDoc(doc(admin.db, 'users', newLender.uid), { status: 'verified', verifiedAt: new Date().toISOString(), sandbox: true }))
await expect('the demo admin to add a sandbox organisation', true, () => setDoc(doc(admin.db, 'orgs', `test-bank-${stamp}`), { id: `test-bank-${stamp}`, org: 'Test Bank', sandbox: true }))
await expect('the sandbox lender to read a demo passport shared with all', true, () => getDoc(doc(newLender.db, 'passports', IN)))
await expect("the sandbox lender to read a real shop's passport", false, () => getDoc(doc(newLender.db, 'passports', NEW)))

for (const c of [shop, lender, admin, anon, newLender, newShop]) await deleteApp(c.app)
console.log(failed ? `\n${failed} FAILED` : '\nAll rules checks passed')
process.exit(failed ? 1 : 0)
