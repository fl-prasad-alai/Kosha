// Everything the web app asks of Kosha, on Firebase: Authentication for accounts, Firestore for passports,
// consent, decisions and the audit log, and Gemini through the Gemini API (Google AI Studio).
// Firestore security rules (firestore.rules) enforce who may read or change what; the checks here only
// give clear messages before a request is refused.
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, type User as FbUser,
} from 'firebase/auth'
import {
  collection, deleteField, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where, type DocumentData,
} from 'firebase/firestore'
import type {
  AccessEntry, Assessment, AuditEntry, AuditType, Consent, ConsentInput, Decision, DecisionStatus, DocKind, Role, User, ExtractResponse, ExtractResultMap,
  IdentityInput, IdentitySummary, InterviewAnswer, LenderAccount, LenderOrg, LenderType, LocationResult, PassportResponse, PassportSummary, Profile, PublicPassport, QuestionId,
} from '@shared/types'
import { areaOf, can, NO_CONSENT, orgOf, slug, type PassportResource } from '@shared/policy'
import { auth, db } from '@/fb/firebase'
import { GeminiError, sha256 } from '@/fb/gemini'
import { extract } from '@/fb/extract'
import { analyseLocation } from '@/fb/location'
import { readAnswer } from '@/fb/interview'
import { assess } from '@/fb/assess'
import { speak } from '@/fb/tts'
import { panFingerprint, validPan } from '@/fb/identity'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Turns Firebase and Gemini failures into the same plain messages the app always showed. */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiError || (e as Error).name === 'AbortError') throw e
    if (e instanceof GeminiError) throw new ApiError(e.message, e.status)
    const code = (e as { code?: string }).code ?? ''
    if (code === 'permission-denied') throw new ApiError('You do not have access to this.', 403)
    if (code === 'unavailable' || code === 'auth/network-request-failed') throw new ApiError('Kosha could not reach the server. Check your connection and try again.', 0)
    console.error('[kosha]', e)
    throw new ApiError('Something went wrong on our side. Please try again.', 500)
  }
}

// ───────────────────────── who is signed in

const DEMO_EMAIL: Record<Role, string> = { business: 'shop@demo.kosha', lender: 'lender@demo.kosha', admin: 'admin@demo.kosha' }
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? 'kosha-demo'

type Stored = User & { signedOutBefore?: string }
const clean = ({ signedOutBefore: _s, ...u }: Stored): User => u

async function profileOf(fb: FbUser): Promise<User | null> {
  const s = await getDoc(doc(db, 'users', fb.uid))
  if (!s.exists()) return null
  const u = s.data() as Stored
  // "Sign out everywhere" ends every sign-in that started before it.
  if (u.signedOutBefore && Date.parse(fb.metadata.lastSignInTime ?? '0') < Date.parse(u.signedOutBefore)) {
    await signOut(auth)
    return null
  }
  return clean(u)
}

/** The signed-in user, read fresh: a lender's verification can change at any time. */
async function current(): Promise<User | null> {
  await auth.authStateReady()
  return auth.currentUser ? profileOf(auth.currentUser) : null
}
async function needUser(): Promise<User> {
  const u = await current()
  if (!u) throw new ApiError('Please sign in first.', 401)
  return u
}

const DENIED = {
  shop: 'This is for shop accounts.',
  staff: 'This is for Kosha staff.',
  shared: 'Your organisation is not verified yet, or this shop has not shared its passport with you.',
}

// ───────────────────────── audit log (append-only; rules forbid edits and deletes)

async function audit(actor: User | null, type: AuditType, e: { detail: string; org?: string; passportId?: string; targetId?: string; ownerId?: string; demo?: boolean }) {
  // Demo activity is marked so the public demo admin sees only that part of the log.
  const demo = e.demo ?? (!!actor?.demo || !!actor?.sandbox)
  const entry: AuditEntry & { ownerId?: string } = {
    id: crypto.randomUUID(), at: new Date().toISOString(), type, actorId: actor?.id ?? null, actorName: actor?.name ?? 'Unknown', actorRole: actor?.role ?? null, ...e, demo,
  }
  try {
    await setDoc(doc(db, 'audit', entry.id), entry)
  } catch (err) {
    // The action itself already happened; record the failure loudly rather than failing it.
    console.error('[audit] could not write', type, (err as Error).message)
  }
}

