// Kosha API + static web host. One container on Cloud Run serves both.
import 'dotenv/config'
import path from 'node:path'
import { existsSync } from 'node:fs'
import express, { type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import type { DecisionStatus, DocKind, Profile, QuestionId } from '../shared/types.ts'
import { attachUser, AuthError, clearSession, demoUser, login, requireUser, setSession, signup } from './auth.ts'
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
app.post('/api/auth/signup', authLimit, wrap(async (req, res) => { const u = await signup(req.body ?? {}); setSession(req, res, u); res.status(201).json(u) }))
app.post('/api/auth/login', authLimit, wrap(async (req, res) => { const u = await login(req.body ?? {}); setSession(req, res, u); res.json(u) }))
app.post('/api/auth/demo', authLimit, wrap(async (req, res) => { const u = demoUser(String(req.body?.role)); setSession(req, res, u); res.json(u) }))
app.post('/api/auth/logout', (_req, res) => { clearSession(res); res.json({ ok: true }) })
app.get('/api/auth/me', (req, res) => res.json(req.user ?? null))

app.get('/api/health', (_req, res) => res.json({ ok: true, gemini: configured, backend, models: MODELS }))

app.post(
  '/api/extract/:kind',
  requireUser('business'),
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
  requireUser('business'),
  limit,
  wrap(async (req, res) => {
    const p = req.body?.profile as Profile
    if (!p?.address?.trim()) return res.status(400).json({ error: 'Add the shop address first.' })
    res.json(await analyseLocation(p))
  }),
)

app.post(
  '/api/interview/:id',
  requireUser('business'),
  limit,
  upload.single('audio'),
  wrap(async (req, res) => {
    const audio = req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : undefined
    res.json(await readAnswer(req.params.id as QuestionId, parseProfile(req.body.profile), { audio, text: req.body.text }))
  }),
)

app.post(
  '/api/assess',
  requireUser('business'),
  limit,
  wrap(async (req, res) => {
    const { profile, docs = {}, location, interview, thumbnail } = req.body ?? {}
    if (!profile?.shopName) return res.status(400).json({ error: 'Add the shop details first.' })
    if (!docs.ledger) return res.status(400).json({ error: 'Read at least the ledger pages before building the passport.' })
    const a = await assess({ profile, ...docs, location, interview }, typeof thumbnail === 'string' && thumbnail.length < 400_000 ? thumbnail : undefined)
    a.ownerId = req.user!.id
    await store.save(a)
    res.json(a)
  }),
)

app.get('/api/passports', requireUser(), wrap(async (req, res) => res.json(await store.list(req.user))))
app.get(
  '/api/passports/:id',
  wrap(async (req, res) => {
    const a = await store.get(String(req.params.id))
    if (!a) return res.status(404).json({ error: 'No passport with that number.' })
    // Anyone with the link can verify a passport; lender notes are only for the owner and lenders.
    const canSeeDecisions = req.user && (req.user.role === 'lender' || store.ownerOf(a) === req.user.id)
    res.json(canSeeDecisions ? { ...a, ownerId: store.ownerOf(a) } : { ...a, decisions: undefined, ownerId: undefined })
  }),
)
const DECISIONS: DecisionStatus[] = ['approved', 'more_info', 'declined']
app.post(
  '/api/passports/:id/decision',
  requireUser('lender'),
  wrap(async (req, res) => {
    const status = req.body?.status as DecisionStatus
    if (!DECISIONS.includes(status)) return res.status(400).json({ error: 'Choose approve, ask for documents or decline.' })
    const note = String(req.body?.note ?? '').trim().slice(0, 600)
    if (status !== 'approved' && note.length < 3) return res.status(400).json({ error: 'Add a short note so the shop knows what to do next.' })
    const u = req.user!
    const a = await store.decide(String(req.params.id), { lenderId: u.id, lenderName: u.name, org: u.org, status, note, at: new Date().toISOString() })
    return a ? res.json({ ...a, ownerId: store.ownerOf(a) }) : res.status(404).json({ error: 'No passport with that number.' })
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
