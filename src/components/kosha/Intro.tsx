import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { BookOpenText, Check, MapPin, QrCode, Receipt, Zap } from 'lucide-react'

// Opening explainer, in vector: a phone photographs the khata, Gemini turns each handwritten line
// into a checked record, the records flow into the Kosha credit passport, the score fills.

type Box = { x: number; y: number; w: number; h: number }
interface Layout {
  W: number
  H: number
  phone: Box
  chip: { x: number; ys: number[]; w: number; h: number }
  docs: { xs: number[]; y: number }
  passport: Box
  final: { x: number; y: number; s: number }
  flows: boolean
}

const WIDE: Layout = {
  W: 1120, H: 540,
  phone: { x: 30, y: 20, w: 240, h: 490 },
  chip: { x: 360, ys: [96, 172, 248, 324], w: 340, h: 60 },
  docs: { xs: [392, 492, 592], y: 416 },
  passport: { x: 800, y: 60, w: 290, h: 412 },
  final: { x: 415, y: 60, s: 1.06 },
  flows: true,
}

const TALL: Layout = {
  W: 460, H: 800,
  phone: { x: 130, y: 0, w: 200, h: 380 },
  chip: { x: 20, ys: [410, 478, 546, 614], w: 420, h: 58 },
  docs: { xs: [101, 191, 281], y: 690 },
  passport: { x: 85, y: 388, w: 290, h: 412 },
  final: { x: 85, y: 170, s: 1.1 },
  flows: false,
}

const ROWS = [
  { d: '22/9', local: 'बिक्री नकद', amt: '5,480/-', en: 'Cash sale', val: '₹5,480', Icon: BookOpenText },
  { d: '24/9', local: 'माल अग्रवाल', amt: '33,206/-', en: 'Stock bought', val: '₹33,206', Icon: Receipt },
  { d: '25/9', local: 'UPI जमा', amt: '8,250/-', en: 'UPI received', val: '₹8,250 / day', Icon: QrCode },
  { d: '6/10', local: 'बिजली बिल', amt: '5,480/-', en: 'Electricity bill', val: 'Paid on time', Icon: Zap },
]

// seconds
const T = { phone: 0, scan: 0.5, chips: 1.25, docs: 1.95, passport: 2.6, score: 3.1, final: 3.95, end: 4.95 }
const EXIT = 0.45
const ease = [0.22, 1, 0.36, 1] as const
const spring = { type: 'spring', stiffness: 170, damping: 22 } as const

const HEADLINES: [number, string][] = [
  [T.phone, 'Snap the shop’s ledger.'],
  [T.chips, 'Gemini reads and cross-checks it.'],
  [T.passport, 'Out comes a credit passport.'],
]
const STEPS = ['Snap the ledger', 'Read & check', 'Credit passport']

function useStageScale(ref: React.RefObject<HTMLDivElement | null>) {
  const [fit, setFit] = useState({ k: 1, L: WIDE })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      const L = w / h < 0.85 ? TALL : WIDE
      setFit({ k: Math.min(w / L.W, h / L.H), L })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return fit
}