// ───────────────────────── Gemini steps

const KINDS: DocKind[] = ['identity', 'business', 'ledger', 'invoice', 'payments', 'electricity', 'shopfront']
const MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|audio\/.+|video\/webm)$/

async function base64(b: Blob): Promise<string> {
  const url: string = await new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })
  return url.slice(url.indexOf(',') + 1)
}

const aborted = () => new DOMException('The read was cancelled.', 'AbortError')

export function extractDocs<K extends DocKind>(kind: K, files: File[], profile: Profile, signal?: AbortSignal) {
  return run(async () => {
    const u = await needUser()
    if (!can(u, 'passport:create')) throw new ApiError(DENIED.shop, 403)
    if (!KINDS.includes(kind)) throw new ApiError('Unknown document type.', 404)
    const ok = files.filter((f) => MIME.test(f.type) && f.size <= 12 * 1024 * 1024).slice(0, 8)
    if (!ok.length) throw new ApiError('Add at least one photo or PDF (JPG, PNG, WEBP, HEIC or PDF, up to 12 MB).', 400)
    const uploads = await Promise.all(ok.map(async (f) => ({ data: await base64(f), mimetype: f.type, originalname: f.name })))
    if (signal?.aborted) throw aborted()
    const out = await extract(kind, uploads, profile)
    if (signal?.aborted) throw aborted()
    return { kind, result: out.data, meta: out.meta } as ExtractResponse<K> & { result: ExtractResultMap[K] }
  })
}

export const scanLocation = (profile: Profile) => run(async (): Promise<LocationResult> => {
  const u = await needUser()
  if (!can(u, 'passport:create')) throw new ApiError(DENIED.shop, 403)
  if (!profile?.address?.trim()) throw new ApiError('Add the shop address first.', 400)
  return analyseLocation(profile)
})

export function answer(id: QuestionId, profile: Profile, input: { audio?: Blob; text?: string }) {
  return run(async (): Promise<InterviewAnswer> => {
    const u = await needUser()
    if (!can(u, 'passport:create')) throw new ApiError(DENIED.shop, 403)
    const audio = input.audio ? { data: await base64(input.audio), mimetype: input.audio.type || 'audio/webm' } : undefined
    return readAnswer(id, profile, { audio, text: input.text })
  })
}

export async function tts(text: string): Promise<Blob> {
  if (!(await current())) throw new ApiError('Voice is unavailable right now.', 401)
  try {
    return await speak(text)
  } catch (e) {
    throw new ApiError('Voice is unavailable right now.', (e as GeminiError).status ?? 503)
  }
}

// ───────────────────────── passports

// How a failed or flagged check reads in the lender queue: the problem, not the check's name.
const PROBLEM: Record<string, string> = {
  integrity: 'Edited payment record', ontime: 'Late bill payment', address: 'Address mismatch', invoice_ledger: 'Bills missing from ledger',
  margin: 'Unusual margin', mix: 'Unusual cash / digital mix', power: 'Power use does not fit sales', place: 'Weak location',
  located: 'Location not confirmed', discipline: 'Gaps in the ledger', credit: 'High customer credit', interview: 'Answers differ from documents',
  shopfront: 'Signboard does not match',
  id_person: 'Identity does not match', id_business: 'Registration problem', id_place: 'ID address elsewhere', id_unique: 'PAN used by another shop',
}

const ownerOf = (a: Assessment) => a.ownerId ?? 'demo-shop'
const consentOf = (a: Assessment): Consent => a.consent ?? NO_CONSENT
const resourceOf = (a: Assessment): PassportResource => ({ ownerId: ownerOf(a), consent: consentOf(a) })

