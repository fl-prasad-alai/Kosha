import { useState } from 'react'
import { motion } from 'motion/react'
import type { Check, Pillar, Place, ScheduleMonth, SourceNode } from '@shared/types'
import { money, monthLabel, shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────── Neighbourhood radar

export function Radar({ places, scanning, shopName }: { places: Place[]; scanning?: boolean; shopName: string }) {
  const [hover, setHover] = useState<string | null>(null)
  const R = 160
  const MAX = 900
  const rings = [250, 500, 800]
  const pos = (p: Place) => {
    const r = (Math.min(p.distanceM, MAX) / MAX) * R
    const a = ((p.bearingDeg - 90) * Math.PI) / 180
    return { x: 180 + r * Math.cos(a), y: 180 + r * Math.sin(a) }
  }
  const hovered = places.find((p) => p.name === hover)
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <svg viewBox="0 0 360 360" className="w-full" role="img" aria-label={`Map of places around ${shopName}`}>
        <defs>
          <radialGradient id="rg" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="rgb(var(--k-gold-rgb) / 0.16)" />
            <stop offset="1" stopColor="rgb(var(--k-gold-rgb) / 0)" />
          </radialGradient>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgb(var(--k-jade-rgb) / 0)" />
            <stop offset="1" stopColor="rgb(var(--k-jade-rgb) / 0.35)" />
          </linearGradient>
        </defs>
        <circle cx="180" cy="180" r={R + 8} fill="url(#rg)" />
        {rings.map((m) => (
          <g key={m}>
            <circle cx="180" cy="180" r={(m / MAX) * R} fill="none" stroke="var(--k-line-2)" strokeDasharray="3 5" />
            <text x={180 + 4} y={180 - (m / MAX) * R - 4} fontSize="9" fill="var(--k-ink-3)" fontFamily="var(--font-mono)">{m} m</text>
          </g>
        ))}
        <line x1="180" y1="10" x2="180" y2="350" stroke="var(--k-line)" />
        <line x1="10" y1="180" x2="350" y2="180" stroke="var(--k-line)" />
        <text x="180" y="9" textAnchor="middle" fontSize="9" fill="var(--k-ink-3)" fontFamily="var(--font-mono)">N</text>
        <motion.g style={{ originX: '180px', originY: '180px' }} animate={{ rotate: 360 }} transition={{ duration: scanning ? 2.2 : 9, repeat: Infinity, ease: 'linear' }}>
          <path d={`M180 180 L${180 + R} 180 A${R} ${R} 0 0 0 ${180 + R * Math.cos(-0.7)} ${180 + R * Math.sin(-0.7)} Z`} fill="url(#sweep)" />
        </motion.g>
        {places.map((p, i) => {
          const { x, y } = pos(p)
          const driver = p.kind === 'driver'
          return (
            <motion.g
              key={p.name + i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 400, damping: 20 }}
              style={{ originX: `${x}px`, originY: `${y}px` }}
              onMouseEnter={() => setHover(p.name)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            >
              <circle cx={x} cy={y} r={hover === p.name ? 9 : 6} fill={driver ? 'var(--k-jade)' : 'var(--k-vermilion)'} opacity="0.25" />
              <circle cx={x} cy={y} r="3.6" fill={driver ? 'var(--k-jade)' : 'var(--k-vermilion)'} />
            </motion.g>
          )
        })}
        <circle cx="180" cy="180" r="9" fill="var(--k-gold)" />
        <circle cx="180" cy="180" r="16" fill="none" stroke="var(--k-gold)" opacity="0.5">
          <animate attributeName="r" values="10;22;10" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2.6s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-ink-2">
        {hovered ? (
          <span className="rounded-full bg-night/80 px-3 py-1">
            <b className="text-ink">{hovered.name}</b> · {hovered.category} · {hovered.distanceM} m
          </span>
        ) : (
          <span className="flex justify-center gap-4">
            <span><i className="mr-1 inline-block size-2 rounded-full bg-jade" />Brings customers</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-vermilion" />Competitor</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── Five-source pentagon

const NODES: { id: SourceNode; label: string }[] = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'invoice', label: 'Supplier bills' },
  { id: 'payments', label: 'Payments' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'location', label: 'Location' },
]

export function Pentagon({ checks, active, onActive, animate = true }: { checks: Check[]; active?: string | null; onActive?: (id: string | null) => void; animate?: boolean }) {
  const pts = Object.fromEntries(
    NODES.map((n, i) => {
      const a = (-90 + i * 72) * (Math.PI / 180)
      return [n.id, { x: 200 + 140 * Math.cos(a), y: 190 + 140 * Math.sin(a) }]
    }),
  ) as Record<string, { x: number; y: number }>
  const color = (s: Check['status']) => (s === 'pass' ? 'var(--k-jade)' : s === 'watch' ? 'var(--k-amber)' : s === 'fail' ? 'var(--k-vermilion)' : 'var(--k-line-2)')
  const edges = checks.filter((c) => c.edge && pts[c.edge[0]] && pts[c.edge[1]])
  const integrity = checks.find((c) => c.id === 'integrity')
  return (
    <svg viewBox="0 0 400 380" className="w-full" role="img" aria-label="How the five sources agree with each other">
      {edges.map((c, i) => {
        const a = pts[c.edge![0]], b = pts[c.edge![1]]
        const on = active === c.id
        return (
          <motion.line
            key={c.id}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={color(c.status)}
            strokeWidth={on ? 5 : 3}
            strokeLinecap="round"
            strokeDasharray={c.status === 'missing' ? '4 7' : undefined}
            initial={animate ? { pathLength: 0, opacity: 0 } : false}
            animate={{ pathLength: 1, opacity: active && !on ? 0.3 : 1 }}
            transition={{ delay: animate ? 0.3 + i * 0.25 : 0, duration: 0.7 }}
            onMouseEnter={() => onActive?.(c.id)}
            onMouseLeave={() => onActive?.(null)}
            className="cursor-pointer"
            style={{ filter: c.status === 'pass' ? 'drop-shadow(0 0 6px rgb(var(--k-jade-rgb) / 0.6))' : undefined }}
          />
        )
      })}
      {NODES.map((n) => {
        const p = pts[n.id]
        const bad = n.id === 'payments' && integrity?.status === 'fail'
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r="30" fill="var(--k-bg-2)" stroke={bad ? 'var(--k-vermilion)' : 'var(--k-gold)'} strokeWidth="1.6" />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--k-ink)">{n.label.split(' ')[0]}</text>
            {n.label.includes(' ') && <text x={p.x} y={p.y + 16} textAnchor="middle" fontSize="9" fill="var(--k-ink-2)">{n.label.split(' ')[1]}</text>}
            {bad && (
              <g>
                <circle cx={p.x + 24} cy={p.y - 22} r="10" fill="var(--k-vermilion)" />
                <text x={p.x + 24} y={p.y - 18} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">!</text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────── Daily payments bars

export function DailyBars({ daily, flags, currency, height = 120 }: { daily: { date: string; amount: number }[]; flags: { date: string; amount: number }[]; currency: string; height?: number }) {
  if (!daily.length) return null
  const flagged = new Map(flags.map((f) => [f.date, f.amount]))
  const clean = daily.map((d) => Math.max(0, d.amount - (flagged.get(d.date) ?? 0)))
  const avg = clean.reduce((a, b) => a + b, 0) / clean.length
  const top = Math.max(...clean) * 1.25
  return (
    <div>
      <div className="relative flex items-end gap-[3px]" style={{ height }}>
        {daily.map((d, i) => {
          const f = flagged.get(d.date)
          return (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${shortDate(d.date)}: ${money(clean[i], currency)}${f ? ` + ${money(f, currency)} flagged` : ''}`}>
              {f ? <div className="hatch mb-px h-[22%] rounded-t-[3px]" /> : null}
              <motion.div
                className={cn('rounded-t-[3px] bg-jade/80 group-hover:bg-jade', f && 'rounded-t-none')}
                initial={{ height: 0 }}
                animate={{ height: `${Math.min(100, (clean[i] / top) * 100)}%` }}
                transition={{ delay: i * 0.015, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          )
        })}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gold" style={{ bottom: `${(avg / top) * 100}%` }}>
          <span className="absolute -top-5 right-0 rounded bg-night/80 px-1.5 font-mono text-[10px] text-gold">avg {money(avg, currency)}</span>
        </div>
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-3">
        <span>{shortDate(daily[0].date)}</span>
        <span>{shortDate(daily[daily.length - 1].date)}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── Seasonal repayment schedule

export function ScheduleChart({ schedule, flatEmi, currency }: { schedule: ScheduleMonth[]; flatEmi: number; currency: string }) {
  if (!schedule.length) return null
  const top = Math.max(...schedule.map((s) => s.instalment), flatEmi) * 1.2
  return (
    <div>
      <div className="relative flex h-40 items-end gap-1.5">
        {schedule.map((s, i) => (
          <div key={s.month} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${monthLabel(s.month)}: ${money(s.instalment, currency)}${s.festival ? ` · ${s.festival}` : ''}`}>
            {s.festival && s.multiplier >= 1.05 && (
              <span className="absolute -top-0.5 max-w-full truncate font-mono text-[9px] text-gold" style={{ bottom: `${(s.instalment / top) * 100 + 4}%`, top: 'auto' }}>
                {s.festival.split(/[,(]/)[0].trim().slice(0, 9)}
              </span>
            )}
            <motion.div
              className={cn('w-full rounded-t-md', s.multiplier >= 1.05 ? 'bg-gradient-to-t from-gold/70 to-gold-2' : s.multiplier <= 0.95 ? 'bg-jade/50' : 'bg-ink-3/50')}
              initial={{ height: 0 }}
              animate={{ height: `${(s.instalment / top) * 100}%` }}
              transition={{ delay: i * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-2" style={{ bottom: `${(flatEmi / top) * 100}%` }}>
          <span className="absolute -top-5 left-0 rounded bg-night/80 px-1.5 font-mono text-[10px] text-ink-2">fixed EMI {money(flatEmi, currency)}</span>
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {schedule.map((s) => (
          <span key={s.month} className="flex-1 text-center font-mono text-[10px] text-ink-3">{monthLabel(s.month)}</span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── Pillar bars

export function PillarBars({ pillars }: { pillars: Pillar[] }) {
  return (
    <div className="grid gap-3">
      {pillars.map((p, i) => (
        <div key={p.id}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium">{p.label}</span>
            <span className="font-mono tabular text-ink-2">{p.score}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-glass ring-1 ring-line">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-2" initial={{ width: 0 }} animate={{ width: `${p.score}%` }} transition={{ delay: 0.2 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <p className="mt-1 text-xs text-ink-3">{p.drivers.join(' · ')}</p>
        </div>
      ))}
    </div>
  )
}
