// The Aadhaar panel's two ways in: scan the QR with the camera, or upload a photo of the card.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { decodeCanvas, decodeQrImage, nativeDetector } from '@/lib/qrDecode'
import { Camera, ImageUp, Loader2, X } from 'lucide-react'

/**
 * Two ways in: scan the QR with the camera, or upload a photo of the card. A photo is first searched for the QR
 * (signed by UIDAI); if it has no readable QR, the photo itself is passed on to be read as an ID card.
 */
export function QrScan({ onText, onPhoto, onError, busy }: { onText: (t: string) => void; onPhoto: (f: File) => void; onError: (m: string) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const [looking, setLooking] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" disabled={busy || looking} onClick={() => setOpen(true)} className="flex min-h-14 items-center gap-3 rounded-2xl bg-gold px-4 text-left text-[#1b1203] disabled:opacity-50">
        {busy ? <Loader2 className="size-5 shrink-0 animate-spin" /> : <Camera className="size-5 shrink-0" />}
        <span><span className="block text-sm font-semibold">Scan the QR</span><span className="block text-xs opacity-80">With the camera · Govt-signed</span></span>
      </button>
      <button type="button" disabled={busy || looking} onClick={() => file.current?.click()} className="glass flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left disabled:opacity-50">
        {looking ? <Loader2 className="size-5 shrink-0 animate-spin" /> : <ImageUp className="size-5 shrink-0" />}
        <span><span className="block text-sm font-semibold">Upload a photo of the card</span><span className="block text-xs text-ink-3">Front, back or e-Aadhaar screenshot</span></span>
      </button>
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setLooking(true)
        try {
          // the QR beats the printed text: it is signed by UIDAI
          const t = await decodeQrImage(f).catch(() => null)
          if (t && /^\d{100,}$/.test(t.trim())) onText(t)
          else onPhoto(f)
        } catch {
          onError('Kosha could not open that photo. Try a JPG or PNG.')
        } finally {
          setLooking(false)
        }
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
