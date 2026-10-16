// Kosha API + static web host. One container on Cloud Run serves both.
import 'dotenv/config'
import path from 'node:path'
import { existsSync } from 'node:fs'
import express, { type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import type { DocKind, Profile, QuestionId } from '../shared/types.ts'
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
    const status = e instanceof GeminiError ? e.status : 500
    console.error('[api]', req.method, req.path, (e as Error).message)
    res.status(status).json({ error: e instanceof GeminiError ? e.message : 'Something went wrong on our side. Please try again.' })
  })

function parseProfile(raw: unknown): Partial<Profile> {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : ((raw as Profile) ?? {})
  } catch {
    return {}
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, gemini: configured, backend, models: MODELS }))

app.post(
  '/api/extract/:kind',
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
  limit,
  wrap(async (req, res) => {
    const p = req.body?.profile as Profile
    if (!p?.address?.trim()) return res.status(400).json({ error: 'Add the shop address first.' })
    res.json(await analyseLocation(p))
  }),
)

app.post(
  '/api/interview/:id',
  limit,
  upload.single('audio'),
  wrap(async (req, res) => {
    const audio = req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : undefined
    res.json(await readAnswer(req.params.id as QuestionId, parseProfile(req.body.profile), { audio, text: req.body.text }))
  }),
)

app.post(
  '/api/assess',
  limit,
  wrap(async (req, res) => {
    const { profile, docs = {}, location, interview, thumbnail } = req.body ?? {}
    if (!profile?.shopName) return res.status(400).json({ error: 'Add the shop details first.' })
    if (!docs.ledger) return res.status(400).json({ error: 'Read at least the ledger pages before building the passport.' })
    const a = await assess({ profile, ...docs, location, interview }, typeof thumbnail === 'string' && thumbnail.length < 400_000 ? thumbnail : undefined)
    await store.save(a)
    res.json(a)
  }),
)

app.get('/api/passports', wrap(async (_req, res) => res.json(await store.list())))
app.get(
  '/api/passports/:id',
  wrap(async (req, res) => {
    const a = await store.get(String(req.params.id))
    return a ? res.json(a) : res.status(404).json({ error: 'No passport with that number.' })
  }),
)

app.post(
  '/api/tts',
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