export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion()
  const area = useRef<HTMLDivElement>(null)
  const { k, L } = useStageScale(area)
  const [t, setT] = useState(reduced ? T.final : 0)
  const [leaving, setLeaving] = useState(false)
  const finished = useRef(false)

  const finish = () => {
    if (finished.current) return
    finished.current = true
    setLeaving(true)
    setTimeout(onDone, EXIT * 1000 + 60)
  }

  // A coarse clock: React only re-renders at each beat of the story.
  useEffect(() => {
    if (reduced) {
      const id = setTimeout(finish, 1200)
      return () => clearTimeout(id)
    }
    // Dev only: ?introAt=3.2 freezes the story at that beat, for checking frames.
    const frozen = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('introAt') ?? NaN) : NaN
    if (Number.isFinite(frozen)) {
      const beats = [T.scan, T.chips, T.docs, T.passport, T.score, T.final].filter((b) => b <= frozen)
      const ids = beats.map((b, i) => setTimeout(() => setT(b), i * 350))
      return () => ids.forEach(clearTimeout)
    }
    const beats = [T.scan, T.chips, T.docs, T.passport, T.score, T.final]
    const ids = beats.map((b) => setTimeout(() => setT(b), b * 1000))
    ids.push(setTimeout(finish, T.end * 1000))
    const key = (e: KeyboardEvent) => ['Escape', 'Enter', ' '].includes(e.key) && finish()
    addEventListener('keydown', key)
    return () => {
      ids.forEach(clearTimeout)
      removeEventListener('keydown', key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const at = (x: number) => t >= x
  const headline = [...HEADLINES].reverse().find(([s]) => t >= s)?.[1]
  const step = at(T.passport) ? 2 : at(T.chips) ? 1 : 0
  const P = L.passport
  const pc = { x: P.x + P.w / 2, y: P.y + P.h / 2 }

  return (
    <motion.div
      role="status"
      aria-label="Opening Kosha"
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#05070d] text-[#f6ead0]"
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: EXIT, ease: [0.4, 0, 1, 1] }}
      onClick={finish}
    >
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-[min(140vw,1200px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(242_181_68/0.10),transparent_60%)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: 'linear-gradient(rgb(255 255 255 / 0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.035) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000 30%, transparent 75%)',
        }}
      />

      {/* Headline */}
      <div className="relative flex h-[clamp(96px,17vh,160px)] shrink-0 items-end justify-center px-6 pb-2 text-center">
        <AnimatePresence mode="wait">
          {!at(T.final) ? (
            <motion.h2
              key={headline}
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)', transition: { duration: 0.2 } }}
              transition={{ duration: 0.45, ease }}
              className="font-display text-balance text-[clamp(24px,4vw,46px)] font-medium leading-tight tracking-[-0.02em]"
            >
              {headline}
            </motion.h2>
          ) : (
            <motion.div key="mark" initial={{ opacity: 0, y: 12, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.55, ease }} className="flex flex-col items-center gap-1">
              <span className="font-display text-gold-grad text-[clamp(40px,6.5vw,76px)] font-medium leading-none tracking-[-0.03em]">Kosha</span>
              <span className="text-balance text-[clamp(13px,1.6vw,17px)] text-[#f6ead0]/70">The AI credit passport for every corner shop</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stage */}
      <div ref={area} className="relative min-h-0 flex-1 px-4">
        <div aria-hidden className="absolute left-1/2 top-1/2" style={{ width: L.W, height: L.H, transform: `translate(-50%, -50%) scale(${k})`, perspective: 1600 }}>
          {L.flows && (
            <svg className="pointer-events-none absolute inset-0" width={L.W} height={L.H} fill="none">
              {L.chip.ys.map((y, i) => {
                const a = { x: L.phone.x + L.phone.w - 8, y: L.phone.y + 170 + i * 46 }
                const b = { x: L.chip.x, y: y + L.chip.h / 2 }
                const c = { x: L.chip.x + L.chip.w, y: y + L.chip.h / 2 }
                return (
                  <g key={i}>
                    <motion.path d={`M${a.x} ${a.y} C ${a.x + 50} ${a.y}, ${b.x - 50} ${b.y}, ${b.x} ${b.y}`} stroke="#3ee0c4" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 5"
                      initial={{ pathLength: 0 }} animate={{ pathLength: at(T.chips) ? 1 : 0, opacity: at(T.final) ? 0 : 1 }} transition={{ duration: 0.5, delay: at(T.chips) && !at(T.docs) ? i * 0.12 : 0 }} />
                    <motion.path d={`M${c.x} ${c.y} C ${c.x + 60} ${c.y}, ${P.x - 60} ${pc.y}, ${P.x} ${pc.y}`} stroke="#f2b544" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 5"
                      initial={{ pathLength: 0 }} animate={{ pathLength: at(T.passport) ? 1 : 0, opacity: at(T.final) ? 0 : 1 }} transition={{ duration: 0.5, delay: i * 0.06 }} />
                  </g>
                )
              })}
            </svg>
          )}

          <Phone box={L.phone} t={t} />

          {ROWS.map((r, i) => {
            const y = L.chip.ys[i]
            const from = { x: L.phone.x + 30 - L.chip.x, y: L.phone.y + 150 + i * 46 - y }
            const into = { x: pc.x - (L.chip.x + L.chip.w / 2), y: pc.y - (y + L.chip.h / 2) }
            const state = at(T.passport) ? 'into' : at(T.chips) ? 'shown' : 'hidden'
            return (
              <motion.div
                key={r.en}
                className="absolute flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f1626]/90 px-3.5 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.8)] backdrop-blur"
                style={{ left: L.chip.x, top: y, width: L.chip.w, height: L.chip.h }}
                initial={{ x: from.x, y: from.y, scale: 0.4, opacity: 0 }}
                animate={
                  state === 'hidden'
                    ? { x: from.x, y: from.y, scale: 0.4, opacity: 0 }
                    : state === 'shown'
                      ? { x: 0, y: 0, scale: 1, opacity: 1 }
                      : { x: into.x, y: into.y, scale: 0.25, opacity: 0 }
                }
                transition={state === 'into' ? { duration: 0.5, ease: [0.55, 0, 0.75, 0.2], delay: i * 0.05 } : { ...spring, delay: i * 0.12 }}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f2b544]/12 text-[#f2b544]"><r.Icon className="size-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-['Kalam',cursive] text-[13px] leading-tight text-[#f6ead0]/55">{r.local} · {r.amt}</span>
                  <span className="block truncate text-[15px] font-semibold leading-tight">{r.en}</span>
                </span>
                <span className="shrink-0 font-mono text-[13px] text-[#f6ead0]/85 tabular-nums">{r.val}</span>
                <motion.span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#3ee0c4] text-[#03201c]" initial={{ scale: 0 }} animate={{ scale: at(T.docs) ? 1 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18, delay: i * 0.1 }}>
                  <Check className="size-3.5" strokeWidth={3} />
                </motion.span>
              </motion.div>
            )
          })}

          {/* Supporting proof: bills and payments, each checked */}
          {[
            { label: 'Supplier bill', Icon: Receipt },
            { label: 'UPI statement', Icon: QrCode },
            { label: 'Power bill', Icon: Zap },
          ].map((d, i) => (
            <motion.div
              key={d.label}
              className="absolute flex w-[78px] flex-col items-center gap-1.5"
              style={{ left: L.docs.xs[i], top: L.docs.y }}
              initial={{ opacity: 0, y: 16, scale: 0.8 }}
              animate={at(T.docs) && !at(T.passport) ? { opacity: 1, y: 0, scale: 1 } : at(T.passport) ? { opacity: 0, x: pc.x - L.docs.xs[i] - 39, y: pc.y - L.docs.y - 40, scale: 0.3 } : { opacity: 0, y: 16, scale: 0.8 }}
              transition={at(T.passport) ? { duration: 0.45, ease: [0.55, 0, 0.75, 0.2], delay: 0.2 + i * 0.05 } : { ...spring, delay: i * 0.1 }}
            >
              <DocSheet Icon={d.Icon} />
              <span className="whitespace-nowrap text-[11px] text-[#f6ead0]/60">{d.label}</span>
            </motion.div>
          ))}

          <Passport L={L} t={t} />
        </div>
      </div>

      {/* Three-step progress */}
      <div className="relative mx-auto flex w-full max-w-[640px] shrink-0 gap-3 px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-3">
        {STEPS.map((s, i) => (
          <div key={s} className="min-w-0 flex-1">
            <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#ffd27a] to-[#f2b544]" initial={{ width: '0%' }} animate={{ width: step > i || at(T.final) ? '100%' : step === i ? '55%' : '0%' }} transition={{ duration: step === i ? 0.9 : 0.3, ease }} />
            </div>
            <div className={`mt-2 truncate text-[11px] sm:text-xs ${step >= i ? 'text-[#f6ead0]/85' : 'text-[#f6ead0]/35'}`}>
              <span className="mr-1 font-mono text-[#f2b544]">{i + 1}</span>
              {s}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          finish()
        }}
        className="absolute right-[max(16px,env(safe-area-inset-right))] top-[max(16px,env(safe-area-inset-top))] min-h-11 rounded-full border border-white/15 bg-white/[0.03] px-5 text-sm text-[#f6ead0]/70 transition hover:border-white/35 hover:text-[#f6ead0] focus-visible:outline-2 focus-visible:outline-[#f2b544]"
      >
        Skip intro
      </button>
    </motion.div>
  )
}