/**
 * A short code that seals a passport's public facts (id, score, band, status, issue date). It is printed
 * on the passport and carried in its QR code, and stored with the passport when it is issued.
 */
export async function sealOf(p: { id: string; score: number; band: string; status: string; createdAt: string }) {
  const h = (await sha256(['seal', p.id, p.score, p.band, p.status, p.createdAt].join('|'))).slice(0, 8).toUpperCase()
  return `${h.slice(0, 4)}-${h.slice(4)}`
}

/** What anyone with the link may see. Built field by field, so nothing else can slip through. */
function toPublic(a: Assessment): PublicPassport {
  const c = consentOf(a)
  return {
    redacted: true,
    id: a.id,
    createdAt: a.createdAt,
    shopName: a.profile.shopName,
    ownerFirstName: a.profile.ownerName.split(/\s+/)[0] ?? '',
    area: areaOf(a.profile.address),
    country: a.profile.country,
    shopType: a.profile.shopType,
    score: a.score,
    band: a.band,
    status: a.offer.status,
    ...(c.publicShowsOffer && a.offer.status === 'offer' ? { limit: a.offer.limit } : {}),
    currency: a.profile.currency,
    sourcesCount: a.sourcesUsed.length,
    seal: a.seal ?? '',
    idLevel: a.identity?.person,
    bizLevel: a.identity?.business,
  }
}
const publicDoc = (a: Assessment) => ({ ...toPublic(a), ownerId: ownerOf(a) })
const stripOwner = ({ ownerId: _o, ...p }: PublicPassport & { ownerId?: string }): PublicPassport => p

const VALID_ID = /^[A-Z0-9-]{6,40}$/
const passportRef = (id: string) => doc(db, 'passports', id)

async function readFull(id: string): Promise<Assessment | null> {
  try {
    const s = await getDoc(passportRef(id))
    return s.exists() ? (s.data() as Assessment) : null
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') return null
    throw e
  }
}
async function decisionsOf(id: string): Promise<Decision[]> {
  return (await getDocs(collection(db, 'passports', id, 'decisions'))).docs.map((d) => d.data() as Decision)
}
async function ownDecision(id: string, orgId: string): Promise<Decision[]> {
  const s = await getDoc(doc(db, 'passports', id, 'decisions', orgId))
  return s.exists() ? [s.data() as Decision] : []
}
async function accessOf(id: string): Promise<AccessEntry[]> {
  return (await getDocs(collection(db, 'passports', id, 'access'))).docs.map((d) => d.data() as AccessEntry).sort((x, y) => x.at.localeCompare(y.at))
}

/** The owner sees everything; a lender the shop shared with sees the passport and its own decision. */
async function viewFor(a: Assessment, user: User): Promise<Assessment> {
  const r = resourceOf(a)
  if (can(user, 'passport:read:own', r)) {
    const [decisions, access] = await Promise.all([decisionsOf(a.id), accessOf(a.id)])
    return { ...a, ownerId: r.ownerId, consent: r.consent!, access, decisions }
  }
  return { ...a, ownerId: r.ownerId, consent: undefined, access: undefined, decisions: await ownDecision(a.id, orgOf(user)) }
}

// Re-opening the same passport within a few minutes (a refresh, a second tab) counts as one view.
const VIEW_GAP = 5 * 60 * 1000
const viewedNow = new Map<string, number>()
async function recordView(a: Assessment, lender: User) {
  // the page can ask twice at once; count that as one view
  if (Date.now() - (viewedNow.get(a.id) ?? 0) < VIEW_GAP) return
  viewedNow.set(a.id, Date.now())
  const mine = await getDocs(query(collection(db, 'passports', a.id, 'access'), where('lenderId', '==', lender.id)))
  const last = mine.docs.map((d) => (d.data() as AccessEntry).at).sort().pop()
  if (last && Date.now() - Date.parse(last) < VIEW_GAP) return
  const e: AccessEntry = { lenderId: lender.id, org: lender.org, at: new Date().toISOString() }
  await setDoc(doc(collection(db, 'passports', a.id, 'access')), e)
  await audit(lender, 'lender_view', { passportId: a.id, org: lender.org, ownerId: ownerOf(a), demo: !!a.demo || !!lender.demo || !!lender.sandbox, detail: `Opened the full passport of ${a.profile.shopName}` })
}

