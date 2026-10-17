// Accounts and sessions. Passwords are hashed with scrypt. The cookie holds only a random session id;
// the session lives on the server, and the user's role and verification are read fresh on every request,
// so verifying a lender or signing out everywhere takes effect at once.
// Users and sessions live in Firestore on Cloud Run (KOSHA_STORE=firestore) and in JSON files locally.
import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { NextFunction, Request, Response } from 'express'
import type { LenderAccount, LenderOrg, LenderStatus, User } from '../shared/types.ts'
import { can, orgOf, slug, type PassportResource, type Permission } from '../shared/policy.ts'
import { audit } from './audit.ts'
import { collection, DATA, readJson, serial, useFirestore, writeJson } from './db.ts'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>
const USERS = path.join(DATA, 'users.json')
const SESSIONS = path.join(DATA, 'sessions.json')
const COOKIE = 'kosha_session'
const WEEK = 7 * 24 * 3600

function loadSecret(): Buffer {
  if (process.env.KOSHA_SECRET) return Buffer.from(process.env.KOSHA_SECRET)
  const f = path.join(DATA, 'secret')
  try {
    return Buffer.from(readFileSync(f, 'utf8'), 'hex')
  } catch {
    const s = randomBytes(32)
    try {
      mkdirSync(DATA, { recursive: true })
      writeFileSync(f, s.toString('hex'))
    } catch { /* read-only disk: sessions last until restart */ }
    return s
  }
}
const SECRET = loadSecret()

/**
 * A short code that seals a passport's public facts (id, score, band, status, issue date). It is printed
 * on the passport and carried in its QR code; if a printout is edited, the code no longer matches.
 */
export function sealOf(p: { id: string; score: number; band: string; status: string; createdAt: string }) {
  const h = createHmac('sha256', SECRET).update(['seal', p.id, p.score, p.band, p.status, p.createdAt].join('|')).digest('hex').slice(0, 8).toUpperCase()
  return `${h.slice(0, 4)}-${h.slice(4)}`
}

/** Ready-made accounts so anyone can explore every side without signing up. */
export const DEMO_USERS: User[] = [
  { id: 'demo-shop', role: 'business', name: 'Sunita Sharma', email: 'shop@demo.kosha', org: 'Sharma General Store', createdAt: '2026-10-01T00:00:00.000Z', demo: true },
  { id: 'demo-nena', role: 'business', name: 'Nena Dizon', email: 'nena@demo.kosha', org: "Nena's Sari-Sari Store", createdAt: '2026-10-01T00:00:00.000Z', demo: true },
  { id: 'demo-lender', role: 'lender', name: 'Arjun Mehta', email: 'lender@demo.kosha', org: 'Pune Merchants Co-operative Bank', orgId: 'pune-merchants-co-op', status: 'verified', verifiedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', demo: true },
  { id: 'demo-admin', role: 'admin', name: 'Meera Iyer', email: 'admin@demo.kosha', org: 'Kosha Operations', createdAt: '2026-10-01T00:00:00.000Z', demo: true },
]

interface Stored extends User { hash: string }
const pub = ({ hash: _h, ...u }: Stored): User => u

// ───────────────────────── users

const readAll = () => readJson<Stored[]>(USERS, [])
async function byEmail(email: string): Promise<Stored | null> {
  if (useFirestore) {
    const s = await (await collection('users')).where('email', '==', email).limit(1).get()
    return (s.docs[0]?.data() as Stored) ?? null
  }
  return (await readAll()).find((u) => u.email === email) ?? null
}
async function storedById(id: string): Promise<Stored | null> {
  if (useFirestore) {
    const d = await (await collection('users')).doc(id).get()
    return d.exists ? (d.data() as Stored) : null
  }
  return (await readAll()).find((x) => x.id === id) ?? null
}
/** Always read fresh: a lender's verification can change between two requests. */
export async function byId(id: string): Promise<User | null> {
  const demo = DEMO_USERS.find((u) => u.id === id)
  if (demo) return demo
  const u = await storedById(id)
  return u ? pub(u) : null
}
async function insert(u: Stored) {
  if (useFirestore) return void (await (await collection('users')).doc(u.id).set(u))
  await serial(async () => writeJson(USERS, [...(await readAll()), u]))
}
async function update(id: string, patch: Partial<User>): Promise<User | null> {
  if (useFirestore) {
    const u = await storedById(id)
    if (!u) return null
    const next = { ...u, ...patch }
    await (await collection('users')).doc(id).set(next)
    return pub(next)
  }
  return serial(async () => {
    const all = await readAll()
    const i = all.findIndex((x) => x.id === id)
    if (i < 0) return null
    all[i] = { ...all[i], ...patch }
    await writeJson(USERS, all)
    return pub(all[i])
  })
}

// ───────────────────────── lender organisations

async function lenderUsers(): Promise<User[]> {
  const stored = useFirestore
    ? ((await (await collection('users')).where('role', '==', 'lender').get()).docs.map((d) => d.data() as Stored))
    : (await readAll()).filter((u) => u.role === 'lender')
  return [...DEMO_USERS.filter((u) => u.role === 'lender'), ...stored.map(pub)]
}

/** Verified organisations a shop can share with, one entry per organisation. */
export async function verifiedOrgs(): Promise<LenderOrg[]> {
  const seen = new Map<string, LenderOrg>()
  for (const u of await lenderUsers()) if (u.status === 'verified' && !seen.has(orgOf(u))) seen.set(orgOf(u), { id: orgOf(u), org: u.org })
  return [...seen.values()].sort((a, b) => a.org.localeCompare(b.org))
}

export async function lenderAccounts(): Promise<LenderAccount[]> {
  const rank = { pending: 0, rejected: 1, verified: 2 }
  return (await lenderUsers())
    .map((u) => ({ id: u.id, name: u.name, email: u.email, org: u.org, orgId: orgOf(u), status: u.status ?? 'pending', statusNote: u.statusNote, verifiedAt: u.verifiedAt, createdAt: u.createdAt, demo: u.demo }))
    .sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.localeCompare(a.createdAt))
}

