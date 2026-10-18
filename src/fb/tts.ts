// Speaks the passport explanation in the owner's language with Gemini TTS. Returns a WAV file.
import { ai, GeminiError, sha256 } from './gemini.ts'

const TTS_MODELS = String(import.meta.env.VITE_GEMINI_TTS_MODELS ?? 'gemini-2.5-flash-preview-tts,gemini-3.1-flash-tts-preview').split(',')
const memory = new Map<string, Blob>()

function wav(pcm: Uint8Array, rate = 24000) {
  const h = new DataView(new ArrayBuffer(44))
  const put = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)))
  put(0, 'RIFF'); h.setUint32(4, 36 + pcm.length, true); put(8, 'WAVE')
  put(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true)
  h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true)
  put(36, 'data'); h.setUint32(40, pcm.length, true)
  return new Blob([h.buffer, pcm as BlobPart], { type: 'audio/wav' })
}

export async function speak(text: string): Promise<Blob> {
  const clean = text.trim().slice(0, 1500)
  if (!clean) throw new GeminiError('Nothing to read aloud.', 400)
  const key = (await sha256(clean)).slice(0, 32)
  const seen = memory.get(key)
  if (seen) return seen
  try {
    const res = await fetch(`/cache/tts/${key}.wav`)
    if (res.ok && (res.headers.get('content-type') ?? '').includes('audio')) {
      const b = await res.blob()
      memory.set(key, b)
      return b
    }
  } catch { /* not baked */ }
  let last: unknown
  for (const model of TTS_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: `Read this warmly and slowly, like a kind local bank officer speaking to a shop owner:\n${clean}` }] }],
        config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Sulafat' } } } },
      })
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
      if (!part?.inlineData?.data) throw new Error('No audio returned')
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? '')?.[1] ?? 24000)
      const out = wav(Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0)), rate)
      memory.set(key, out)
      return out
    } catch (e) {
      last = e
      console.warn(`[tts] ${model} failed: ${(e as Error).message.slice(0, 120)}`)
    }
  }
  throw new GeminiError(`Voice is unavailable right now: ${(last as Error)?.message?.slice(0, 120) ?? ''}`, 503)
}