/** The full passport when the viewer may see it, otherwise the redacted public record. */
export const getPassport = (id: string) => run(async (): Promise<PassportResponse> => {
  if (!VALID_ID.test(id)) throw new ApiError('No passport with that number.', 404)
  const user = await current()
  const a = user ? await readFull(id) : null
  if (a && user && (can(user, 'passport:read:own', resourceOf(a)) || can(user, 'passport:read:shared', resourceOf(a)))) {
    if (user.role === 'lender') await recordView(a, user).catch((e) => console.warn('[access]', e))
    return viewFor(a, user)
  }
  const p = await getDoc(doc(db, 'public', id))
  if (!p.exists()) throw new ApiError('No passport with that number.', 404)
  return stripOwner(p.data() as PublicPassport)
})

function summary(a: Assessment, owner: boolean, decisions: Decision[], views: number): PassportSummary {
  return {
    id: a.id,
    createdAt: a.createdAt,
    shopName: a.profile.shopName,
    ownerName: a.profile.ownerName,
    address: a.profile.address,
    country: a.profile.country,
    currency: a.profile.currency,
    score: a.score,
    band: a.band,
    status: a.offer.status,
    limit: a.offer.limit,
    monthlySales: a.metrics.monthlySales,
    flags: a.checks
      .filter((c) => c.status === 'fail' || c.status === 'watch')
      .sort((x, y) => (x.status === 'fail' ? 0 : 1) - (y.status === 'fail' ? 0 : 1))
      .map((c) => PROBLEM[c.id] ?? c.title),
    ownerId: ownerOf(a),
    decision: [...decisions].sort((x, y) => y.at.localeCompare(x.at))[0] ?? null,
    thumbnail: owner ? a.thumbnail : undefined,
    ...(owner ? { consent: consentOf(a), views } : {}),
    idLevel: a.identity?.person,
    bizLevel: a.identity?.business,
  }
}

const complete = (a: Assessment) => !!(a?.profile && a.metrics && a.offer && Array.isArray(a.checks))

