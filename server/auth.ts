// Accounts and sessions. Passwords are hashed with scrypt; sessions are HMAC-signed cookies.
// Users live in Firestore on Cloud Run (KOSHA_STORE=firestore) and in a JSON file locally.
import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import type { NextFunction, Request, Response } from 'express'
import type { Role, User } from '../shared/types.ts'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>
const DATA = path.resolve(process.env.KOSHA_DATA_ROOT ?? '.data')
const USERS = path.join(DATA, 'users.json')
const useFirestore = process.env.KOSHA_STORE === 'firestore'
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

/** Ready-made accounts so anyone can explore both sides without signing up. */
export const DEMO_USERS: User[] = [
  { id: 'demo-shop', role: 'business', name: 'Sunita Sharma', email: 'shop@demo.kosha', org: 'Sharma General Store', createdAt: '2026-10-01T00:00:00.000Z', demo: true },
  { id: 'demo-nena', role: 'business', name: 'Nena Dizon', email: 'nena@demo.kosha', org: "Nena's Sari-Sari Store", createdAt: '2026-10-01T00:00:00.000Z', demo: true },
  { id: 'demo-lender', role: 'lender', name: 'Arjun Mehta', email: 'lender@demo.kosha', org: 'Pune Merchants Co-operative Bank', createdAt: '2026-10-01T00:00:00.000Z', demo: true },
]

interface Stored extends User { hash: string }

// ───────────────────────── user storage

type Col = { doc(id: string): { set(d: object): Promise<unknown>; get(): Promise<{ exists: boolean; data(): unknown }> }; where(f: string, op: string, v: string): { limit(n: number): { get(): Promise<{ docs: { data(): unknown }[] }> } } }
let col: Col | null = null
async function users(): Promise<Col> {
  if (!col) {
    const mod = (await import('@google-cloud/firestore' as string)) as { Firestore: new () => { collection(n: string): Col } }
    col = new mod.Firestore().collection('users')
  }
  return col
}
async function readAll(): Promise<Stored[]> {
  try { return JSON.parse(await readFile(USERS, 'utf8')) } catch { return [] }
}
async function byEmail(email: string): Promise<Stored | null> {
  if (useFirestore) {
    const s = await (await users()).where('email', '==', email).limit(1).get()
    return (s.docs[0]?.data() as Stored) ?? null
  }
  return (await readAll()).find((u) => u.email === email) ?? null
}
const cache = new Map<string, User>()
export async function byId(id: string): Promise<User | null> {
  const demo = DEMO_USERS.find((u) => u.id === id)
  if (demo) return demo
  if (cache.has(id)) return cache.get(id)!
  let u: Stored | null = null
  if (useFirestore) {
    const d = await (await users()).doc(id).get()
    u = d.exists ? (d.data() as Stored) : null
  } else u = (await readAll()).find((x) => x.id === id) ?? null
  if (!u) return null
  const { hash: _h, ...pub } = u
  cache.set(id, pub)
  return pub
}
async function insert(u: Stored) {
  if (useFirestore) return void (await (await users()).doc(u.id).set(u))
  const all = await readAll()
  all.push(u)
  await mkdir(DATA, { recursive: true })
  await writeFile(USERS, JSON.stringify(all, null, 2))
}

// ───────────────────────── passwords and tokens

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
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')
function sign(uid: string, role: Role) {
  const body = b64u(JSON.stringify({ uid, role, exp: Math.floor(Date.now() / 1000) + WEEK }))
  return `${body}.${b64u(createHmac('sha256', SECRET).update(body).digest())}`
}
function verify(token: string): { uid: string; role: Role } | null {
  const [body, mac] = token.split('.')
  if (!body || !mac) return null
  const want = createHmac('sha256', SECRET).update(body).digest()
  const got = Buffer.from(mac, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return p.exp > Date.now() / 1000 ? p : null
  } catch {
    return null
  }
}
function cookie(req: Request): string | null {
  const m = new RegExp(`(?:^|; )${COOKIE}=([^;]+)`).exec(req.headers.cookie ?? '')
  return m ? decodeURIComponent(m[1]) : null
}
export function setSession(req: Request, res: Response, u: User) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.setHeader('Set-Cookie', `${COOKIE}=${sign(u.id, u.role)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${WEEK}${secure ? '; Secure' : ''}`)
}
export function clearSession(res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

// ───────────────────────── middleware

declare module 'express-serve-static-core' {
  interface Request { user?: User }
}
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const t = cookie(req)
  const p = t ? verify(t) : null
  if (p) req.user = (await byId(p.uid).catch(() => null)) ?? undefined
  next()
}
export const requireUser = (role?: Role) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in first.' })
  if (role && req.user.role !== role) return res.status(403).json({ error: role === 'lender' ? 'This is for lender accounts.' : 'This is for shop accounts.' })
  next()
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
  const u: Stored = { id: randomUUID(), role, name, email, org, createdAt: new Date().toISOString(), hash: await hashPassword(password) }
  await insert(u)
  const { hash: _h, ...pub } = u
  return pub
}

export async function login(input: { email?: string; password?: string }): Promise<User> {
  const email = (input.email ?? '').trim().toLowerCase()
  const demo = DEMO_USERS.find((u) => u.email === email)
  if (demo && input.password === (process.env.KOSHA_DEMO_PASSWORD ?? 'kosha-demo')) return demo
  const u = await byEmail(email)
  if (!u || !(await verifyPassword(input.password ?? '', u.hash))) throw new AuthError('Email or password is incorrect.', 401)
  const { hash: _h, ...pub } = u
  return pub
}

export const demoUser = (role: string) => DEMO_USERS.find((u) => u.role === (role === 'lender' ? 'lender' : 'business'))!

export const usersFileExists = () => existsSync(USERS)
