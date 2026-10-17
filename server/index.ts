// Kosha API + static web host. One container on Cloud Run serves both.
import 'dotenv/config'
import path from 'node:path'
import { existsSync } from 'node:fs'
import express, { type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import type { Consent, ConsentInput, DecisionStatus, DocKind, Profile, QuestionId, User } from '../shared/types.ts'
import { can, orgOf } from '../shared/policy.ts'
import { attachUser, AuthError, clearSession, demoUser, lenderAccounts, login, logoutAll, requireUser, sameOrigin, setLenderStatus, setSession, signup, verifiedOrgs } from './auth.ts'
import { audit, readAudit } from './audit.ts'
import { assess } from './assess.ts'
import { extract } from './extract.ts'
import { backend, configured, GeminiError, MODELS } from './gemini.ts'
import { readAnswer } from './interview.ts'
import { analyseLocation } from './location.ts'
import * as store from './store.ts'
import { speak } from './tts.ts'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)
app.use('/api', sameOrigin)
app.use(express.json({ limit: '4mb' }))
app.use((req, res, next) => void attachUser(req, res, next))

const KINDS: DocKind[] = ['ledger', 'invoice', 'payments', 'electricity', 'shopfront']
const MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|audio\/.+|video\/webm)$/
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => cb(null, MIME.test(file.mimetype)),
})

// Small per-IP budget so a public demo link cannot burn the Gemini quota. Cached answers are free.
const WINDOW = 60 * 60 * 1000
const BUDGET = Number(process.env.KOSHA_HOURLY_BUDGET ?? 80)
const hits = new Map<string, number[]>()
function limit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? 'anon'
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW)
  if (list.length >= BUDGET) return res.status(429).json({ error: 'Too many requests from this device. Try again in a little while.' })
  list.push(now)
  hits.set(ip, list)
  next()
}

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) =>
  fn(req, res).catch((e: unknown) => {
    const known = e instanceof GeminiError || e instanceof AuthError
    const status = known ? (e as GeminiError).status : 500
    if (!(e instanceof AuthError)) console.error('[api]', req.method, req.path, (e as Error).message)
    res.status(status).json({ error: known ? (e as Error).message : 'Something went wrong on our side. Please try again.' })
  })

function parseProfile(raw: unknown): Partial<Profile> {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : ((raw as Profile) ?? {})
  } catch {
    return {}
  }
}

const attempts = new Map<string, number[]>()
function authLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? 'anon', now = Date.now()
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < 15 * 60 * 1000)
  if (list.length >= 25) return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' })
  list.push(now)
  attempts.set(ip, list)
  next()
}
app.post('/api/auth/signup', authLimit, wrap(async (req, res) => { const u = await signup(req.body ?? {}); await setSession(req, res, u); res.status(201).json(u) }))
app.post('/api/auth/login', authLimit, wrap(async (req, res) => { const u = await login(req.body ?? {}); await setSession(req, res, u); res.json(u) }))
app.post('/api/auth/demo', authLimit, wrap(async (req, res) => { const u = await demoUser(String(req.body?.role)); await setSession(req, res, u); res.json(u) }))
app.post('/api/auth/logout', wrap(async (req, res) => { await clearSession(req, res); res.json({ ok: true }) }))
app.post('/api/auth/logout-all', requireUser(), wrap(async (req, res) => res.json({ ok: true, ended: await logoutAll(req, res) })))
app.get('/api/auth/me', (req, res) => res.json(req.user ?? null))

// Verified lender organisations a shop can choose to share with.
app.get('/api/lenders', requireUser(), wrap(async (_req, res) => res.json(await verifiedOrgs())))

app.get('/api/health', (_req, res) => res.json({ ok: true, gemini: configured, backend, models: MODELS }))

app.post(
  '/api/extract/:kind',
  requireUser('passport:create'),
  limit,
  upload.array('files', 8),
  wrap(async (req, res) => {
    const kind = req.params.kind as DocKind
    if (!KINDS.includes(kind)) return res.status(404).json({ error: 'Unknown document type.' })
    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    if (!files.length) return res.status(400).json({ error: 'Add at least one photo or PDF (JPG, PNG, WEBP, HEIC or PDF, up to 12 MB).' })
    const out = await extract(kind, files, parseProfile(req.body.profile))
    res.json({ kind, result: out.data, meta: out.meta })
  }),
)