/** Shops see their own passports; verified lenders only what shops shared with their organisation. */
export const listPassports = () => run(async (): Promise<PassportSummary[]> => {
  const u = await needUser()
  const passports = collection(db, 'passports')
  if (u.role === 'business') {
    const snap = await getDocs(query(passports, where('ownerId', '==', u.id)))
    const all = snap.docs.map((d) => d.data() as Assessment).filter(complete).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
    return Promise.all(all.map(async (a) => {
      const [decisions, access] = await Promise.all([decisionsOf(a.id), accessOf(a.id)])
      return summary(a, true, decisions, access.length)
    }))
  }
  if (u.role === 'lender') {
    if (!can(u, 'passport:read:shared')) return []
    const org = orgOf(u)
    // The public demo lender, and lenders verified by the demo admin, can only ever see demo passports.
    const onlyDemo = u.demo || u.sandbox ? [where('demo', '==', true)] : []
    const [everyone, chosen] = await Promise.all([
      getDocs(query(passports, where('consent.scope', '==', 'all'), ...onlyDemo)),
      getDocs(query(passports, where('consent.scope', '==', 'selected'), where('consent.lenderIds', 'array-contains', org), ...onlyDemo)),
    ])
    const seen = new Map<string, Assessment>()
    for (const d of [...everyone.docs, ...chosen.docs]) if (complete(d.data() as Assessment)) seen.set(d.id, d.data() as Assessment)
    const all = [...seen.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
    return Promise.all(all.map(async (a) => summary(a, false, await ownDecision(a.id, org), 0)))
  }
  throw new ApiError(DENIED.shop, 403)
})

let orgs: Promise<LenderOrg[]> | null = null
/** Verified lender organisations a shop can share with. Fetched once per page load. */
export const listLenders = () =>
  (orgs ??= run(async () => {
    const u = await needUser()
    const s = await getDocs(collection(db, 'orgs'))
    // Sandbox lenders cannot open a real shop's passport, so real shops are not offered them.
    return s.docs.map((d) => d.data() as LenderOrg).filter((o) => u.demo || !o.sandbox).sort((a, b) => a.org.localeCompare(b.org))
  }).catch((e) => { orgs = null; throw e }))

/** Checks the consent a shop sent. Selected lenders must be verified organisations. */
async function parseConsent(raw: unknown, allowNone: boolean): Promise<Consent> {
  const c = (raw ?? {}) as Partial<ConsentInput>
  const scopes = allowNone ? ['all', 'selected', 'none'] : ['all', 'selected']
  if (!c.scope || !scopes.includes(c.scope)) throw new ApiError('Choose who can see your full passport, and tick the consent box.', 400)
  const known = new Set((await getDocs(collection(db, 'orgs'))).docs.map((d) => d.id))
  const lenderIds = c.scope === 'selected' ? [...new Set((Array.isArray(c.lenderIds) ? c.lenderIds : []).map(String))].filter((id) => known.has(id)) : []
  if (c.scope === 'selected' && !lenderIds.length) throw new ApiError('Choose at least one lender, or share with all verified lenders.', 400)
  return { scope: c.scope, lenderIds, publicShowsOffer: c.publicShowsOffer === true, at: new Date().toISOString(), version: 1 }
}
const describe = (c: Consent) => (c.scope === 'all' ? 'all verified lenders' : c.scope === 'selected' ? `${c.lenderIds.length} chosen lender${c.lenderIds.length === 1 ? '' : 's'}` : 'no lenders (withdrawn)') + (c.publicShowsOffer ? ', offer shown on the public link' : '')

/** Firestore keeps nothing undefined; this also drops anything a class instance might carry. */
const plain = <T,>(x: T): T & DocumentData => JSON.parse(JSON.stringify(x))

export const buildPassport = (body: { consent: ConsentInput; [k: string]: unknown }) => run(async (): Promise<Assessment> => {
  const u = await needUser()
  if (!can(u, 'passport:create')) throw new ApiError(DENIED.shop, 403)
  const { profile, docs = {}, location, interview, thumbnail } = body as { profile?: Profile; docs?: Record<string, unknown>; location?: unknown; interview?: unknown; thumbnail?: unknown }
  if (!profile?.shopName) throw new ApiError('Add the shop details first.', 400)
  if (!docs.ledger) throw new ApiError('Read at least the ledger pages before building the passport.', 400)
  const consent = await parseConsent(body.consent, false)
  const idInput = (body.identity ?? {}) as IdentityInput & { sample?: boolean }
  const pan = (idInput.pan || (docs.identity as ExtractResultMap['identity'] | undefined)?.documents.find((d) => d.kind === 'pan' && !d.tamperSigns.length)?.number || '').toUpperCase()
  const claim = validPan(pan) && !idInput.sample ? await claimIdentity(pan, u.id) : 'none'
  const a = await assess({ profile, ...docs, location, interview, idInput, claim } as never, typeof thumbnail === 'string' && thumbnail.length < 400_000 ? thumbnail : undefined)
  a.ownerId = u.id
  a.consent = consent
  a.demo = !!u.demo
  a.seal = await sealOf({ id: a.id, score: a.score, band: a.band, status: a.offer.status, createdAt: a.createdAt })
  await setDoc(passportRef(a.id), plain(a))
  await setDoc(doc(db, 'public', a.id), plain(publicDoc(a)))
  await audit(u, 'passport_issued', { passportId: a.id, org: u.org, ownerId: u.id, detail: `Issued and shared with ${describe(consent)}` })
  const idFails = a.checks.filter((c) => c.id.startsWith('id_') && c.status === 'fail')
  if (idFails.length) await audit(u, 'identity_flag', { passportId: a.id, org: u.org, ownerId: u.id, detail: `${a.profile.shopName}: ${idFails.map((c) => c.title.toLowerCase()).join('; ')}` })
  return viewFor(a, u)
})

/**
 * One identity, one shop. The PAN's one-way fingerprint is claimed by the first shop that uses it; the rules
 * refuse a second shop, so Kosha learns "taken" without learning or storing whose PAN it is.
 */
async function claimIdentity(pan: string, uid: string): Promise<IdentitySummary['claim']> {
  const ref = doc(db, 'identities', await panFingerprint(pan))
  try {
    const mine = await getDoc(ref)
    if (mine.exists()) return 'own'
  } catch { /* someone else's claim: reading it is refused */ }
  try {
    await setDoc(ref, { ownerId: uid, at: new Date().toISOString() })
    return 'new'
  } catch {
    return 'taken'
  }
}

export const setConsent = (id: string, input: ConsentInput) => run(async (): Promise<Assessment> => {
  const u = await needUser()
  const a = await readFull(id)
  if (!a) throw new ApiError('No passport with that number.', 404)
  if (!can(u, 'passport:share', resourceOf(a))) throw new ApiError('Only the shop that owns this passport can change who sees it.', 403)
  const c = await parseConsent(input, true)
  await updateDoc(passportRef(id), { consent: c })
  const next = { ...a, consent: c }
  await setDoc(doc(db, 'public', id), plain(publicDoc(next)))
  await audit(u, 'consent', { passportId: id, org: u.org, ownerId: u.id, detail: `Now shared with ${describe(c)}` })
  return viewFor(next, u)
})

/** A shop reads the audit trail of its own passport; staff read any. */
export const passportAudit = (id: string) => run(async (): Promise<AuditEntry[]> => {
  const u = await needUser()
  if (u.role === 'admin') {
    const s = await getDocs(query(collection(db, 'audit'), where('passportId', '==', id), ...(u.demo ? [where('demo', '==', true)] : [])))
    return s.docs.map((d) => d.data() as AuditEntry).sort((x, y) => y.at.localeCompare(x.at))
  }
  const a = await readFull(id)
  if (!a) throw new ApiError('No passport with that number.', 404)
  if (!can(u, 'audit:read', resourceOf(a))) throw new ApiError('This is not your passport.', 403)
  const s = await getDocs(query(collection(db, 'audit'), where('ownerId', '==', u.id), where('passportId', '==', id)))
  return s.docs.map((d) => d.data() as AuditEntry).sort((x, y) => y.at.localeCompare(x.at))
})

const DECISIONS: DecisionStatus[] = ['approved', 'more_info', 'declined']
export const decide = (id: string, status: DecisionStatus, rawNote: string, requests: string[] = []) => run(async (): Promise<Assessment> => {
  const u = await needUser()
  if (!can(u, 'passport:decide')) throw new ApiError(DENIED.shared, 403)
  if (!DECISIONS.includes(status)) throw new ApiError('Choose approve, ask for documents or decline.', 400)
  const note = String(rawNote ?? '').trim().slice(0, 600)
  const asks = status === 'more_info' ? [...new Set(requests.map((r) => String(r).trim().slice(0, 80)).filter(Boolean))].slice(0, 8) : []
  if (status !== 'approved' && note.length < 3 && !asks.length) throw new ApiError('Add a short note so the shop knows what to do next.', 400)
  const before = await readFull(id)
  // Checked against this passport's consent, which the shop may have changed a moment ago.
  if (!before || !can(u, 'passport:decide', resourceOf(before))) throw new ApiError('This shop has not shared its passport with your organisation.', 403)
  const d: Decision = { lenderId: u.id, orgId: orgOf(u), lenderName: u.name, org: u.org, status, note, at: new Date().toISOString(), ...(asks.length ? { requests: asks } : {}) }
  // One decision per lender organisation; a newer one from the same organisation replaces it.
  await setDoc(doc(db, 'passports', id, 'decisions', orgOf(u)), d)
  await audit(u, 'decision', { passportId: id, org: u.org, ownerId: ownerOf(before), demo: !!before.demo || !!u.demo || !!u.sandbox, detail: `${status === 'approved' ? 'Approved' : status === 'more_info' ? 'Asked for documents' : 'Declined'} ${before.profile.shopName}` })
  return viewFor(before, u)
})

// ───────────────────────── accounts

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const me = () => run(current)

export const login = (rawEmail: string, password: string) => run(async (): Promise<User> => {
  const email = rawEmail.trim().toLowerCase()
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const u = await profileOf(cred.user)
    if (!u) throw new ApiError('Email or password is incorrect.', 401)
    await audit(u, 'login', { org: u.org, detail: 'Signed in with password' })
    return u
  } catch (e) {
    const code = (e as { code?: string }).code ?? ''
    if (code === 'auth/too-many-requests') {
      await audit(null, 'login_locked', { detail: `Locked after repeated wrong passwords for ${email}` })
      throw new ApiError('Too many wrong passwords for this email, so it is locked for a few minutes. Try again later.', 429)
    }
    if (/auth\/(invalid-credential|wrong-password|user-not-found|invalid-email)/.test(code)) {
      await audit(null, 'login_failed', { detail: `Wrong password for ${email}` })
      throw new ApiError('Email or password is incorrect.', 401)
    }
    throw e
  }
})

