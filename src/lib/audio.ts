import { tts } from './api'

/** Records from the microphone and returns a 16 kHz mono WAV, which Gemini accepts everywhere. */
export class Recorder {
  private rec?: MediaRecorder
  private chunks: Blob[] = []
  stream?: MediaStream

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
    this.rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined)
    this.chunks = []
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data)
    this.rec.start(250)
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.rec) return reject(new Error('Not recording'))
      this.rec.onstop = async () => {
        this.stream?.getTracks().forEach((t) => t.stop())
        try {
          resolve(await toWav(new Blob(this.chunks, { type: this.rec?.mimeType })))
        } catch (e) {
          reject(e)
        }
      }
      this.rec.stop()
    })
  }

  cancel() {
    try {
      this.rec?.stop()
    } catch { /* already stopped */ }
    this.stream?.getTracks().forEach((t) => t.stop())
  }
}

async function toWav(blob: Blob, rate = 16000): Promise<Blob> {
  const buf = await blob.arrayBuffer()
  const ctx = new AudioContext()
  const decoded = await ctx.decodeAudioData(buf)
  await ctx.close()
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  const pcm = (await off.startRendering()).getChannelData(0)
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2))
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true)
  w(36, 'data'); out.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true)
  return new Blob([out], { type: 'audio/wav' })
}

let current: HTMLAudioElement | null = null

/** Speaks text with Gemini TTS, falling back to the browser's own voice. Resolves when playback ends. */
export async function say(text: string, lang: string, onStart?: () => void): Promise<'gemini' | 'browser'> {
  stopSpeaking()
  try {
    const blob = await tts(text)
    const url = URL.createObjectURL(blob)
    current = new Audio(url)
    onStart?.()
    await new Promise<void>((res) => {
      current!.onended = () => res()
      current!.onerror = () => res()
      void current!.play().catch(() => res())
    })
    URL.revokeObjectURL(url)
    return 'gemini'
  } catch {
    if (!('speechSynthesis' in window)) throw new Error('Voice playback is not available in this browser.')
    onStart?.()
    await new Promise<void>((res) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang
      u.rate = 0.95
      u.onend = () => res()
      u.onerror = () => res()
      speechSynthesis.speak(u)
    })
    return 'browser'
  }
}

export function stopSpeaking() {
  current?.pause()
  current = null
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
