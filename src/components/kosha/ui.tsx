import { useEffect, useState, type ReactNode } from 'react'
import { CountUp } from '@/components/unlumen-ui/count-up'
import { motion } from 'motion/react'
import { AlertTriangle, Check, CircleDashed, RotateCw, X } from 'lucide-react'
import type { CallMeta, CheckStatus } from '@shared/types'
import AILoader from '@/components/smoothui/ai-loader'
import { ShimmeringText } from '@/components/unlumen-ui/shimmering-text'
import { cn } from '@/lib/utils'

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('glass rounded-3xl p-5 sm:p-6', className)}>{children}</section>
}

export function StepHeader({ eyebrow, title, sub, right }: { eyebrow: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-[62ch]">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="font-display mt-1.5 text-[clamp(28px,3.4vw,40px)] leading-tight">{title}</h1>
        {sub && <p className="mt-2 text-ink-2">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'gold' | 'jade' | 'red' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-glass px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={cn('mt-0.5 truncate font-display text-xl tabular', tone === 'gold' && 'text-gold', tone === 'jade' && 'text-jade', tone === 'red' && 'text-vermilion')}>{value}</div>
    </div>
  )
}

const PILL: Record<CheckStatus, string> = {
  pass: 'bg-jade/12 text-jade ring-jade/30',
  watch: 'bg-amber-k/12 text-amber-k ring-amber-k/30',
  fail: 'bg-vermilion/12 text-vermilion ring-vermilion/30',
  missing: 'bg-glass text-ink-3 ring-line',
}
const PILL_LABEL: Record<CheckStatus, string> = { pass: 'Consistent', watch: 'Watch', fail: 'Failed', missing: 'Not checked' }

export function StatusPill({ status, children }: { status: CheckStatus; children?: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] ring-1', PILL[status])}>{children ?? PILL_LABEL[status]}</span>
}

export function StatusIcon({ status, className }: { status: CheckStatus; className?: string }) {
  const Icon = status === 'pass' ? Check : status === 'watch' ? AlertTriangle : status === 'fail' ? X : CircleDashed
  return (
    <span className={cn('grid size-8 shrink-0 place-items-center rounded-full ring-1', PILL[status], className)}>
      <Icon className="size-4" />
    </span>
  )
}

/** "Gemini is reading" state, with the live phrase shimmering. */
export function Reading({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 text-sm text-jade', className)}>
      <AILoader variant="grid" />
      <ShimmeringText text={text} duration={1.8} className="font-medium" />
    </div>
  )
}

export function ErrorNote({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-vermilion/40 bg-vermilion/10 px-4 py-3 text-sm">
      <AlertTriangle className="size-4 shrink-0 text-vermilion" />
      <span className="min-w-0 flex-1">{error}</span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full bg-vermilion/20 px-3 py-1 font-medium hover:bg-vermilion/30">
          <RotateCw className="size-3.5" /> Try again
        </button>
      )}
    </motion.div>
  )
}

export function MetaLine({ meta }: { meta?: CallMeta }) {
  if (!meta) return null
  return (
    <span className="font-mono text-[10.5px] text-ink-3">
      {meta.model} · {(meta.ms / 1000).toFixed(1)} s · {meta.tokensIn.toLocaleString()} tokens in{meta.cached ? ' · cached' : ''}
    </span>
  )
}

export const fieldCls =
  'w-full rounded-xl border border-line bg-glass px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition focus:border-gold/70 focus:ring-2 focus:ring-gold/25'

/** CountUp that hands over to the exact formatted value when it finishes, so springs never leave it short. */
export function AnimatedNumber({ value, from = 0, duration = 1.6, delay = 0, format }: { value: number; from?: number; duration?: number; delay?: number; format: (n: number) => string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDone(false)
    const t = setTimeout(() => setDone(true), (delay + duration) * 1000 + 250)
    return () => clearTimeout(t)
  }, [value, duration, delay])
  return done ? <>{format(value)}</> : <CountUp to={value} from={from} duration={duration} delay={delay} digitEffect="slide" separator="," />
}