app.post(
  '/api/location',
  requireUser('passport:create'),
  limit,
  wrap(async (req, res) => {
    const p = req.body?.profile as Profile
    if (!p?.address?.trim()) return res.status(400).json({ error: 'Add the shop address first.' })
    res.json(await analyseLocation(p))
  }),
)

app.post(
  '/api/interview/:id',
  requireUser('passport:create'),
  limit,
  upload.single('audio'),
  wrap(async (req, res) => {
    const audio = req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : undefined
    res.json(await readAnswer(req.params.id as QuestionId, parseProfile(req.body.profile), { audio, text: req.body.text }))
  }),
)

/** Checks the consent a shop sent. Selected lenders must be verified organisations. */
async function parseConsent(raw: unknown, allowNone: boolean): Promise<Consent> {
  const c = (raw ?? {}) as Partial<ConsentInput>
  const scopes = allowNone ? ['all', 'selected', 'none'] : ['all', 'selected']
  if (!c.scope || !scopes.includes(c.scope)) throw new AuthError('Choose who can see your full passport, and tick the consent box.')
  const known = new Set((await verifiedOrgs()).map((o) => o.id))
  const lenderIds = c.scope === 'selected' ? [...new Set((Array.isArray(c.lenderIds) ? c.lenderIds : []).map(String))].filter((id) => known.has(id)) : []
  if (c.scope === 'selected' && !lenderIds.length) throw new AuthError('Choose at least one lender, or share with all verified lenders.')
  return { scope: c.scope, lenderIds, publicShowsOffer: c.publicShowsOffer === true, at: new Date().toISOString(), version: 1 }
}
const describe = (c: Consent) => (c.scope === 'all' ? 'all verified lenders' : c.scope === 'selected' ? `${c.lenderIds.length} chosen lender${c.lenderIds.length === 1 ? '' : 's'}` : 'no lenders (withdrawn)') + (c.publicShowsOffer ? ', offer shown on the public link' : '')

app.post(
  '/api/assess',
  requireUser('passport:create'),
  limit,
  wrap(async (req, res) => {
    const { profile, docs = {}, location, interview, thumbnail } = req.body ?? {}
    if (!profile?.shopName) return res.status(400).json({ error: 'Add the shop details first.' })
    if (!docs.ledger) return res.status(400).json({ error: 'Read at least the ledger pages before building the passport.' })
    const consent = await parseConsent(req.body?.consent, false)
    const a = await assess({ profile, ...docs, location, interview }, typeof thumbnail === 'string' && thumbnail.length < 400_000 ? thumbnail : undefined)
    a.ownerId = req.user!.id
    a.consent = consent
    await store.save(a)
    await audit(req.user!, 'passport_issued', { passportId: a.id, org: req.user!.org, detail: `Issued and shared with ${describe(consent)}` })
    res.json(store.viewFor(a, req.user))
  }),
)

app.get('/api/passports', requireUser(['passport:read:own', 'passport:read:shared']), wrap(async (req, res) => res.json(await store.list(req.user))))
app.get(
  '/api/passports/:id',
  wrap(async (req, res) => {
    const a = await store.get(String(req.params.id))
    if (!a) return res.status(404).json({ error: 'No passport with that number.' })
    const view = store.viewFor(a, req.user)
    // Every full view by a lender goes in the shop's access log.
    if (req.user?.role === 'lender' && !('redacted' in view) && (await store.recordView(a.id, req.user))) {
      await audit(req.user, 'lender_view', { passportId: a.id, org: req.user.org, detail: `Opened the full passport of ${a.profile.shopName}` })
    }
    res.json(view)
  }),
)

