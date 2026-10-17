import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import QRCode from 'qrcode'
import { Check, Copy, Download, Eye, ImageDown, LockKeyhole, MessageCircle, Share2, X } from 'lucide-react'
import type { Assessment, User } from '@shared/types'
import { ConsentManager } from '../Consent'
import { coverSvg } from './art'
import { SOURCES_TOTAL, verifyUrl, type PassportView } from '@/lib/passportView'
import { COUNTRIES, money } from '@/lib/format'
import { cn } from '@/lib/utils'

// Sharing a passport. Whatever leaves the app (the link, the QR code, the image) carries only the public
// record, so a share can never expose a shop's documents. The shop alone decides which lenders may open
// the full passport; lenders and everyone else get a note explaining what the link shows.

type Who = 'owner' | 'lender' | 'other'

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

/** A 1200×630 share card (the size messaging apps and social sites preview), public fields only. */
async function shareCard(v: PassportView): Promise<Blob | null> {
  await Promise.all(['600 54px Fraunces', '500 22px "Geist Variable"', '500 16px "Geist Mono"'].map((f) => document.fonts?.load(f).catch(() => null)))
  const W = 1200, H = 630, c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  if (!g) return null
  const held = v.status === 'hold'
  const cover = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(coverSvg(v.id, held, 1200, 450)))
  g.drawImage(cover, 0, 0, 1200, 450)
  const fade = g.createLinearGradient(0, 330, 0, 450); fade.addColorStop(0, 'rgba(246,238,223,0)'); fade.addColorStop(1, '#f6eedf')
  g.fillStyle = fade; g.fillRect(0, 330, W, 120)
  g.fillStyle = '#f6eedf'; g.fillRect(0, 450, W, 180)
  // header over the sky
  g.shadowColor = 'rgba(40,16,60,.55)'; g.shadowBlur = 14
  g.fillStyle = '#ffe0b0'; g.font = '500 16px "Geist Mono", monospace'; g.fillText('KOSHA · BUSINESS CREDIT PASSPORT', 48, 58)
  g.fillStyle = '#fff6e6'; g.font = '600 58px Fraunces, Georgia, serif'; g.fillText(v.shopName, 48, 122, 760)
  const country = COUNTRIES[v.country]
  g.font = '500 22px "Geist Variable", system-ui, sans-serif'; g.fillStyle = '#ffe9cc'; g.fillText(`${v.holder} · ${v.shopType} · ${v.area}${country ? `, ${country.name}` : ''}`, 48, 160, 760)
  g.shadowBlur = 0
  // the seal
  const sx = 1030, sy = 430, R = 104
  const rim = g.createLinearGradient(sx - R, sy - R, sx + R, sy + R); rim.addColorStop(0, '#ffe6a6'); rim.addColorStop(0.45, '#d99a2b'); rim.addColorStop(1, '#8a5a14')
  g.shadowColor = 'rgba(30,20,60,.45)'; g.shadowBlur = 24; g.shadowOffsetY = 12
  g.fillStyle = rim; g.beginPath(); g.arc(sx, sy, R, 0, Math.PI * 2); g.fill()
  g.shadowBlur = 0; g.shadowOffsetY = 0
  g.fillStyle = '#18205a'; g.beginPath(); g.arc(sx, sy, R - 12, 0, Math.PI * 2); g.fill()
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 9; g.beginPath(); g.arc(sx, sy, R - 24, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = held ? '#ff7a64' : '#ffcf6a'; g.lineCap = 'round'; g.beginPath(); g.arc(sx, sy, R - 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, (v.score - 300) / 600)); g.stroke()
  g.fillStyle = '#fbf1dc'; g.textAlign = 'center'; g.font = '600 56px Fraunces, Georgia, serif'; g.fillText(String(v.score), sx, sy + 14)
  g.font = '500 14px "Geist Mono", monospace'; g.fillStyle = '#e9cf98'; g.fillText(held ? 'ON HOLD' : `BAND ${v.band}`, sx, sy + 42)
  g.textAlign = 'left'
  // the paper
  const status = held ? 'On hold · one record is being checked' : v.status === 'decline' ? 'Not yet · more evidence needed' : v.limit != null ? `Ready to offer · up to ${money(v.limit, v.currency)}` : 'Ready to offer · qualifies for working capital'
  g.fillStyle = held ? '#a8321f' : '#156a46'; g.font = '600 30px Fraunces, Georgia, serif'; g.fillText(status, 48, 508, 700)
  g.fillStyle = '#5e5446'; g.font = '500 20px "Geist Variable", system-ui, sans-serif'
  g.fillText(`Issued ${new Date(v.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${v.sources} of ${SOURCES_TOTAL} sources cross-checked`, 48, 546, 700)
  g.fillStyle = '#1e2250'; g.font = '500 17px "Geist Mono", monospace'; g.fillText(`${v.id}${v.seal ? `  ·  SEAL ${v.seal}` : ''}`, 48, 590)
  // QR to verify
  const qr = await loadImg(await QRCode.toDataURL(verifyUrl(v), { margin: 1, width: 150, color: { dark: '#1e2250', light: '#ffffff' } }))
  g.fillStyle = '#ffffff'; g.fillRect(770, 470, 132, 132); g.drawImage(qr, 774, 474, 124, 124)
  g.fillStyle = '#8a7458'; g.font = '500 12px "Geist Mono", monospace'; g.fillText('SCAN TO VERIFY', 784, 620)
  return new Promise((res) => c.toBlob(res, 'image/png'))
}

