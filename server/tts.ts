// Speaks the passport explanation in the owner's language with Gemini TTS. Returns a WAV file.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ai, GeminiError } from './gemini.ts'

const TTS_MODELS = (process.env.GEMINI_TTS_MODELS ?? 'gemini-2.5-flash-preview-tts,gemini-3.1-flash-tts-preview').split(',')
const DIRS = [path.resolve('cache/tts'), path.resolve('.cache/tts')]

function wav(pcm: Buffer, rate = 24000) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

export async function speak(text: string): Promise<Buffer> {
  const clean = text.trim().slice(0, 1500)
  if (!clean) throw new GeminiError('Nothing to read aloud.', 400)
  const key = createHash('sha256').update(clean).digest('hex').slice(0, 32)
  for (const d of DIRS) {
    try { return await readFile(path.join(d, `${key}.wav`)) } catch { /* miss */ }
  }
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
      const out = wav(Buffer.from(part.inlineData.data, 'base64'), rate)
      try {
        await mkdir(DIRS[1], { recursive: true })
        await writeFile(path.join(DIRS[1], `${key}.wav`), out)
      } catch { /* cache is optional */ }
      return out
    } catch (e) {
      last = e
      console.warn(`[tts] ${model} failed: ${(e as Error).message.slice(0, 120)}`)
    }
  }
  throw new GeminiError(`Voice is unavailable right now: ${(last as Error)?.message?.slice(0, 120) ?? ''}`, 503)
}
