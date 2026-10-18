// Role-based access matrix for Kosha's financial data, run against the Firestore emulator.
// Every role × every action on real and demo data, allowed and refused.
// Run: npm run emulators ; KOSHA_ADMIN_EMAIL=ops@kosha.test KOSHA_ADMIN_PASSWORD=real-admin-pass npm run seed:emulators ; node scripts/rbac-test.mjs
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, initializeFirestore, query, setDoc, updateDoc, where, orderBy, limit } from 'firebase/firestore'

let n = 0
const apps = []
const rows = []
async function as(email, password, signup) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-kosha' }, `r${n++}`)
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8180)
  if (email) await (signup ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email, password)
  return { db, uid: auth.currentUser?.uid, email }
}
async function expect(who, what, ok, fn) {
  let got
  try { await fn(); got = true } catch { got = false }
  rows.push({ who, what, want: ok, got })
  console.log(`${got === ok ? 'PASS' : 'FAIL'}  ${ok ? 'allows ' : 'refuses'}  ${who.padEnd(16)} ${what}`)
}
const t = Date.now().toString().slice(-6)
const now = () => new Date().toISOString()
const consent = (scope, lenderIds = []) => ({ scope, lenderIds, publicShowsOffer: false, at: now(), version: 1 })
const passport = (id, ownerId, c, demo = false) => ({ id, createdAt: now(), ownerId, demo, score: 760, band: 'A−', seal: 'TEST-SEAL', offer: { status: 'offer', limit: 50000 }, consent: c, profile: { shopName: `Shop ${id}` }, metrics: { monthlySales: 300000 }, identity: { person: 'document', business: 'none', facts: [] } })

// ── actors
const anon = await as()
const shopDemo = await as('shop@demo.kosha', 'kosha-demo')
const lenderDemo = await as('lender@demo.kosha', 'kosha-demo')
const adminDemo = await as('admin@demo.kosha', 'kosha-demo')
const adminReal = await as('ops@kosha.test', 'real-admin-pass')
const mk = async (role, name, org, extra = {}) => {
  const a = await as(`${name}.${t}@test.kosha`, 'password123', true)
  await setDoc(doc(a.db, 'users', a.uid), { id: a.uid, role, name, email: a.email, org, createdAt: now(), ...(role === 'lender' ? { orgId: `${org.toLowerCase().replace(/[^a-z]+/g, '-')}-${t}`, status: 'pending', orgType: 'nbfc', regNo: 'N-13.00001' } : {}), ...extra })
  return a
}
const shopA = await mk('business', 'asha', 'Asha Stores')
const shopB = await mk('business', 'bina', 'Bina Kirana')
const lenderReal = await mk('lender', 'ravi', 'Real Finance')
const lenderSandbox = await mk('lender', 'sana', 'Sandbox Credit')
const lenderPending = await mk('lender', 'pia', 'Pending Capital')
const orgOf = async (a) => (await getDoc(doc(a.db, 'users', a.uid))).data().orgId

// ── admins verify lenders
await expect('admin (demo)', 'verify a lender without sandboxing it', false, () => updateDoc(doc(adminDemo.db, 'users', lenderSandbox.uid), { status: 'verified', verifiedAt: now(), sandbox: false }))
await expect('admin (demo)', 'verify a lender as a sandbox lender', true, () => updateDoc(doc(adminDemo.db, 'users', lenderSandbox.uid), { status: 'verified', verifiedAt: now(), sandbox: true }))
await expect('admin (real)', 'verify a lender for real shops', true, () => updateDoc(doc(adminReal.db, 'users', lenderReal.uid), { status: 'verified', verifiedAt: now(), sandbox: false }))
await expect('admin (real)', 'add the real organisation', true, async () => setDoc(doc(adminReal.db, 'orgs', await orgOf(lenderReal)), { id: await orgOf(lenderReal), org: 'Real Finance', sandbox: false }))
await expect('admin (demo)', 'revoke a lender a real admin verified', false, () => updateDoc(doc(adminDemo.db, 'users', lenderReal.uid), { status: 'rejected', verifiedAt: now(), sandbox: true, statusNote: 'x' }))
await expect('admin (demo)', 'relabel a real organisation', false, async () => setDoc(doc(adminDemo.db, 'orgs', await orgOf(lenderReal)), { id: await orgOf(lenderReal), org: 'Hijacked', sandbox: true }))
await expect('lender (sandbox)', 'make itself a real lender', false, () => updateDoc(doc(lenderSandbox.db, 'users', lenderSandbox.uid), { sandbox: false }))
await expect('lender (pending)', 'verify itself', false, () => updateDoc(doc(lenderPending.db, 'users', lenderPending.uid), { status: 'verified' }))
await expect('lender (real)', "change its organisation to another bank's", false, () => updateDoc(doc(lenderReal.db, 'users', lenderReal.uid), { orgId: 'pune-merchants-co-op' }))
await expect('shop (real)', 'make itself an admin', false, () => updateDoc(doc(shopA.db, 'users', shopA.uid), { role: 'admin' }))