const owned = async (req: Request, res: Response) => {
  const a = await store.get(String(req.params.id))
  if (!a) return void res.status(404).json({ error: 'No passport with that number.' })
  return a
}
app.put(
  '/api/passports/:id/consent',
  requireUser('passport:share'),
  wrap(async (req, res) => {
    const a = await owned(req, res)
    if (!a) return
    if (!can(req.user, 'passport:share', store.resourceOf(a))) return res.status(403).json({ error: 'Only the shop that owns this passport can change who sees it.' })
    const c = await parseConsent(req.body, true)
    const next = await store.setConsent(a.id, c)
    await audit(req.user!, 'consent', { passportId: a.id, org: req.user!.org, detail: `Now shared with ${describe(c)}` })
    res.json(store.viewFor(next!, req.user))
  }),
)

/** A shop reads the audit trail of its own passport; staff read any. */
app.get(
  '/api/passports/:id/audit',
  requireUser('audit:read'),
  wrap(async (req, res) => {
    const a = await owned(req, res)
    if (!a) return
    if (!can(req.user, 'audit:read', store.resourceOf(a))) return res.status(403).json({ error: 'This is not your passport.' })
    res.json(await readAudit({ passportId: a.id }))
  }),
)

const DECISIONS: DecisionStatus[] = ['approved', 'more_info', 'declined']
app.post(
  '/api/passports/:id/decision',
  requireUser('passport:decide'),
  wrap(async (req, res) => {
    const status = req.body?.status as DecisionStatus
    if (!DECISIONS.includes(status)) return res.status(400).json({ error: 'Choose approve, ask for documents or decline.' })
    const note = String(req.body?.note ?? '').trim().slice(0, 600)
    if (status !== 'approved' && note.length < 3) return res.status(400).json({ error: 'Add a short note so the shop knows what to do next.' })
    const u: User = req.user!
    const before = await owned(req, res)
    if (!before) return
    // Checked against this passport's consent, which the shop may have changed a moment ago.
    if (!can(u, 'passport:decide', store.resourceOf(before))) return res.status(403).json({ error: 'This shop has not shared its passport with your organisation.' })
    const a = await store.decide(before.id, { lenderId: u.id, orgId: orgOf(u), lenderName: u.name, org: u.org, status, note, at: new Date().toISOString() })
    await audit(u, 'decision', { passportId: before.id, org: u.org, detail: `${status === 'approved' ? 'Approved' : status === 'more_info' ? 'Asked for documents' : 'Declined'} ${before.profile.shopName}` })
    return a ? res.json(store.viewFor(a, u)) : res.status(404).json({ error: 'No passport with that number.' })
  }),
)

// ───────────────────────── Kosha staff

app.get('/api/admin/lenders', requireUser('lender:verify'), wrap(async (_req, res) => res.json(await lenderAccounts())))
app.post(
  '/api/admin/lenders/:id',
  requireUser('lender:verify'),
  wrap(async (req, res) => {
    const status = req.body?.status
    if (status !== 'verified' && status !== 'rejected') return res.status(400).json({ error: 'Choose approve or reject.' })
    await setLenderStatus(req.user!, String(req.params.id), status, String(req.body?.reason ?? '').trim().slice(0, 400))
    res.json(await lenderAccounts())
  }),
)
app.get(
  '/api/admin/audit',
  requireUser('audit:read'),
  wrap(async (req, res) => {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'This is for Kosha staff.' })
    res.json(await readAudit({ type: req.query.type ? String(req.query.type) : undefined, q: req.query.q ? String(req.query.q) : undefined }))
  }),
)

app.post(
  '/api/tts',
  requireUser(),
  limit,
  wrap(async (req, res) => {
    const wav = await speak(String(req.body?.text ?? ''))
    res.set('content-type', 'audio/wav').set('cache-control', 'public, max-age=86400').send(wav)
  }),
)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))

// Static web app (production build).
const WEB = path.resolve(process.env.KOSHA_WEB_DIR ?? 'dist/web')
if (existsSync(WEB)) {
  app.use(express.static(WEB, { index: false, maxAge: '1h' }))
  app.get(/.*/, (_req, res) => res.sendFile(path.join(WEB, 'index.html')))
}

const port = Number(process.env.PORT ?? 8080)
app.listen(port, () => console.log(`Kosha on :${port} · Gemini ${configured ? `${backend} (${MODELS.join(', ')})` : 'NOT CONFIGURED'}`))
