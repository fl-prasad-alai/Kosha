// One place for every Gemini call: client setup (AI Studio key or Vertex AI), model fallback,
// retries on overload, JSON parsing and a content-addressed disk cache.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GoogleGenAI, type Part, type Tool, type GenerateContentResponse } from '@google/genai'
import type { CallMeta } from '../shared/types.ts'

const useVertex = /^(1|true)$/i.test(process.env.GOOGLE_GENAI_USE_VERTEXAI ?? '')
export const ai = useVertex
  ? new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? 'global',
    })
  : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })

export const backend = useVertex ? 'vertex' : 'ai-studio'
export const configured = useVertex ? !!process.env.GOOGLE_CLOUD_PROJECT : !!process.env.GEMINI_API_KEY

export const MODELS = (process.env.GEMINI_MODELS ?? 'gemini-3-flash-preview,gemini-2.5-flash,gemini-3.5-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)

const CACHE_DIRS = [path.resolve('cache'), path.resolve('.cache')] // cache/ ships baked sample results; .cache is local
const WRITE_DIR = process.env.KOSHA_CACHE_DIR ?? path.resolve('.cache')

export let callCount = 0

export class GeminiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

export function inline(data: Buffer, mimeType: string): Part {
  return { inlineData: { data: data.toString('base64'), mimeType } }
}

interface CallOptions {
  /** Stable name for the cache key and logs, e.g. "ledger.v3". */
  task: string
  system: string
  parts: Part[]
  schema?: object
  tools?: Tool[]
  toolConfig?: object
  temperature?: number
  maxOutputTokens?: number
  /** Skip the cache, e.g. for grounded calls whose answer should be fresh. */
  noCache?: boolean
  models?: string[]
}

export interface CallResult<T> {
  data: T
  meta: CallMeta
  raw?: GenerateContentResponse
  grounding?: unknown
}

function cacheKey(o: CallOptions): string {
  const h = createHash('sha256')
  h.update(o.task)
  h.update(o.system)
  h.update(JSON.stringify(o.schema ?? null))
  for (const p of o.parts) h.update(p.text ?? p.inlineData?.data ?? '')
  return h.digest('hex').slice(0, 40)
}

async function readCache<T>(key: string): Promise<CallResult<T> | null> {
  for (const dir of CACHE_DIRS) {
    try {
      const hit = JSON.parse(await readFile(path.join(dir, `${key}.json`), 'utf8'))
      return { data: hit.data, meta: { ...hit.meta, cached: true }, grounding: hit.grounding }
    } catch {
      /* not cached here */
    }
  }
  return null
}

async function writeCache(key: string, value: object) {
  try {
    await mkdir(WRITE_DIR, { recursive: true })
    await writeFile(path.join(WRITE_DIR, `${key}.json`), JSON.stringify(value))
  } catch (e) {
    console.warn('[gemini] cache write failed', (e as Error).message)
  }
}

/** Pulls the first JSON object or array out of model text (handles ```json fences). */
export function parseJson<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(t)
  } catch {
    const start = t.search(/[[{]/)
    const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1))
    throw new GeminiError('Gemini returned text that is not JSON.')
  }
}

function thinkingFor(model: string) {
  if (/gemini-2\.5/.test(model)) return { thinkingBudget: 1024 }
  if (/gemini-[3-9]/.test(model)) return { thinkingLevel: 'LOW' as never }
  return undefined
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Calls Gemini, trying each model in turn. Retries 429/5xx twice per model with backoff. */
export async function generate<T>(o: CallOptions): Promise<CallResult<T>> {
  const key = cacheKey(o)
  if (!o.noCache) {
    const hit = await readCache<T>(key)
    if (hit) return hit
  }
  if (!configured) throw new GeminiError('Gemini is not configured. Set GEMINI_API_KEY or Vertex AI variables.', 503)

  const models = o.models ?? MODELS
  let lastErr: unknown
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = Date.now()
      try {
        callCount++
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: o.parts }],
          config: {
            systemInstruction: o.system,
            temperature: o.temperature ?? 0.1,
            maxOutputTokens: o.maxOutputTokens ?? 16384,
            ...(o.schema && !o.tools ? { responseMimeType: 'application/json', responseJsonSchema: o.schema } : {}),
            ...(o.tools ? { tools: o.tools } : {}),
            ...(o.toolConfig ? { toolConfig: o.toolConfig } : {}),
            thinkingConfig: thinkingFor(model),
          },
        })
        const text = res.text ?? ''
        if (!text) throw new GeminiError(`Empty response (${res.candidates?.[0]?.finishReason ?? 'no candidate'})`)
        const data = parseJson<T>(text)
        const meta: CallMeta = {
          model,
          ms: Date.now() - t0,
          tokensIn: res.usageMetadata?.promptTokenCount ?? 0,
          tokensOut: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
          cached: false,
        }
        const grounding = res.candidates?.[0]?.groundingMetadata
        if (!o.noCache) await writeCache(key, { task: o.task, data, meta, grounding })
        console.log(`[gemini] ${o.task} ${model} ${meta.ms}ms in=${meta.tokensIn} out=${meta.tokensOut}`)
        return { data, meta, raw: res, grounding }
      } catch (e) {
        lastErr = e
        const status = (e as { status?: number }).status ?? 0
        const msg = (e as Error).message ?? ''
        console.warn(`[gemini] ${o.task} ${model} attempt ${attempt + 1} failed: ${status} ${msg.slice(0, 160)}`)
        const retryable = status === 429 || status >= 500 || /overloaded|high demand|UNAVAILABLE|not JSON|Empty response/i.test(msg)
        if (!retryable) break // e.g. 404 model, 400 bad request: move to the next model
        if (status === 429 && /quota/i.test(msg)) break // daily quota: another model has its own
        await sleep((status === 503 ? 1500 : 800) * (attempt + 1) ** 2)
      }
    }
  }
  const msg = (lastErr as Error)?.message ?? 'unknown error'
  const quota = /quota|429|RESOURCE_EXHAUSTED/.test(msg)
  const busy = /503|UNAVAILABLE|high demand|overloaded/i.test(msg)
  throw new GeminiError(
    quota
      ? 'Gemini has reached its usage limit for now. Wait a minute and try again.'
      : busy
        ? 'Gemini is very busy right now. Wait a few seconds and try again.'
        : 'Gemini could not finish reading this. Try again, or use a clearer photo.',
    quota ? 429 : busy ? 503 : 502,
  )
}
