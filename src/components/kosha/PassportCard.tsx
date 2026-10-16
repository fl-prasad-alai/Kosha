import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import QRCode from 'qrcode'
import type { Assessment } from '@shared/types'
import HolographicFoil from '@/components/smoothui/holographic-foil'
import { AnimatedNumber } from './ui'
import ScrambleText from '@/components/unlumen-ui/scramble-text'
import { COUNTRIES, money, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

const ISO3: Record<string, string> = { IN: 'IND', PH: 'PHL', ID: 'IDN' }

function mrz(a: Assessment) {
  const clean = (s: string) => s.toUpperCase().normalize('NFKD').replace(/[^A-Z0-9]+/g, '<').replace(/^<|<$/g, '')
  const [given, ...rest] = a.profile.ownerName.split(/\s+/)
  const pad = (s: string) => (s + '<'.repeat(44)).slice(0, 44)
  const l1 = pad(`KP<${ISO3[a.profile.country] ?? a.profile.country}${clean(rest.join(' ') || given)}<<${clean(given)}`)
  const body = pad(`${a.id.replace(/-/g, '')}<${a.offer.status === 'hold' ? 'HOLD' : a.band.replace('+', 'P').replace('−', 'M')}${a.score}<${a.offer.status === 'offer' ? a.offer.limit : 0}${a.profile.currency}`).slice(0, 43)
  const check = [...body].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 10
  return [l1, body + check]
}

function Ring({ score, held, live }: { score: number; held: boolean; live: boolean }) {
  const r = 52
  const C = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, (score - 300) / 600))
  return (
    <div className="relative size-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="size-full -rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="9" />
        <motion.circle
          cx="66" cy="66" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
          stroke={held ? '#ff6a55' : 'url(#ringGold)'}
          strokeDasharray={C}
          initial={live ? { strokeDashoffset: C } : false}
          animate={{ strokeDashoffset: C * (1 - frac) }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        />
        <defs>
          <linearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd27a" />
            <stop offset="1" stopColor="#e8912c" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-display text-[34px] font-semibold leading-none text-[#f6ead0]">
          {live ? <AnimatedNumber value={score} from={300} delay={0.4} format={String} /> : score}
        </span>
        <span className="mt-1 font-mono text-[10px] tracking-[0.18em] text-[#c9b893]">KOSHA SCORE</span>
      </div>
    </div>
  )
}

interface Props {
  a: Assessment
  live?: boolean
  className?: string
  compact?: boolean
}

export function PassportCard({ a, live = true, className, compact }: Props) {
  const held = a.offer.status === 'hold'
  const declined = a.offer.status === 'decline'
  const [qr, setQr] = useState<string>()
  const url = `${location.origin}/passport/${a.id}`
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 0, width: 160, color: { dark: '#f6ead0', light: '#00000000' } }).then(setQr).catch(() => setQr(undefined))
  }, [url])
  const lines = useMemo(() => mrz(a), [a])
  const country = COUNTRIES[a.profile.country]
  const issued = new Date(a.createdAt)
  const valid = new Date(issued.getTime() + 90 * 86_400_000)
  const d = (x: Date) => x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const fields: [string, string][] = [
    ['Holder', a.profile.ownerName],
    ['Business', a.profile.shopName],
    ['Type', a.profile.shopType],
    ['Location', a.profile.address.split(',').slice(-3).join(',').trim()],
    ['In business', `${a.metrics.yearsInBusiness} years · since ${a.profile.since}`],
    ['Monthly sales', money(a.metrics.monthlySales, a.profile.currency)],
    ['Gross margin', pct(a.metrics.margin)],
    ['Paid digitally', pct(a.metrics.digitalShare)],
  ]

  return (
    <HolographicFoil pattern="gold" intensity={0.42} glare={0.5} tilt className={cn('rounded-[22px] border-[#f2b544]/25 bg-[#0b1322] text-[#f6ead0]', className)}>
      <div className="relative overflow-hidden rounded-[22px] p-5 sm:p-6" style={{ background: 'radial-gradient(120% 90% at 100% 0%, rgb(29 52 86 / 0.85), rgb(9 16 30 / 0.9) 60%)' }}>
        <Guilloche />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[#d9a441]">BUSINESS CREDIT PASSPORT</div>
            <div className="font-display text-2xl font-semibold tracking-wide">KOSHA</div>
          </div>
          <div className="text-right font-mono text-[11px] leading-5 text-[#b8c3d3]">
            <div className="text-[#f6ead0]">
              No. {live ? <ScrambleText text={a.id} scrambleSpeed={35} characters="ABCDEF0123456789" /> : a.id}
            </div>
            <div>Issued {d(issued)}</div>
            <div>Valid to {d(valid)}</div>
          </div>
        </div>

        <div className={cn('relative mt-5 grid gap-5', compact ? 'grid-cols-[92px_1fr]' : 'grid-cols-[92px_1fr] md:grid-cols-[108px_1fr_auto]')}>
          <div className="aspect-[4/5] w-[92px] overflow-hidden rounded-lg border border-[#d9a441]/50 bg-[#05080f] md:w-[108px]">
            {a.thumbnail ? (
              <img src={a.thumbnail} alt={`${a.profile.shopName} shopfront`} className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center font-display text-4xl text-[#d9a441]">{a.profile.shopName.slice(0, 1)}</div>
            )}
          </div>
          <dl className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-2">
            {fields.map(([k, v], i) => (
              <motion.div key={k} className="min-w-0" initial={live ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}>
                <dt className="font-mono text-[9.5px] tracking-[0.14em] text-[#9fb0c6] uppercase">{k}</dt>
                <dd className="truncate text-[13.5px] font-medium tabular">{v}</dd>
              </motion.div>
            ))}
          </dl>
          <div className={cn('flex items-center gap-4', compact ? 'col-span-2' : 'col-span-2 md:col-span-1 md:flex-col md:items-end')}>
            <Ring score={a.score} held={held} live={live} />
            <div className={cn('flex flex-col gap-1', !compact && 'md:items-end')}>
              <span className={cn('font-display text-3xl font-semibold', held ? 'text-[#ff8a78]' : 'text-[#ffd27a]')}>{held ? 'On hold' : declined ? 'Not yet' : a.band}</span>
              <span className="text-xs text-[#b8c3d3]">{held ? 'One record needs checking' : declined ? 'Not enough evidence yet' : `Up to ${money(a.offer.limit, a.profile.currency)}`}</span>
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex items-end gap-4 border-t border-[#f6ead0]/15 pt-3">
          <pre className="min-w-0 flex-1 overflow-hidden font-mono text-[clamp(8px,1.15vw,12.5px)] leading-[1.6] tracking-[0.12em] text-[#f6ead0]/80">{lines.join('\n')}</pre>
          {qr && (
            <a href={url} className="shrink-0 rounded-md bg-white/5 p-1.5" title="Verify this passport">
              <img src={qr} alt="QR code to verify this passport" className="size-14" />
            </a>
          )}
        </div>

        <Stamp show={live} delay={2.2} rot={-8} className={held ? 'left-[34%] top-[40%]' : 'left-[34%] top-[5%]'} bad={held}>
          {held ? <>On hold<small>record review</small></> : <>{a.sourcesUsed.length} sources<small>cross-checked</small></>}
        </Stamp>
        {!held && country && (
          <Stamp show={live} delay={2.6} rot={7} className="bottom-[23%] left-[4%]">
            {country.name}<small>{d(issued)}</small>
          </Stamp>
        )}
      </div>
    </HolographicFoil>
  )
}

function Stamp({ show, delay, rot, className, bad, children }: { show: boolean; delay: number; rot: number; className: string; bad?: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      aria-hidden
      initial={show ? { opacity: 0, scale: 1.9, rotate: rot } : { opacity: 0.85, scale: 1, rotate: rot }}
      animate={{ opacity: 0.85, scale: 1, rotate: rot }}
      transition={{ delay: show ? delay : 0, type: 'spring', stiffness: 380, damping: 18 }}
      className={cn(
        'pointer-events-none absolute rounded-lg border-[2.5px] px-3 py-1 text-center font-display text-[13px] font-bold uppercase leading-tight tracking-[0.08em] mix-blend-screen [&_small]:block [&_small]:font-mono [&_small]:text-[9px] [&_small]:font-medium [&_small]:tracking-[0.12em]',
        bad ? 'border-[#ff6a55] text-[#ff8a78] text-base' : 'border-[#d9a441] text-[#e8b65a]',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

function Guilloche() {
  const paths = useMemo(() => {
    const out: string[] = []
    for (let k = 0; k < 22; k++) {
      let d = ''
      for (let x = 0; x <= 900; x += 6) {
        const y = 280 + Math.sin(x / 70 + k * 0.45) * (110 + k * 4) * Math.cos(x / 260 - k * 0.2)
        d += `${x ? 'L' : 'M'}${x},${y.toFixed(1)}`
      }
      out.push(d)
    }
    return out
  }, [])
  return (
    <svg aria-hidden viewBox="0 0 900 560" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full opacity-40">
      {paths.map((d, k) => (
        <path key={k} d={d} fill="none" stroke={k % 2 ? 'rgb(217 164 65 / 0.22)' : 'rgb(175 192 207 / 0.12)'} strokeWidth="0.8" />
      ))}
    </svg>
  )
}