// ── passports are created with the right demo label
const REAL = `KSH-IN-R${t}`, PICK = `KSH-IN-S${t}`, DEMO = 'KSH-IN-8BE504'
await expect('shop (real)', 'label its passport as demo data', false, () => setDoc(doc(shopA.db, 'passports', `${REAL}X`), passport(`${REAL}X`, shopA.uid, consent('all'), true)))
await expect('shop (demo)', 'label its passport as real data', false, () => setDoc(doc(shopDemo.db, 'passports', `KSH-IN-D${t}`), passport(`KSH-IN-D${t}`, shopDemo.uid, consent('all'), false)))
await expect('shop (real)', 'issue its own passport', true, () => setDoc(doc(shopA.db, 'passports', REAL), passport(REAL, shopA.uid, consent('all'))))
await expect('shop (real)', 'issue a passport for another shop', false, () => setDoc(doc(shopA.db, 'passports', `${REAL}Y`), passport(`${REAL}Y`, shopB.uid, consent('all'))))
await expect('shop (real)', 'share only with one chosen lender', true, async () => setDoc(doc(shopB.db, 'passports', PICK), passport(PICK, shopB.uid, consent('selected', [await orgOf(lenderReal)]))))
await expect('visitor', 'issue a passport', false, () => setDoc(doc(anon.db, 'passports', `${REAL}Z`), passport(`${REAL}Z`, 'x', consent('all'))))

// ── who can read a real shop's full passport (shared with all verified lenders)
const read = (a, id) => getDoc(doc(a.db, 'passports', id))
for (const [who, a, ok] of [['shop (owner)', shopA, true], ['shop (other)', shopB, false], ['shop (demo)', shopDemo, false], ['lender (real)', lenderReal, true], ['lender (demo)', lenderDemo, false], ['lender (sandbox)', lenderSandbox, false], ['lender (pending)', lenderPending, false], ['admin (demo)', adminDemo, false], ['admin (real)', adminReal, false], ['visitor', anon, false]]) {
  await expect(who, "read a real shop's full passport", ok, () => read(a, REAL))
}
// ── a demo passport
for (const [who, a, ok] of [['shop (demo owner)', shopDemo, true], ['shop (real)', shopA, false], ['lender (real)', lenderReal, true], ['lender (demo)', lenderDemo, true], ['lender (sandbox)', lenderSandbox, true], ['lender (pending)', lenderPending, false], ['admin (demo)', adminDemo, false], ['visitor', anon, false]]) {
  await expect(who, 'read a demo passport', ok, () => read(a, DEMO))
}
// ── shared with one chosen lender only
for (const [who, a, ok] of [['lender (real)', lenderReal, true], ['lender (demo)', lenderDemo, false], ['lender (sandbox)', lenderSandbox, false]]) {
  await expect(who, 'read a passport shared only with Real Finance', ok, () => read(a, PICK))
}
// ── queues
const all = (a, ...w) => getDocs(query(collection(a.db, 'passports'), where('consent.scope', '==', 'all'), ...w))
await expect('lender (real)', 'list passports shared with all', true, () => all(lenderReal))
await expect('lender (demo)', 'list passports shared with all (would include real shops)', false, () => all(lenderDemo))
await expect('lender (demo)', 'list demo passports shared with all', true, () => all(lenderDemo, where('demo', '==', true)))
await expect('lender (sandbox)', 'list passports shared with all (would include real shops)', false, () => all(lenderSandbox))
await expect('lender (sandbox)', 'list demo passports shared with all', true, () => all(lenderSandbox, where('demo', '==', true)))
await expect('lender (pending)', 'list any passports', false, () => all(lenderPending, where('demo', '==', true)))
await expect('shop (real)', 'list passports of another shop', false, () => getDocs(query(collection(shopA.db, 'passports'), where('ownerId', '==', shopB.uid))))