export const signup = (input: { role: Role; name: string; email: string; password: string; org: string; orgType?: LenderType; regNo?: string }) => run(async (): Promise<User> => {
  const role = input.role === 'lender' ? 'lender' : input.role === 'business' ? 'business' : null
  const name = (input.name ?? '').trim()
  const email = (input.email ?? '').trim().toLowerCase()
  const org = (input.org ?? '').trim()
  const password = input.password ?? ''
  if (!role) throw new ApiError('Choose whether you run a shop or work for a lender.', 400)
  if (name.length < 2) throw new ApiError('Add your name.', 400)
  if (!EMAIL.test(email)) throw new ApiError('That email address does not look right.', 400)
  if (password.length < 8) throw new ApiError('Use a password of at least 8 characters.', 400)
  if (org.length < 2) throw new ApiError(role === 'lender' ? 'Add the name of your bank or lender.' : 'Add your shop name.', 400)
  const regNo = (input.regNo ?? '').trim().toUpperCase().slice(0, 40)
  if (role === 'lender' && regNo.length < 4) throw new ApiError("Add your regulator's registration or licence number (for example the RBI certificate number), so Kosha can verify your organisation.", 400)
  let cred
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password)
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/email-already-in-use') throw new ApiError('An account with this email already exists. Sign in instead.', 409)
    if ((e as { code?: string }).code === 'auth/weak-password') throw new ApiError('Use a password of at least 8 characters.', 400)
    throw e
  }
  const u: User = {
    id: cred.user.uid, role, name, email, org, createdAt: new Date().toISOString(),
    // New lenders see no shop data until Kosha verifies their organisation.
    ...(role === 'lender' ? { orgId: slug(org), status: 'pending' as const, orgType: input.orgType ?? 'other', regNo } : {}),
  }
  await setDoc(doc(db, 'users', u.id), plain(u))
  await audit(u, 'signup', { org, detail: `New ${role === 'lender' ? 'lender account, waiting for verification' : 'shop account'}` })
  return u
})

