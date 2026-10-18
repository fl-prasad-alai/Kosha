// Reads a QR code from the camera or from a photo, on the device. Uses the browser's BarcodeDetector when it
// has one, otherwise jsQR. Aadhaar's Secure QR is dense, so frames are read at full camera resolution.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import jsQR from 'jsqr'
import { Camera, ImageUp, Loader2, X } from 'lucide-react'

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
function nativeDetector(): Detector | null {
  const BD = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
  try { return BD ? new BD({ formats: ['qr_code'] }) : null } catch { return null }
}

async function decodeCanvas(c: HTMLCanvasElement, det: Detector | null): Promise<string | null> {
  if (det) {
    try {
      const r = await det.detect(c)
      if (r[0]?.rawValue) return r[0].rawValue
    } catch { /* fall back */ }
  }
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, c.width, c.height)
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

/** Decodes a QR code in a photo, trying a few sizes (very large photos defeat jsQR). */
export async function decodeQrImage(file: File): Promise<string | null> {
  const bmp = await createImageBitmap(file)
  const det = nativeDetector()
  for (const w of [Math.min(bmp.width, 2400), 1600, 1100, 800]) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = Math.round((bmp.height / bmp.width) * w)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const text = await decodeCanvas(c, det)
    if (text) return text
  }
  return null
}

export function QrScan({ onText, onError, busy }: { onText: (t: string) => void; onError: (m: string) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-4 text-sm font-semibold text-[#1b1203] disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} Scan with camera
      </button>
      <button type="button" disabled={busy} onClick={() => file.current?.click()} className="glass inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm disabled:opacity-50">
        <ImageUp className="size-4" /> Upload a photo
      </button>
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        const t = await decodeQrImage(f).catch(() => null)
        if (t) onText(t)
        else onError('No QR code found in that photo. Take it straight on, in good light, with the whole QR in view.')
      }} />
      {open && <CameraModal onClose={() => setOpen(false)} onText={(t) => { setOpen(false); onText(t) }} onError={(m) => { setOpen(false); onError(m) }} />}
    </div>
  )
}

function CameraModal({ onClose, onText, onError }: { onClose: () => void; onText: (t: string) => void; onError: (m: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  // keep the latest callbacks without restarting the camera on every render
  const cb = useRef({ onText, onError })
  cb.current = { onText, onError }
  useEffect(() => {
    let stream: MediaStream | null = null
    let stop = false
    const det = nativeDetector()
    const c = document.createElement('canvas')
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      } catch {
        return cb.current.onError('Kosha could not open the camera. Allow camera access, or upload a photo of the QR instead.')
      }
      const v = video.current!
      v.srcObject = stream
      await v.play().catch(() => {})
      while (!stop) {
        if (v.videoWidth) {
          c.width = v.videoWidth
          c.height = v.videoHeight
          c.getContext('2d', { willReadFrequently: true })!.drawImage(v, 0, 0)
          const t = await decodeCanvas(c, det)
          if (t && !stop) return cb.current.onText(t)
        }
        await new Promise((r) => setTimeout(r, 250))
      }
    })()
    return () => {
      stop = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-label="Scan the QR code">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-night">
        <video ref={video} playsInline muted className="aspect-[3/4] w-full object-cover sm:aspect-video" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="size-56 rounded-3xl border-2 border-gold/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" /></div>
        <div className="flex items-center justify-between gap-3 p-4 text-sm">
          <span className="text-ink-2">Hold the QR inside the square. Read on this phone; nothing is uploaded.</span>
          <button onClick={onClose} aria-label="Close" className="glass grid size-10 shrink-0 place-items-center rounded-full"><X className="size-4" /></button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
