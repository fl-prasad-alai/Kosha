import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { LockKeyhole, Share2, X } from 'lucide-react'
import HolographicFoil from '@/components/smoothui/holographic-foil'
import { AnimatedNumber } from '../ui'
import { coverArt, ART_H, ART_W } from './art'
import { PROOF_LABEL } from '@shared/types'
import { SOURCES_TOTAL, verifyUrl, type PassportView } from '@/lib/passportView'
import { COUNTRIES, money, pct } from '@/lib/format'
import { getTier } from '@/lib/perf'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

// The Kosha passport: a painted sunset cover over cream paper, a gold score seal, ink stamps, a machine-
// readable zone and a QR code that carries the passport's seal so a printout can be checked.
// The same document renders the full passport and the public record; private fields simply aren't there.

const INK = '#1e2250'
const ISO3: Record<string, string> = { IN: 'IND', PH: 'PHL', ID: 'IDN' }
const ease = [0.22, 1, 0.36, 1] as const
const d = (iso: string | Date) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function mrz(v: PassportView) {
  const clean = (s: string) => s.toUpperCase().normalize('NFKD').replace(/[^A-Z0-9]+/g, '<').replace(/^<|<$/g, '')
  const [given, ...rest] = v.holder.split(/\s+/)
  const pad = (s: string) => (s + '<'.repeat(44)).slice(0, 44)
  const l1 = pad(`KP<${ISO3[v.country] ?? v.country}${clean(rest.join(' ') || given)}<<${clean(given)}`)
  const body = pad(`${v.id.replace(/-/g, '')}<${v.status === 'hold' ? 'HOLD' : v.band.replace('+', 'P').replace('−', 'M')}${v.score}<${v.limit ?? 0}${v.currency}`).slice(0, 43)
  return [l1, body + ([...body].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 10)]
}

