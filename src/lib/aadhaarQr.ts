// Reads the Secure QR code printed on Aadhaar cards and e-Aadhaar, and checks UIDAI's digital signature on it.
// The QR holds a large decimal number: its bytes are compressed data, fields separated by byte 255, then the photo,
// then hashes, then a 256-byte RSA signature (SHA-256) over everything before it. Everything happens in the browser;
// nothing from the card is uploaded, and the QR never contains the full Aadhaar number.
import type { AadhaarQr } from '@shared/types'
import { UIDAI_KEYS } from './uidaiKeys'

function bigToBytes(digits: string): Uint8Array {
  let hex = BigInt(digits).toString(16)
  if (hex.length % 2) hex = `0${hex}`
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  for (const format of ['gzip', 'deflate', 'deflate-raw'] as CompressionFormat[]) {
    try {
      const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(format))
      const buf = new Uint8Array(await new Response(stream).arrayBuffer())
      if (buf.length > 256) return buf
    } catch { /* try the next format */ }
  }
  throw new Error('This QR code could not be decompressed. Is it the Secure QR on an Aadhaar card?')
}

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/** true when one of UIDAI's published keys verifies the signature; null when none does (Kosha cannot confirm it). */
async function checkSignature(data: Uint8Array, signature: Uint8Array): Promise<{ signed: true; by: string } | { signed: null }> {
  if (!crypto?.subtle) return { signed: null }
  for (const k of UIDAI_KEYS) {
    try {
      const key = await crypto.subtle.importKey('spki', b64ToBytes(k.spki), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
      if (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature as BufferSource, data as BufferSource)) return { signed: true, by: k.cn }
    } catch { /* next key */ }
  }
  return { signed: null }
}

const isoDob = (s: string) => {
  const m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{4}$/.test(s.trim()) ? s.trim() : ''
}

export async function readAadhaarQr(text: string): Promise<AadhaarQr> {
  const digits = text.trim()
  if (!/^\d{100,}$/.test(digits)) throw new Error('This is not an Aadhaar Secure QR code. Use the large QR on the Aadhaar card or e-Aadhaar PDF.')
  const data = await inflate(bigToBytes(digits))
  const signature = data.slice(data.length - 256)
  const signedPart = data.slice(0, data.length - 256)

  // Text fields come first, separated by 255. Version 2+ starts with "V2", "V3"…
  const dec = new TextDecoder('utf-8')
  const fields: string[] = []
  let start = 0
  for (let i = 0; i < data.length && fields.length < 18; i++) {
    if (data[i] === 255) {
      fields.push(dec.decode(data.slice(start, i)))
      start = i + 1
    }
  }
  const versioned = /^V\d$/.test(fields[0] ?? '')
  const f = versioned ? fields.slice(1) : fields
  const [indicator, referenceId, name, dob, gender, careOf, district, landmark, house, location, pincode, , state, street, subDistrict, vtc] = f
  if (!name || !referenceId) throw new Error('The QR code was read, but it does not look like an Aadhaar Secure QR.')
  const ind = Number(indicator)
  const ts = referenceId.slice(4)
  const sig = await checkSignature(signedPart, signature)
  return {
    signed: sig.signed,
    signedBy: sig.signed ? sig.by : undefined,
    version: versioned ? fields[0] : 'V1',
    name: name.trim(),
    dob: isoDob(dob ?? ''),
    gender: { M: 'Male', F: 'Female', T: 'Transgender' }[gender?.trim() as 'M'] ?? gender ?? '',
    careOf: careOf?.trim() ?? '',
    district: district?.trim() ?? '',
    state: state?.trim() ?? '',
    pincode: pincode?.trim() ?? '',
    locality: [house, street, landmark, location, vtc, subDistrict].map((x) => x?.trim()).filter(Boolean).join(', '),
    last4: referenceId.slice(0, 4),
    generatedAt: /^\d{14}/.test(ts) ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : '',
    hasEmail: ind === 1 || ind === 3,
    hasMobile: ind === 2 || ind === 3,
  }
}