function save(blob: Blob | string, name: string) {
  const a = document.createElement('a')
  a.href = typeof blob === 'string' ? blob : URL.createObjectURL(blob)
  a.download = name
  a.click()
  if (typeof blob !== 'string') setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

interface Props {
  open: boolean
  onClose: () => void
  /** What the link shows: always the public record. */
  pub: PassportView
  who: Who
  user?: User | null
  /** The owner's full passport, to manage who may open it. */
  owned?: Assessment
  onSaved?: (a: Assessment) => void
}

export function ShareSheet({ open, onClose, pub, who, user, owned, onSaved }: Props) {
  const url = verifyUrl(pub)
  const [qr, setQr] = useState<string>()
  const [card, setCard] = useState<{ url: string; blob: Blob } | null>(null)
  const [copied, setCopied] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const latest = useRef({ pub, onClose })
  useLayoutEffect(() => { latest.current = { pub, onClose } })
  const key = `${pub.id}|${pub.score}|${pub.status}|${pub.limit ?? ''}|${pub.seal ?? ''}`

  useEffect(() => {
    if (!open) return
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#1e2250', light: '#ffffff' } }).then(setQr).catch(() => setQr(undefined))
    let gone = false, made = ''
    shareCard(latest.current.pub).then((b) => { if (b && !gone) { made = URL.createObjectURL(b); setCard({ url: made, blob: b }) } }).catch(() => {})
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && latest.current.onClose()
    addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => { gone = true; removeEventListener('keydown', onKey); if (made) URL.revokeObjectURL(made); setCard(null) }
  }, [open, url, key])

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
  }
  const text = `${pub.shopName}'s Kosha credit passport (${pub.id}). Check it is genuine:`
  const native = async () => {
    const files = card ? [new File([card.blob], `${pub.id}.png`, { type: 'image/png' })] : []
    try {
      if (files.length && navigator.canShare?.({ files })) await navigator.share({ title: 'Kosha credit passport', text, url, files })
      else await navigator.share({ title: 'Kosha credit passport', text, url })
    } catch { /* cancelled */ }
  }
  const visible = ['Shop name, owner’s first name, shop type', 'Area and city (never the street)', 'Score, band and whether there is an offer', `Issue date and sources cross-checked`, pub.limit != null ? 'The offer amount (the shop chose to show it)' : null].filter(Boolean) as string[]
  const hidden = ['Ledger, bills, payments and electricity bills', 'Street address and shop photo', 'Interview and the reasons behind the score', pub.limit == null ? 'The offer amount' : null, 'Lender decisions and notes'].filter(Boolean) as string[]

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-end bg-black/55 sm:place-items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="share-title"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl p-5 outline-none sm:rounded-3xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow">Share · {pub.id}</div>
                <h2 id="share-title" className="font-display mt-1 text-2xl">Share this passport</h2>
                <p className="mt-1 text-sm text-ink-2">The link, QR code and image show only the public record. Anyone can check it is genuine.</p>
              </div>
              <button onClick={onClose} className="glass grid size-9 shrink-0 place-items-center rounded-full" aria-label="Close"><X className="size-4" /></button>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div>
                <div className="overflow-hidden rounded-2xl border border-line bg-[#f6eedf]">
                  {card ? <img src={card.url} alt="Share image of the passport's public record" className="block w-full" /> : <div className="aspect-[1200/630] w-full animate-pulse bg-[#efe3cc]" />}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {typeof navigator.share === 'function' && (
                    <button onClick={native} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-gold px-4 text-sm font-semibold text-[#1b1203]"><Share2 className="size-4" /> Share…</button>
                  )}
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noreferrer" className="glass inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm"><MessageCircle className="size-4 text-jade" /> WhatsApp</a>
                  <button disabled={!card} onClick={() => card && save(card.blob, `${pub.id}.png`)} className="glass inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm disabled:opacity-50"><ImageDown className="size-4" /> Save image</button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 rounded-2xl border border-line p-3">
                  {qr ? <img src={qr} alt="QR code that opens this passport's public record" className="size-28 shrink-0 rounded-xl" /> : <div className="size-28 shrink-0 rounded-xl bg-white/80" />}
                  <div className="min-w-0 text-sm">
                    <div className="font-medium">Scan to verify</div>
                    <p className="mt-0.5 text-ink-2">Print it at the counter or send it to a lender. The seal code shows if a printout was changed.</p>
                    {pub.seal && <div className="mt-1.5 font-mono text-xs text-gold">SEAL {pub.seal}</div>}
                    {qr && <button onClick={() => save(qr, `${pub.id}-qr.png`)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-2 underline-offset-4 hover:text-ink hover:underline"><Download className="size-3.5" /> Save QR code</button>}
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-line p-1.5 pl-3">
                  <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink-2 outline-none" aria-label="Passport link" />
                  <button onClick={copy} className={cn('inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm', copied ? 'bg-jade/15 text-jade' : 'bg-glass')}>
                    {copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
                  </button>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                  <div className="rounded-2xl border border-jade/30 bg-jade/5 p-3">
                    <div className="flex items-center gap-1.5 font-medium text-jade"><Eye className="size-4" /> The link shows</div>
                    <ul className="mt-1.5 space-y-1 text-ink-2">{visible.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <div className="rounded-2xl border border-line p-3">
                    <div className="flex items-center gap-1.5 font-medium"><LockKeyhole className="size-4 text-gold" /> Stays private</div>
                    <ul className="mt-1.5 space-y-1 text-ink-2">{hidden.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              {who === 'owner' && owned ? (
                <>
                  <div className="eyebrow">Who can open the full passport</div>
                  <p className="mb-4 mt-1 text-sm text-ink-2">Only lenders you allow see your documents, score reasons and offer. You can change this any time, and you will see every time a lender opens it.</p>
                  <ConsentManager id={owned.id} consent={owned.consent} views={owned.access?.length ?? 0} onSaved={(a) => onSaved?.(a)} />
                </>
              ) : who === 'lender' ? (
                <p className="text-sm text-ink-2">The full passport opens for {user?.org ?? 'your organisation'} because the shop shared it with you. Anyone you send this link to sees only the public record.</p>
              ) : (
                <p className="text-sm text-ink-2">Only the shop decides which lenders can open the full passport. Lenders the shop has chosen sign in to see it.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