/** The gold seal: score ring, coin-edge rim, deep indigo face. */
function Seal({ v, live }: { v: PassportView; live: boolean }) {
  const held = v.status === 'hold'
  const r = 54, C = 2 * Math.PI * r, frac = Math.max(0, Math.min(1, (v.score - 300) / 600))
  const ticks = useMemo(() => Array.from({ length: 60 }, (_, i) => i * 6), [])
  return (
    <div className="relative size-[104px] shrink-0 drop-shadow-[0_12px_20px_rgba(30,20,60,.45)] @xl:size-[118px]">
      <svg viewBox="0 0 140 140" className="size-full">
        <defs>
          <linearGradient id={`rim-${v.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe6a6" /><stop offset=".45" stopColor="#d99a2b" /><stop offset="1" stopColor="#8a5a14" /></linearGradient>
          <radialGradient id={`face-${v.id}`} cx=".35" cy=".3" r=".9"><stop offset="0" stopColor="#2f3a8f" /><stop offset="1" stopColor="#141a48" /></radialGradient>
        </defs>
        <circle cx="70" cy="70" r="69" fill={`url(#rim-${v.id})`} />
        {ticks.map((a) => <rect key={a} x="69.2" y="1.5" width="1.6" height="5" fill="#7a4e10" opacity=".45" transform={`rotate(${a} 70 70)`} />)}
        <circle cx="70" cy="70" r="61" fill={`url(#face-${v.id})`} />
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgb(255 255 255 / .12)" strokeWidth="6" />
        <motion.circle
          cx="70" cy="70" r={r} fill="none" strokeWidth="6" strokeLinecap="round" stroke={held ? '#ff7a64' : '#ffcf6a'}
          strokeDasharray={C} transform="rotate(-90 70 70)"
          initial={live ? { strokeDashoffset: C } : false} animate={{ strokeDashoffset: C * (1 - frac) }} transition={{ duration: 1.6, ease, delay: 0.5 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center text-[#fbf1dc]">
        <span className="font-display text-[29px] font-semibold leading-none tabular @xl:text-[33px]">
          {live ? <AnimatedNumber value={v.score} from={300} delay={0.5} format={String} /> : v.score}
        </span>
        <span className="mt-0.5 font-mono text-[8px] tracking-[0.18em] text-[#e9cf98]">{held ? 'ON HOLD' : `BAND ${v.band}`}</span>
      </div>
    </div>
  )
}

/** A rubber-stamp impression in ink, pressed onto the paper. */
function Stamp({ live, delay, rot, className, tone = 'indigo', night, children }: { live: boolean; delay: number; rot: number; className: string; tone?: 'indigo' | 'red'; night?: boolean; children: ReactNode }) {
  const c = tone === 'red' ? (night ? '#ff8a72' : '#c2412f') : (night ? '#e9c27a' : '#2c3a8c')
  return (
    <motion.div
      aria-hidden
      initial={live ? { opacity: 0, scale: 1.8, rotate: rot } : { opacity: 0.78, scale: 1, rotate: rot }}
      animate={{ opacity: 0.78, scale: 1, rotate: rot }}
      transition={{ delay: live ? delay : 0, type: 'spring', stiffness: 380, damping: 17 }}
      style={{ color: c, borderColor: c, filter: 'url(#kp-ink)' }}
      className={cn('pointer-events-none absolute rounded-[10px] border-[2.5px] px-3 py-1 text-center font-display text-[12.5px] font-bold uppercase leading-tight tracking-[0.1em] mix-blend-multiply dark:mix-blend-screen [&_small]:block [&_small]:font-mono [&_small]:text-[8.5px] [&_small]:font-semibold [&_small]:tracking-[0.14em]', className)}
    >
      {children}
    </motion.div>
  )
}

function Field({ k, v, i, live }: { k: string; v?: ReactNode; i: number; live: boolean }) {
  return (
    <motion.div className="min-w-0" initial={live ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.06 }}>
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#8a7458] dark:text-[#a99878]">{k}</dt>
      {v != null && v !== '' ? (
        <dd className="truncate font-display text-[14.5px] font-medium tabular text-[var(--kp-ink)]">{v}</dd>
      ) : (
        <dd className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-dashed border-[#b9a585] px-2 py-px text-[10.5px] text-[#8a7458] dark:border-[#5a5478] dark:text-[#a99878]" title="Shared only with lenders the shop chose">
          <LockKeyhole className="size-3" /> Private
        </dd>
      )}
    </motion.div>
  )
}

interface Props {
  v: PassportView
  live?: boolean
  onShare?: () => void
  className?: string
}

export function Passport({ v, live = false, onShare, className }: Props) {
  const held = v.status === 'hold'
  const declined = v.status === 'decline'
  const country = COUNTRIES[v.country]
  const issued = new Date(v.createdAt)
  const valid = new Date(issued.getTime() + 90 * 86_400_000)
  const url = verifyUrl(v)
  const night = useTheme() === 'dark'
  const cover = useMemo(() => coverArt(v.id, held, night), [v.id, held, night])
  const lines = useMemo(() => mrz(v), [v])
  const [qr, setQr] = useState<string>()
  const [bigQr, setBigQr] = useState(false)
  const rich = getTier() === 'high'
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 0, width: 220, errorCorrectionLevel: 'M', color: { dark: INK, light: '#00000000' } }).then(setQr).catch(() => setQr(undefined))
  }, [url])

  const fields: { k: string; v?: ReactNode }[] = [
    { k: 'Holder', v: v.holder },
    { k: 'Shop type', v: v.shopType },
    { k: 'Area', v: `${country?.flag ?? ''} ${v.area}`.trim() },
    { k: 'In business', v: v.years != null ? `${v.years} yrs · since ${v.since}` : undefined },
    { k: 'Monthly sales', v: v.monthlySales != null ? money(v.monthlySales, v.currency) : undefined },
    { k: 'Gross margin', v: v.margin != null ? pct(v.margin) : undefined },
    { k: 'Paid digitally', v: v.digitalShare != null ? pct(v.digitalShare) : undefined },
    { k: 'Cross-checked', v: `${v.sources} of ${SOURCES_TOTAL} sources` },
    // passports issued before identity checks existed simply leave this out
    ...(v.idLevel ? [{ k: 'Identity', v: `${PROOF_LABEL[v.idLevel]}${v.bizLevel && v.bizLevel !== 'none' ? ' · registered' : ''}` }] : []),
  ]
  const offerLine = held
    ? 'One record is being checked'
    : declined
      ? 'Not enough evidence yet'
      : v.limit != null
        ? `Up to ${money(v.limit, v.currency)}`
        : 'Qualifies for working capital'

  return (
    <>
      <HolographicFoil pattern="gold" intensity={rich ? 0.22 : 0} glare={rich ? 0.3 : 0} tilt={rich} className={cn('rounded-[24px] border-[#e9c27a]/40 bg-[#f6eedf] dark:border-[#e9c27a]/25 dark:bg-[#11143a]', className)}>
        <article className="@container relative overflow-hidden rounded-[24px] bg-[#f6eedf] text-[var(--kp-ink)] [--kp-ink:#1e2250] dark:bg-[#11143a] dark:[--kp-ink:#f3e6c8]" aria-label={`Kosha credit passport ${v.id} for ${v.shopName}`}>
          <svg width="0" height="0" className="absolute" aria-hidden>
            <filter id="kp-ink"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" /><feDisplacementMap in="SourceGraphic" scale="2.2" /></filter>
          </svg>

          {/* painted cover */}
          <div className="relative">
            <svg viewBox={`0 0 ${ART_W} ${ART_H}`} preserveAspectRatio="xMidYMid slice" className="block aspect-[800/300] w-full @2xl:aspect-[800/230]" aria-hidden dangerouslySetInnerHTML={{ __html: cover }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-[#f6eedf] dark:to-[#11143a]" />
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3.5 text-[#fff3df] [text-shadow:0_2px_12px_rgba(40,16,60,.55)] @xl:p-4">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 64 64" className="size-7 shrink-0" aria-hidden>
                  <path d="M32 6 54 18v16c0 12-9.5 20.5-22 24C19.5 54.5 10 46 10 34V18Z" fill="none" stroke="#ffd27a" strokeWidth="3.6" strokeLinejoin="round" />
                  <circle cx="32" cy="31" r="8.5" fill="none" stroke="#ffd27a" strokeWidth="3.2" />
                  <path d="M32 22.5v17M23.5 31h17" stroke="#ffd27a" strokeWidth="2" />
                </svg>
                <div className="leading-tight">
                  <div className="font-display text-[19px] font-semibold tracking-wide">Kosha</div>
                  <div className="font-mono text-[8.5px] tracking-[0.2em] text-[#ffe0b0]">CREDIT PASSPORT</div>
                </div>
              </div>
              <div className="shrink-0 whitespace-nowrap text-right font-mono text-[9.5px] leading-[1.5] text-[#ffe9cc] @md:text-[10.5px]">
                <div className="text-[11px] text-[#fff6e6] @md:text-[12px]">No. {v.id}</div>
                <div>Issued {d(issued)}</div>
                <div className="hidden @md:block">Valid to {d(valid)}</div>
              </div>
            </div>
            <div className="absolute bottom-0 right-3.5 translate-y-[40%] @xl:right-5">
              <Seal v={v} live={live} />
            </div>
          </div>

          {/* paper */}
          <div className="relative px-4 pb-3.5 pt-2.5 @xl:px-5">
            <Paper />
            <div className="relative pr-[118px] @xl:pr-[132px]">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#a3711c] dark:text-[#e9b860]">{v.public ? 'Public record · verified by Kosha' : 'Issued and verified by Kosha'}</div>
              <h3 className="mt-0.5 truncate font-display text-[clamp(20px,4.4cqw,30px)] font-semibold leading-[1.1]">{v.shopName}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium', held ? 'bg-[#c2412f]/12 text-[#a8321f] dark:bg-[#ff6a55]/15 dark:text-[#ff9a88]' : declined ? 'bg-[#b07a1a]/12 text-[#8a5a10] dark:bg-[#ffc04d]/15 dark:text-[#ffd27a]' : 'bg-[#1f8a5c]/12 text-[#156a46] dark:bg-[#3ee0c4]/12 dark:text-[#6ff0d6]')}>
                  <span className={cn('size-1.5 rounded-full', held ? 'bg-[#c2412f]' : declined ? 'bg-[#b07a1a]' : 'bg-[#1f9a68]')} />
                  {held ? 'On hold' : declined ? 'Not yet' : 'Ready to offer'} · {offerLine}
                </span>
                {onShare && (
                  <button type="button" onClick={onShare} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#1e2250] px-3 text-[12px] font-semibold text-[#fbf1dc] transition hover:bg-[#2a3170] dark:bg-[#f2b544] dark:text-[#1b1203] dark:hover:bg-[#ffd27a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d99a2b]">
                    <Share2 className="size-3.5" /> Share
                  </button>
                )}
              </div>
            </div>

            <dl className="relative mt-3 grid grid-cols-2 gap-x-4 gap-y-2 @xl:grid-cols-3 @3xl:grid-cols-4">
              {fields.map((f, i) => <Field key={f.k} k={f.k} v={f.v} i={i} live={live} />)}
            </dl>

            {/* machine-readable zone and the verification QR */}
            <div className="relative mt-3 flex items-center gap-3 border-t border-[#d9c7a6] pt-2.5 dark:border-[#3a3766]">
              <pre className="min-w-0 flex-1 overflow-hidden font-mono text-[clamp(7px,1.75cqw,11.5px)] leading-[1.55] tracking-[0.1em] text-[var(--kp-ink)] opacity-75">{lines.join('\n')}</pre>
              <button type="button" onClick={() => setBigQr(true)} className="group shrink-0 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d99a2b]" title="Show the QR code large" aria-label="Show the QR code large">
                <div className="rounded-lg bg-white/70 p-1 ring-1 ring-[#d9c7a6] transition group-hover:ring-[#d99a2b] dark:bg-[#f6eedf] dark:ring-[#e9c27a]/40">
                  {qr ? <img src={qr} alt="" className="size-[56px] @xl:size-[62px]" /> : <div className="size-[56px]" />}
                </div>
                <div className="mt-0.5 font-mono text-[8px] tracking-[0.12em] text-[#8a7458] dark:text-[#a99878]">{v.seal ? v.seal : 'TAP TO ENLARGE'}</div>
              </button>
            </div>

            <Stamp night={night} live={live} delay={1.9} rot={-8} className="right-[150px] top-1 hidden @3xl:block" tone={held ? 'red' : 'indigo'}>
              {held ? <>On hold<small>record review</small></> : <>{v.sources} sources<small>cross-checked</small></>}
            </Stamp>
          </div>
        </article>
      </HolographicFoil>
      <QrView open={bigQr} onClose={() => setBigQr(false)} v={v} url={url} />
    </>
  )
}

/** The QR code, large enough to scan from across the counter. */
function QrView({ open, onClose, v, url }: { open: boolean; onClose: () => void; v: PassportView; url: string }) {
  const [big, setBig] = useState<string>()
  useEffect(() => {
    if (!open) return
    QRCode.toDataURL(url, { margin: 2, width: 640, errorCorrectionLevel: 'M', color: { dark: INK, light: '#ffffff' } }).then(setBig).catch(() => setBig(undefined))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, url, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95] grid place-items-center bg-black/70 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog" aria-modal="true" aria-label={`QR code for passport ${v.id}`}
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.22, ease }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[400px] rounded-[28px] bg-[#f6eedf] p-5 text-center shadow-2xl"
            style={{ color: INK }}
          >
            <button onClick={onClose} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-[#1e2250]/8 hover:bg-[#1e2250]/15" aria-label="Close"><X className="size-4" /></button>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[#a3711c]">SCAN TO VERIFY</div>
            <div className="mt-1 truncate font-display text-xl font-semibold">{v.shopName}</div>
            <div className="mx-auto mt-4 aspect-square w-full max-w-[340px] rounded-2xl bg-white p-3 ring-1 ring-[#d9c7a6]">
              {big ? <img src={big} alt={`QR code that opens passport ${v.id}`} className="size-full" /> : <div className="size-full animate-pulse rounded-xl bg-[#efe3cc]" />}
            </div>
            <div className="mt-3 font-mono text-[12px] tracking-[0.1em]">{v.id}{v.seal ? ` · SEAL ${v.seal}` : ''}</div>
            <p className="mt-1 text-[13px] text-[#6a5d4c]">Point a phone camera at it to open Kosha's record and check the seal.</p>
            <a href={url} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1e2250] px-4 text-sm font-semibold text-[#fbf1dc]">Open the record</a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Cream paper: a fine guilloche and soft watercolour washes. */
function Paper() {
  const paths = useMemo(() => {
    const out: string[] = []
    for (let k = 0; k < 18; k++) {
      let p = ''
      for (let x = 0; x <= 900; x += 8) p += `${x ? 'L' : 'M'}${x},${(220 + Math.sin(x / 64 + k * 0.5) * (80 + k * 4) * Math.cos(x / 240 - k * 0.2)).toFixed(1)}`
      out.push(p)
    }
    return out
  }, [])
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-20 top-10 size-72 rounded-full bg-[#f2c98a]/25 blur-3xl dark:bg-[#6a4cff]/15" />
      <div className="absolute -right-10 bottom-0 size-64 rounded-full bg-[#c9a7d8]/20 blur-3xl dark:bg-[#f2b544]/10" />
      <svg viewBox="0 0 900 440" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-60">
        {paths.map((p, k) => <path key={k} d={p} fill="none" className={k % 2 ? 'stroke-[rgb(176_122_26/.16)] dark:stroke-[rgb(233_194_122/.12)]' : 'stroke-[rgb(44_58_140/.08)] dark:stroke-[rgb(160_170_255/.08)]'} strokeWidth=".8" />)}
      </svg>
    </div>
  )
}