export async function setLenderStatus(admin: User, id: string, status: LenderStatus, note: string): Promise<User> {
  if (DEMO_USERS.some((u) => u.id === id)) throw new AuthError('The demo lender is always verified.', 409)
  const u = await byId(id)
  if (!u || u.role !== 'lender') throw new AuthError('No lender account with that id.', 404)
  if (status === 'rejected' && note.length < 3) throw new AuthError('Add a short reason so the lender knows why.')
  const next = await update(id, { status, statusNote: note || undefined, verifiedAt: new Date().toISOString() })
  await audit(admin, status === 'verified' ? 'lender_verified' : 'lender_rejected', { targetId: id, org: u.org, detail: `${status === 'verified' ? 'Verified' : 'Rejected'} ${u.org} (${u.email})${note ? `: ${note}` : ''}` })
  return next!
}

// ───────────────────────── passwords

async function hashPassword(pw: string) {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 64)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}
async function verifyPassword(pw: string, stored: string) {
  const [, salt, key] = stored.split('$')
  if (!salt || !key) return false
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), 64)
  const want = Buffer.from(key, 'base64')
  return got.length === want.length && timingSafeEqual(got, want)
}

// ───────────────────────── sessions

interface Session { uid: string; createdAt: string; expiresAt: string }
/** The store keys sessions by a keyed hash, so a copy of it cannot be replayed as cookies. */
const keyOf = (token: string) => createHmac('sha256', SECRET).update(token).digest('hex')

let memo: Map<string, Session> | null = null
async function fileSessions() {
  if (!memo) {
    const now = new Date().toISOString()
    memo = new Map(Object.entries(await readJson<Record<string, Session>>(SESSIONS, {})).filter(([, s]) => s.expiresAt > now))
  }
  return memo
}
const persist = () => serial(async () => writeJson(SESSIONS, Object.fromEntries(memo ?? [])))