// ── decisions and view logs
const decide = async (a, id) => { const org = await orgOf(a); return setDoc(doc(a.db, 'passports', id, 'decisions', org), { lenderId: a.uid, orgId: org, lenderName: 'x', org: 'x', status: 'approved', note: '', at: now() }) }
await expect('lender (real)', "decide on a real shop's passport", true, () => decide(lenderReal, REAL))
await expect('lender (sandbox)', "decide on a real shop's passport", false, () => decide(lenderSandbox, REAL))
await expect('lender (demo)', "decide on a real shop's passport", false, () => setDoc(doc(lenderDemo.db, 'passports', REAL, 'decisions', 'pune-merchants-co-op'), { lenderId: lenderDemo.uid, orgId: 'pune-merchants-co-op', lenderName: 'x', org: 'x', status: 'approved', note: '', at: now() }))
await expect('lender (sandbox)', 'decide on a demo passport', true, () => decide(lenderSandbox, DEMO))
await expect('shop (owner)', 'write a decision itself', false, () => setDoc(doc(shopA.db, 'passports', REAL, 'decisions', 'x'), { lenderId: shopA.uid, orgId: 'x', status: 'approved' }))
await expect('lender (real)', "overwrite another bank's decision", false, () => setDoc(doc(lenderReal.db, 'passports', DEMO, 'decisions', 'pune-merchants-co-op'), { lenderId: lenderReal.uid, orgId: 'pune-merchants-co-op', status: 'declined' }))
await expect('shop (owner)', 'read the decisions on its passport', true, () => getDocs(collection(shopA.db, 'passports', REAL, 'decisions')))
await expect('shop (other)', "read another shop's decisions", false, () => getDocs(collection(shopB.db, 'passports', REAL, 'decisions')))
await expect('lender (sandbox)', 'log a view of a real passport', false, () => setDoc(doc(collection(lenderSandbox.db, 'passports', REAL, 'access')), { lenderId: lenderSandbox.uid, org: 'x', at: now() }))
await expect('lender (real)', 'log a view in another lender\'s name', false, () => setDoc(doc(collection(lenderReal.db, 'passports', REAL, 'access')), { lenderId: lenderSandbox.uid, org: 'x', at: now() }))
await expect('shop (owner)', 'read who opened its passport', true, () => getDocs(collection(shopA.db, 'passports', REAL, 'access')))
await expect('lender (demo)', "read a real shop's view log", false, () => getDocs(collection(lenderDemo.db, 'passports', REAL, 'access')))

// ── changing a passport after issue
await expect('shop (owner)', 'change its score', false, () => updateDoc(doc(shopA.db, 'passports', REAL), { score: 900 }))
await expect('shop (owner)', 'change its consent', true, () => updateDoc(doc(shopA.db, 'passports', REAL), { consent: consent('none') }))
await expect('lender (real)', 'read it after consent was withdrawn', false, () => read(lenderReal, REAL))
await expect('shop (owner)', 'delete its passport', false, () => deleteDoc(doc(shopA.db, 'passports', REAL)))

// ── accounts, audit, public records
await expect('lender (real)', "read a shop's account", false, () => getDoc(doc(lenderReal.db, 'users', shopA.uid)))
await expect('shop (real)', "read a lender's account", false, () => getDoc(doc(shopA.db, 'users', lenderReal.uid)))
await expect('admin (real)', 'list lender accounts', true, () => getDocs(query(collection(adminReal.db, 'users'), where('role', '==', 'lender'))))
await expect('admin (real)', 'read the whole audit log', true, () => getDocs(query(collection(adminReal.db, 'audit'), orderBy('at', 'desc'), limit(20))))
await expect('admin (demo)', 'read the whole audit log (real activity)', false, () => getDocs(query(collection(adminDemo.db, 'audit'), orderBy('at', 'desc'), limit(20))))
await expect('admin (demo)', 'read the demo part of the audit log', true, () => getDocs(query(collection(adminDemo.db, 'audit'), where('demo', '==', true), orderBy('at', 'desc'), limit(20))))
await expect('shop (real)', 'read the whole audit log', false, () => getDocs(collection(shopA.db, 'audit')))
await expect('visitor', 'open one public record by its number', true, () => getDoc(doc(anon.db, 'public', DEMO)))
await expect('visitor', 'list every public record', false, () => getDocs(collection(anon.db, 'public')))
await expect('shop (real)', 'list every public record', false, () => getDocs(collection(shopA.db, 'public')))
await expect('lender (real)', 'list every PAN fingerprint', false, () => getDocs(collection(lenderReal.db, 'identities')))

for (const a of apps) await deleteApp(a)
const bad = rows.filter((r) => r.want !== r.got)
console.log(bad.length ? `\n${bad.length} of ${rows.length} FAILED` : `\nAll ${rows.length} access checks passed`)
process.exit(bad.length ? 1 : 0)