/** Ready-made accounts so anyone can explore every side without signing up. */
export const demoLogin = (role: Role) => run(async (): Promise<User> => {
  const email = DEMO_EMAIL[role === 'lender' || role === 'admin' ? role : 'business']
  const cred = await signInWithEmailAndPassword(auth, email, DEMO_PASSWORD)
  const u = await profileOf(cred.user)
  if (!u) throw new ApiError('The demo account is not set up yet.', 503)
  await audit(u, 'login', { org: u.org, detail: 'Signed in to the demo account' })
  return u
})

export const logout = () => run(async () => {
  await signOut(auth)
  return { ok: true as const }
})

/** Signs the account out on every device: sign-ins that started before now stop working. */
export const logoutAll = () => run(async () => {
  const u = await needUser()
  await updateDoc(doc(db, 'users', u.id), { signedOutBefore: new Date().toISOString() })
  await audit(u, 'logout_all', { detail: 'Signed out on all devices' })
  await signOut(auth)
  return { ok: true as const, ended: 1 }
})

// ───────────────────────── Kosha staff

async function needAdmin() {
  const u = await needUser()
  if (!can(u, 'lender:verify')) throw new ApiError(DENIED.staff, 403)
  return u
}

export const adminLenders = () => run(async (): Promise<LenderAccount[]> => {
  await needAdmin()
  const rank = { pending: 0, rejected: 1, verified: 2 }
  const s = await getDocs(query(collection(db, 'users'), where('role', '==', 'lender')))
  return s.docs
    .map((d) => d.data() as User)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, org: u.org, orgId: orgOf(u), status: u.status ?? 'pending', statusNote: u.statusNote, verifiedAt: u.verifiedAt, createdAt: u.createdAt, demo: u.demo, orgType: u.orgType, regNo: u.regNo, sandbox: u.sandbox }))
    .sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.localeCompare(a.createdAt))
})

