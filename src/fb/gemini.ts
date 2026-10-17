// One place for every Gemini call: the Gemini API from the browser (Google AI Studio key), model fallback,
// retries on overload, JSON parsing and a content-addressed cache. The bundled sample results ship as
// static files under /cache, so the sample shops never spend a Gemini call.
import { GoogleGenAI, type Part, type Tool, type GenerateContentResponse } from '@google/genai'
import type { CallMeta } from '@shared/types'

const KEY = import.meta.env.VITE_GEMINI_API_KEY ?? ''
export const ai = new GoogleGenAI({ apiKey: KEY })

export const backend = 'ai-studio'
export const configured = !!KEY

export const MODELS = String(import.meta.env.VITE_GEMINI_MODELS ?? 'gemini-3-flash-preview,gemini-2.5-flash,gemini-3.5-flash,gemini-2.5-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)

export let callCount = 0

export class GeminiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

/** base64 file data → a Gemini part. */
export function inline(data: string, mimeType: string): Part {
  return { inlineData: { data, mimeType } }
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

const enc = new TextEncoder()
export async function sha256(...chunks: string[]): Promise<string> {
  const bytes = enc.encode(chunks.join(''))
  const d = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Same key as the server version, so the baked sample results still match.
async function cacheKey(o: CallOptions): Promise<string> {
  const parts = o.parts.map((p) => p.text ?? p.inlineData?.data ?? '')
  return (await sha256(o.task, o.system, JSON.stringify(o.schema ?? null), ...parts)).slice(0, 40)
}

const memory = new Map<string, { data: unknown; meta: CallMeta; grounding?: unknown }>()
const LOCAL = 'kosha-gemini:'

async function readCache<T>(key: string): Promise<CallResult<T> | null> {
  let hit = memory.get(key)
  if (!hit) {
    try {
      const s = localStorage.getItem(LOCAL + key)
      if (s) hit = JSON.parse(s)
    } catch { /* storage blocked */ }
  }
  if (!hit) {
    try {
      const res = await fetch(`/cache/${key}.json`)
      // Hosting answers unknown paths with the app's HTML, so only JSON counts as a hit.
      if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) hit = await res.json()
    } catch { /* offline */ }
  }
  if (!hit) return null
  memory.set(key, hit)
  return { data: hit.data as T, meta: { ...hit.meta, cached: true }, grounding: hit.grounding }
}

function writeCache(key: string, value: { task: string; data: unknown; meta: CallMeta; grounding?: unknown }) {
  memory.set(key, value)
  try {
    const s = JSON.stringify(value)
    if (s.length < 400_000) localStorage.setItem(LOCAL + key, s)
  } catch { /* full or blocked: memory is enough */ }
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
  const key = await cacheKey(o)
  if (!o.noCache) {
    const hit = await readCache<T>(key)
    if (hit) return hit
  }
  if (!configured) throw new GeminiError('Gemini is not configured for this site yet.', 503)

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
        if (!o.noCache) writeCache(key, { task: o.task, data, meta, grounding })
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