// ───────────────────────────────────────── phone with the khata in the viewfinder

function Phone({ box, t }: { box: Box; t: number }) {
  const scanning = t >= T.scan && t < T.chips + 0.4
  return (
    <motion.div
      className="absolute"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h, transformStyle: 'preserve-3d' }}
      initial={{ opacity: 0, y: 60, rotateX: 18, rotateY: 14 }}
      animate={t >= T.final ? { opacity: 0, x: -40, scale: 0.92, rotateY: 14 } : { opacity: 1, y: 0, rotateX: 4, rotateY: 10 }}
      transition={t >= T.final ? { duration: 0.4, ease } : { ...spring, stiffness: 120 }}
    >
      <div className="absolute inset-0 rounded-[38px] border-[2px] border-[#2b3550] bg-gradient-to-b from-[#141b2c] to-[#0a0f1b] p-[10px] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.08)]">
        <div className="relative size-full overflow-hidden rounded-[30px] bg-[#2a1d12]">
          {/* the photographed page */}
          <svg viewBox="0 0 220 470" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
            <defs>
              <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3b2817" />
                <stop offset="1" stopColor="#24170c" />
              </linearGradient>
            </defs>
            <rect width="220" height="470" fill="url(#wood)" />
            <g transform="rotate(-4 110 250)">
              <rect x="18" y="70" width="190" height="330" rx="4" fill="#f3ead2" />
              {Array.from({ length: 11 }, (_, i) => (
                <line key={i} x1="18" x2="208" y1={120 + i * 26} y2={120 + i * 26} stroke="#9fb4cf" strokeWidth="0.8" />
              ))}
              <line x1="52" x2="52" y1="70" y2="400" stroke="#d98b8b" strokeWidth="1" />
              <text x="60" y="100" fontFamily="Kalam, cursive" fontWeight="700" fontSize="15" fill="#22325a">शर्मा जनरल स्टोर</text>
              {ROWS.map((r, i) => (
                <g key={r.d} fontFamily="Kalam, cursive" fill="#22325a">
                  <text x="22" y={140 + i * 46} fontSize="10">{r.d}</text>
                  <text x="58" y={140 + i * 46} fontSize="13">{r.local}</text>
                  <text x="202" y={140 + i * 46} fontSize="12" textAnchor="end">{r.amt}</text>
                </g>
              ))}
            </g>
          </svg>
          {/* rows light up as they are read */}
          {ROWS.map((_, i) => (
            <motion.div
              key={i}
              className="absolute left-[6%] right-[4%] h-[30px] rounded-md border border-[#3ee0c4]/70 bg-[#3ee0c4]/15"
              style={{ top: 118 + i * 46, rotate: -4 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: t >= T.chips ? [0, 1, 0.55] : 0 }}
              transition={{ duration: 0.5, delay: t >= T.chips && t < T.docs ? i * 0.12 : 0 }}
            />
          ))}
          {/* viewfinder */}
          {[
            'left-3 top-14 border-l-2 border-t-2 rounded-tl-xl',
            'right-3 top-14 border-r-2 border-t-2 rounded-tr-xl',
            'left-3 bottom-20 border-l-2 border-b-2 rounded-bl-xl',
            'right-3 bottom-20 border-r-2 border-b-2 rounded-br-xl',
          ].map((c) => (
            <motion.span key={c} className={`absolute size-7 border-[#f2b544] ${c}`} initial={{ opacity: 0, scale: 1.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, duration: 0.35 }} />
          ))}
          <motion.div
            className="absolute inset-x-3 h-12"
            style={{ background: 'linear-gradient(to bottom, transparent, rgb(62 224 196 / 0.35))', borderBottom: '2px solid #3ee0c4', boxShadow: '0 8px 24px -6px rgb(62 224 196 / 0.8)' }}
            initial={{ top: 40, opacity: 0 }}
            animate={scanning ? { top: [56, 360], opacity: [0, 1, 1, 0] } : { opacity: 0 }}
            transition={{ duration: 1.05, ease: [0.45, 0, 0.55, 1] }}
          />
          {/* camera chrome */}
          <div className="absolute inset-x-0 top-0 flex h-11 items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-5 pt-3 text-[10px] font-medium text-white/80">
            <span>Kosha</span>
            <span className="rounded-full bg-[#3ee0c4]/20 px-2 py-0.5 text-[#3ee0c4]">{t >= T.chips ? 'Read ✓' : 'Scanning…'}</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-[72px] items-center justify-center bg-gradient-to-t from-black/70 to-transparent">
            <motion.span className="size-12 rounded-full border-[3px] border-white/85 bg-white/20" animate={t >= T.scan && t < T.chips ? { scale: [1, 0.86, 1] } : { scale: 1 }} transition={{ duration: 0.3 }} />
          </div>
          <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        </div>
      </div>
    </motion.div>
  )
}

