// Reads QR codes from images and video frames on the device. Uses the browser's BarcodeDetector when it has
// one, otherwise jsQR. Aadhaar's Secure QR is dense, so images are tried at several sizes.
import jsQR from 'jsqr'

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
export function nativeDetector(): Detector | null {
  const BD = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
  try { return BD ? new BD({ formats: ['qr_code'] }) : null } catch { return null }
}

export async function decodeCanvas(c: HTMLCanvasElement, det: Detector | null): Promise<string | null> {
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
