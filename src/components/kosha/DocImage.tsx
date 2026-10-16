import { motion } from 'motion/react'
import { FileText } from 'lucide-react'
import type { Box } from '@shared/types'
import { cn } from '@/lib/utils'

export interface Mark {
  id: string
  box?: Box
  tone?: 'jade' | 'gold' | 'red'
  label?: string
}

const TONE = {
  jade: 'border-jade/45 bg-jade/[0.04]',
  gold: 'border-gold/60 bg-gold/[0.06]',
  red: 'border-vermilion/70 bg-vermilion/10',
}

interface Props {
  url: string
  type: string
  name?: string
  marks?: Mark[]
  active?: string | null
  scanning?: boolean
  onHover?: (id: string | null) => void
  className?: string
  stagger?: number
}

/** A document photo with Gemini's bounding boxes drawn over it. */
export function DocImage({ url, type, name, marks = [], active, scanning, onHover, className, stagger = 0.04 }: Props) {
  if (type === 'application/pdf') {
    return (
      <div className={cn('grid aspect-[3/4] place-items-center rounded-xl border border-line bg-glass text-ink-2', className)}>
        <div className="flex flex-col items-center gap-2 text-sm">
          <FileText className="size-8 text-gold" />
          <span className="max-w-[16ch] truncate">{name ?? 'PDF document'}</span>
        </div>
      </div>
    )
  }
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-line bg-black/40', className)}>
      <img src={url} alt={name ?? 'Uploaded document'} className="block w-full select-none" draggable={false} />
      {marks.map((m, i) =>
        m.box ? (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * stagger, duration: 0.3 }}
            onMouseEnter={() => onHover?.(m.id)}
            onMouseLeave={() => onHover?.(null)}
            className={cn(
              'absolute rounded-[4px] border-[1.5px] transition-shadow',
              TONE[m.tone ?? 'jade'],
              active === m.id && 'z-10 border-gold bg-gold/25 shadow-[0_0_0_4px_rgb(var(--k-gold-rgb)/0.35)]',
              active && active !== m.id && 'opacity-25',
            )}
            style={{
              top: `${m.box[0] / 10}%`,
              left: `${m.box[1] / 10}%`,
              height: `${Math.max(1.2, (m.box[2] - m.box[0]) / 10)}%`,
              width: `${Math.max(2, (m.box[3] - m.box[1]) / 10)}%`,
            }}
          >
            {m.label && active === m.id && (
              <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-gold px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#1b1203]">{m.label}</span>
            )}
          </motion.div>
        ) : null,
      )}
      {scanning && <div className="scan-beam" />}
    </div>
  )
}
