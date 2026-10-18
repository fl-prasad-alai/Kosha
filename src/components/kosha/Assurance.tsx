// How strongly the owner's identity and the business registration are proven, shown the same way everywhere:
// in the build step, on the passport, in the lender's view and (levels only) on the public record.
import { BadgeCheck, Building2, FileSearch, Fingerprint, PenLine, ShieldCheck, UserRound } from 'lucide-react'
import type { IdentitySummary, ProofLevel } from '@shared/types'
import { PROOF_LABEL } from '@shared/types'
import { StatusIcon } from './ui'
import { cn } from '@/lib/utils'

const RANK: ProofLevel[] = ['none', 'self', 'document', 'registry', 'signed']
const TONE: Record<ProofLevel, string> = {
  none: 'border-line text-ink-3',
  self: 'border-amber-k/40 text-amber-k bg-amber-k/10',
  document: 'border-sky-500/40 text-sky-700 bg-sky-500/10 dark:text-sky-300',
  registry: 'border-jade/40 text-jade bg-jade/10',
  signed: 'border-jade/50 text-jade bg-jade/15',
}
const ICON: Record<ProofLevel, typeof ShieldCheck> = { none: PenLine, self: PenLine, document: FileSearch, registry: BadgeCheck, signed: ShieldCheck }

export function ProofBadge({ level, className }: { level: ProofLevel; className?: string }) {
  const Icon = ICON[level]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', TONE[level], className)}>
      <Icon className="size-3" /> {PROOF_LABEL[level]}
    </span>
  )
}

/** Four-step meter: self-declared → document → registry → govt-signed. */
export function AssuranceMeter({ label, level, icon: Icon, hint }: { label: string; level: ProofLevel; icon: typeof UserRound; hint?: string }) {
  const n = RANK.indexOf(level)
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-gold" /> {label}</span>
        <ProofBadge level={level} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {RANK.slice(1).map((r, i) => <span key={r} className={cn('h-1.5 rounded-full transition-colors', i < n ? (n >= 3 ? 'bg-jade' : 'bg-gold') : 'bg-line-2')} />)}
      </div>
      {hint && <p className="mt-2 text-xs text-ink-3">{hint}</p>}
    </div>
  )
}

/** Small assurance line for passports and queues: "ID · Govt-signed  Business · Document". */
export function AssuranceLine({ idLevel = 'none', bizLevel = 'none', className }: { idLevel?: ProofLevel; bizLevel?: ProofLevel; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <span className="inline-flex items-center gap-1 text-[11px] text-ink-3"><Fingerprint className="size-3" />ID</span><ProofBadge level={idLevel} />
      <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-ink-3"><Building2 className="size-3" />Business</span><ProofBadge level={bizLevel} />
    </span>
  )
}

/** The full panel: every identity and registration fact, with how it was proven. Numbers are masked. */
export function IdentityPanel({ id, className }: { id?: IdentitySummary; className?: string }) {
  if (!id) return null
  return (
    <section className={cn('glass rounded-3xl p-5 sm:p-6', className)} aria-label="Verified identity">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Verified identity</div>
          <h3 className="mt-1 text-lg font-semibold">Who runs this shop, and is it registered?</h3>
        </div>
        <AssuranceLine idLevel={id.person} bizLevel={id.business} />
      </div>
      {id.facts.length ? (
        <ul className="mt-4 divide-y divide-line">
          {id.facts.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <StatusIcon status={f.status} className="size-4" />
              <span className="w-28 shrink-0 text-ink-3">{f.label}</span>
              <span className="min-w-0 flex-1 font-mono text-[13px]">{f.value}{f.note && <span className="ml-2 font-sans text-xs text-ink-3">{f.note}</span>}</span>
              <span className="text-xs text-ink-3">{f.source}</span>
              <ProofBadge level={f.proof} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-2">No identity was added. Treat every detail on this passport as self-declared.</p>
      )}
      <p className="mt-3 text-xs text-ink-3">Kosha keeps only these results. ID numbers are masked, card photos are not stored, and a PAN is kept only as a one-way fingerprint for the one-identity-one-shop check.</p>
    </section>
  )
}