export const verifyLender = (id: string, status: 'verified' | 'rejected', rawReason: string) => run(async (): Promise<LenderAccount[]> => {
  const admin = await needAdmin()
  const reason = String(rawReason ?? '').trim().slice(0, 400)
  const s = await getDoc(doc(db, 'users', id))
  const u = s.exists() ? (s.data() as User) : null
  if (!u || u.role !== 'lender') throw new ApiError('No lender account with that id.', 404)
  if (u.demo) throw new ApiError('The demo lender is always verified.', 409)
  if (status === 'rejected' && reason.length < 3) throw new ApiError('Add a short reason so the lender knows why.', 400)
  // A lender verified by the public demo admin is a sandbox lender: it can see demo passports only.
  const sandbox = !!admin.demo
  await updateDoc(doc(db, 'users', id), { status, statusNote: reason || deleteField(), verifiedAt: new Date().toISOString(), sandbox })
  // (a sandboxed approval cannot relabel a real organisation of the same name; the lender stays sandboxed anyway)
  if (status === 'verified') await setDoc(doc(db, 'orgs', orgOf(u)), { id: orgOf(u), org: u.org, orgType: u.orgType ?? 'other', regulated: !!u.regNo, sandbox }).catch((e) => { if (!sandbox) throw e })
  await audit(admin, status === 'verified' ? 'lender_verified' : 'lender_rejected', { targetId: id, org: u.org, detail: `${status === 'verified' ? 'Verified' : 'Rejected'} ${u.org} (${u.email})${reason ? `: ${reason}` : ''}` })
  orgs = null
  return adminLenders()
})

export const adminAudit = (f: { type?: AuditType | ''; q?: string } = {}) => run(async (): Promise<AuditEntry[]> => {
  const admin = await needAdmin()
  const s = await getDocs(query(collection(db, 'audit'), ...(admin.demo ? [where('demo', '==', true)] : []), orderBy('at', 'desc'), limit(1000)))
  const q = f.q?.trim().toLowerCase()
  return s.docs
    .map((d) => d.data() as AuditEntry)
    .filter((e) => !f.type || e.type === f.type)
    .filter((e) => !q || [e.actorName, e.org, e.detail, e.passportId].some((x) => x?.toLowerCase().includes(q)))
    .slice(0, 500)
})