function DocSheet({ Icon }: { Icon: typeof Receipt }) {
  return (
    <div className="relative h-[86px] w-[68px] rounded-md bg-[#f3ead2] p-2 shadow-[0_14px_28px_-14px_rgb(0_0_0/0.9)]">
      <Icon className="size-4 text-[#b7791f]" />
      <div className="mt-1.5 space-y-1.5">
        {[0.9, 0.7, 0.85, 0.55].map((w, i) => (
          <div key={i} className="h-[3px] rounded-full bg-[#22325a]/25" style={{ width: `${w * 100}%` }} />
        ))}
      </div>
      <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#3ee0c4] text-[#03201c] ring-4 ring-[#05070d]">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </div>
  )
}

// ───────────────────────────────────────── the passport

function Passport({ L, t }: { L: Layout; t: number }) {
  const P = L.passport
  const shown = t >= T.passport
  const final = t >= T.final
  const score = useMotionValue(300)
  const text = useTransform(score, (v) => String(Math.round(v)))
  const ring = useTransform(score, (v) => 289 * (1 - (v - 300) / 600))
  useEffect(() => {
    if (t >= T.score) {
      const c = animate(score, 794, { duration: 1.1, ease: [0.22, 1, 0.36, 1] })
      return () => c.stop()
    }
  }, [t, score])

  return (
    <motion.div
      className="absolute"
      style={{ left: P.x, top: P.y, width: P.w, height: P.h, transformStyle: 'preserve-3d' }}
      initial={{ opacity: 0, rotateY: -95, scale: 0.85 }}
      animate={
        final
          ? { opacity: 1, rotateY: 0, x: L.final.x - P.x, y: L.final.y - P.y, scale: L.final.s }
          : shown
            ? { opacity: 1, rotateY: -8, scale: 1 }
            : { opacity: 0, rotateY: -95, scale: 0.85 }
      }
      transition={final ? { type: 'spring', stiffness: 90, damping: 18 } : { type: 'spring', stiffness: 80, damping: 15, delay: 0.25 }}
    >
      <div
        className="relative size-full overflow-hidden rounded-[22px] border border-[#f2b544]/40 p-5"
        style={{ background: 'radial-gradient(130% 90% at 100% 0%, #1f3a5e, #0a1222 62%)', boxShadow: '0 40px 90px -30px rgb(242 181 68 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.08)' }}
      >
        <svg aria-hidden className="pointer-events-none absolute inset-0 size-full opacity-30" viewBox="0 0 290 412" preserveAspectRatio="none">
          {Array.from({ length: 14 }, (_, k) => (
            <path key={k} d={`M0 ${200 + k * 4} C 70 ${120 + k * 14}, 200 ${300 - k * 10}, 290 ${180 + k * 6}`} fill="none" stroke="#d9a441" strokeOpacity="0.35" strokeWidth="0.6" />
          ))}
        </svg>
        <div className="relative flex items-start justify-between">
          <div>
            <div className="font-mono text-[9.5px] tracking-[0.2em] text-[#d9a441]">CREDIT PASSPORT</div>
            <div className="font-display text-[22px] font-semibold tracking-[0.06em]">KOSHA</div>
          </div>
          <svg viewBox="0 0 64 64" className="size-9">
            <path d="M32 6 54 18v16c0 12-9.5 20.5-22 24C19.5 54.5 10 46 10 34V18Z" fill="none" stroke="#f2b544" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="32" cy="31" r="8.5" fill="none" stroke="#f2b544" strokeWidth="2.6" />
            <path d="M32 22.5v17M23.5 31h17" stroke="#ffd27a" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative mt-4 flex gap-3.5">
          <ShopArt />
          <div className="min-w-0 space-y-1.5 text-[11.5px]">
            {[['Holder', 'Sunita Sharma'], ['Business', 'Sharma General Store'], ['Location', 'Kothrud, Pune']].map(([k, v]) => (
              <div key={k}>
                <div className="font-mono text-[8.5px] tracking-[0.14em] text-[#9fb0c6]">{k.toUpperCase()}</div>
                <div className="truncate font-medium">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-5 flex items-center gap-4">
          <div className="relative size-[104px] shrink-0">
            <svg viewBox="0 0 104 104" className="size-full -rotate-90">
              <circle cx="52" cy="52" r="46" fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="8" />
              <motion.circle cx="52" cy="52" r="46" fill="none" stroke="#f2b544" strokeWidth="8" strokeLinecap="round" strokeDasharray="289" style={{ strokeDashoffset: ring }} />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <motion.span className="font-display text-[28px] font-semibold leading-none tabular-nums">{text}</motion.span>
              <span className="mt-1 font-mono text-[8px] tracking-[0.16em] text-[#c9b893]">SCORE</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#9fb0c6]">Working-capital offer</div>
            <div className="font-display text-[26px] font-semibold leading-tight text-[#ffd27a]">₹80,000</div>
            <div className="text-[11px] text-[#9fb0c6]">12 months · band A−</div>
          </div>
        </div>

        <div className="relative mt-3">
          <div className="font-mono text-[8.5px] tracking-[0.14em] text-[#9fb0c6]">CROSS-CHECKED</div>
          <div className="mt-1.5 flex gap-1.5">
            {[BookOpenText, Receipt, QrCode, Zap, MapPin].map((Icon, i) => (
              <motion.span
                key={i}
                className="relative grid size-7 place-items-center rounded-lg border border-[#f2b544]/30 bg-[#f2b544]/10 text-[#f2b544]"
                initial={{ opacity: 0, y: 6 }}
                animate={t >= T.score ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                transition={{ delay: 0.15 + i * 0.08 }}
              >
                <Icon className="size-3.5" />
                <span className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full bg-[#3ee0c4] text-[#03201c]"><Check className="size-2.5" strokeWidth={3.5} /></span>
              </motion.span>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-5 bottom-3 border-t border-[#f6ead0]/15 pt-2 font-mono text-[9px] tracking-[0.12em] text-[#f6ead0]/55">
          KP&lt;IND&lt;SHARMA&lt;&lt;SUNITA&lt;&lt;&lt;&lt;&lt;&lt;
        </div>

        <motion.div
          className="absolute right-4 top-[330px] rounded-md border-2 border-[#3ee0c4] bg-[#0a1222]/70 px-2 py-0.5 text-center font-display text-[12px] font-bold uppercase leading-tight tracking-[0.08em] text-[#3ee0c4]"
          initial={{ opacity: 0, scale: 2, rotate: -14 }}
          animate={t >= T.score ? { opacity: 1, scale: 1, rotate: -10 } : { opacity: 0, scale: 2, rotate: -14 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.75 }}
        >
          Verified
        </motion.div>

        {/* foil sheen */}
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-1/2"
          style={{ background: 'linear-gradient(100deg, transparent, rgb(255 230 170 / 0.18), transparent)' }}
          initial={{ x: '-120%' }}
          animate={final ? { x: '260%' } : { x: '-120%' }}
          transition={{ duration: 1, ease: 'easeInOut', delay: 0.15 }}
        />
      </div>
    </motion.div>
  )
}

function ShopArt() {
  return (
    <svg viewBox="0 0 80 96" className="h-[96px] w-[80px] shrink-0 overflow-hidden rounded-lg border border-[#d9a441]/50">
      <rect width="80" height="96" fill="#1a2438" />
      <rect x="0" y="62" width="80" height="34" fill="#2a2016" />
      <rect x="6" y="20" width="68" height="44" fill="#3a2c1c" />
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <rect x="8" y={26 + r * 13} width="64" height="2" fill="#6b4a2a" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={10 + i * 9} y={18 + r * 13} width="6" height="8" rx="1" fill={['#e0533a', '#f2b544', '#3ea8e0', '#5fc27a', '#f6ead0'][(i + r) % 5]} />
          ))}
        </g>
      ))}
      <path d="M2 20 L78 20 L74 8 L6 8 Z" fill="#c0392b" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${6 + i * 12} 20 q6 7 12 0`} fill={i % 2 ? '#f6ead0' : '#c0392b'} />
      ))}
      <rect x="10" y="10" width="60" height="7" rx="1" fill="#f2b544" />
      <rect x="22" y="70" width="36" height="20" rx="2" fill="#4a3825" />
      <rect x="26" y="74" width="12" height="9" rx="1" fill="#f6ead0" opacity="0.85" />
    </svg>
  )
}