async function getSession(key: string): Promise<Session | null> {
  let s: Session | null
  if (useFirestore) {
    const d = await (await collection('sessions')).doc(key).get()
    s = d.exists ? (d.data() as Session) : null
  } else s = (await fileSessions()).get(key) ?? null
  return s && s.expiresAt > new Date().toISOString() ? s : null
}
async function putSession(key: string, s: Session) {
  if (useFirestore) return void (await (await collection('sessions')).doc(key).set(s))
  ;(await fileSessions()).set(key, s)
  await persist()
}
async function dropSession(key: string) {
  if (useFirestore) return void (await (await collection('sessions')).doc(key).delete())
  if ((await fileSessions()).delete(key)) await persist()
}
/** Signs the user out on every device. Returns how many sessions ended. */
async function dropAll(uid: string): Promise<number> {
  if (useFirestore) {
    const snap = await (await collection('sessions')).where('uid', '==', uid).get()
    await Promise.all(snap.docs.map((d) => d.ref.delete()))
    return snap.docs.length
  }
  const all = await fileSessions()
  let n = 0
  for (const [k, s] of all) if (s.uid === uid && all.delete(k)) n++
  await persist()
  return n
}

function cookie(req: Request): string | null {
  const m = new RegExp(`(?:^|; )${COOKIE}=([^;]+)`).exec(req.headers.cookie ?? '')
  return m ? decodeURIComponent(m[1]) : null
}
export async function setSession(req: Request, res: Response, u: User) {
  // A new sign-in on this browser replaces the old session, so a fixed or stolen id stops working.
  const old = cookie(req)
  if (old) await dropSession(keyOf(old))
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  await putSession(keyOf(token), { uid: u.id, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + WEEK * 1000).toISOString() })
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${WEEK}${secure ? '; Secure' : ''}`)
}
export async function clearSession(req: Request, res: Response) {
  const t = cookie(req)
  if (t) await dropSession(keyOf(t))
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}
export async function logoutAll(req: Request, res: Response) {
  const u = req.user!
  const n = await dropAll(u.id)
  await clearSession(req, res)
  await audit(u, 'logout_all', { detail: `Signed out on all devices (${n} session${n === 1 ? '' : 's'})` })
  return n
}

// ───────────────────────── middleware

declare module 'express-serve-static-core' {
  interface Request { user?: User }
}
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const t = cookie(req)
  const s = t ? await getSession(keyOf(t)).catch(() => null) : null
  if (s) req.user = (await byId(s.uid).catch(() => null)) ?? undefined
  next()
}

const DENIED: Partial<Record<Permission, string>> = {
  'passport:create': 'This is for shop accounts.',
  'passport:read:own': 'This is for shop accounts.',
  'passport:share': 'Only the shop that owns this passport can change who sees it.',
  'passport:read:shared': 'Your organisation is not verified yet, or this shop has not shared its passport with you.',
  'passport:decide': 'Your organisation is not verified yet, or this shop has not shared its passport with you.',
  'lender:verify': 'This is for Kosha staff.',
  'audit:read': 'This is for Kosha staff.',
}
/** Rejects signed-out visitors (401) and anyone the policy does not allow (403). */
export const requireUser = (need?: Permission | Permission[], resource?: (req: Request) => PassportResource | undefined) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in first.' })
  const list = need ? ([] as Permission[]).concat(need) : []
  const ok = !list.length || list.some((p) => can(req.user, p, resource?.(req)))
  if (!ok) return res.status(403).json({ error: DENIED[list[0]] ?? 'You do not have access to this.' })
  next()
}

/**
 * Cross-site request forgery guard: a state-changing request must come from this site.
 * Browsers always send Origin (or at least Referer and Sec-Fetch-Site) on such requests; a request with
 * none of them comes from a tool like curl, which cannot ride on a visitor's cookie.
 */
// The Vite dev server proxies /api with a rewritten Host, so in development its own address counts as this site.
const ALLOWED_HOSTS = (process.env.KOSHA_ALLOWED_HOSTS ?? (process.env.NODE_ENV === 'production' ? '' : 'localhost:5173,127.0.0.1:5173,localhost:4173')).split(',')
export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const from = req.headers.origin ?? req.headers.referer
  const site = req.headers['sec-fetch-site']
  const deny = () => res.status(403).json({ error: 'This request came from another website, so Kosha refused it.' })
  if (!from) return site && site !== 'same-origin' && site !== 'none' ? deny() : next()
  let host: string
  try {
    host = new URL(from).host
  } catch {
    return deny()
  }
  const allowed = new Set([req.headers.host, ...String(req.headers['x-forwarded-host'] ?? '').split(','), ...ALLOWED_HOSTS].map((h) => h?.trim()).filter(Boolean))
  return allowed.has(host) ? next() : deny()
}

// ───────────────────────── sign-up and sign-in

export class AuthError extends Error {
  status: number
  constructor(m: string, s = 400) { super(m); this.status = s }
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function signup(input: { role?: string; name?: string; email?: string; password?: string; org?: string }): Promise<User> {
  const role = input.role === 'lender' ? 'lender' : input.role === 'business' ? 'business' : null
  const name = (input.name ?? '').trim()
  const email = (input.email ?? '').trim().toLowerCase()
  const org = (input.org ?? '').trim()
  const password = input.password ?? ''
  if (!role) throw new AuthError('Choose whether you run a shop or work for a lender.')
  if (name.length < 2) throw new AuthError('Add your name.')
  if (!EMAIL.test(email)) throw new AuthError('That email address does not look right.')
  if (password.length < 8) throw new AuthError('Use a password of at least 8 characters.')
  if (org.length < 2) throw new AuthError(role === 'lender' ? 'Add the name of your bank or lender.' : 'Add your shop name.')
  if (DEMO_USERS.some((u) => u.email === email) || (await byEmail(email))) throw new AuthError('An account with this email already exists. Sign in instead.', 409)
  const u: Stored = {
    id: randomUUID(), role, name, email, org, createdAt: new Date().toISOString(), hash: await hashPassword(password),
    // New lenders see no shop data until Kosha verifies their organisation.
    ...(role === 'lender' ? { orgId: slug(org), status: 'pending' as const } : {}),
  }
  await insert(u)
  await audit(pub(u), 'signup', { org, detail: `New ${role === 'lender' ? 'lender account, waiting for verification' : 'shop account'}` })
  return pub(u)
}

// Five wrong passwords lock the email for 15 minutes, whatever device or address they came from.
const LOCK_MS = 15 * 60 * 1000
const MAX_FAILS = 5
const fails = new Map<string, { at: number[]; until: number }>()
function lockMessage(until: number) {
  const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000))
  return `Too many wrong passwords for this email, so it is locked for ${mins} more minute${mins === 1 ? '' : 's'}. Try again later.`
}

export async function login(input: { email?: string; password?: string }): Promise<User> {
  const email = (input.email ?? '').trim().toLowerCase()
  const f = fails.get(email)
  if (f && f.until > Date.now()) throw new AuthError(lockMessage(f.until), 429)
  const demo = DEMO_USERS.find((u) => u.email === email)
  let user: User | null = null
  if (demo) user = input.password === (process.env.KOSHA_DEMO_PASSWORD ?? 'kosha-demo') ? demo : null
  else {
    const u = await byEmail(email)
    user = u && (await verifyPassword(input.password ?? '', u.hash)) ? pub(u) : null
  }
  if (user) {
    fails.delete(email)
    await audit(user, 'login', { org: user.org, detail: 'Signed in with password' })
    return user
  }
  const at = [...(f?.at ?? []), Date.now()].filter((t) => Date.now() - t < LOCK_MS)
  const until = at.length >= MAX_FAILS ? Date.now() + LOCK_MS : 0
  fails.set(email, { at: until ? [] : at, until })
  await audit(null, until ? 'login_locked' : 'login_failed', { detail: `${until ? 'Locked after 5 wrong passwords' : 'Wrong password'} for ${email}` })
  if (until) throw new AuthError(lockMessage(until), 429)
  throw new AuthError('Email or password is incorrect.', 401)
}

export async function demoUser(role: string) {
  const u = DEMO_USERS.find((x) => x.role === (role === 'lender' || role === 'admin' ? role : 'business'))!
  await audit(u, 'login', { org: u.org, detail: 'Signed in to the demo account' })
  return u
}

export const usersFileExists = () => existsSync(USERS)
