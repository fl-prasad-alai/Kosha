import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, BookOpenText, Check, CircleDashed, Loader2, MapPin, Mic, Receipt, Smartphone, Sparkles, Store, Zap } from 'lucide-react'
import { LANGUAGES, QUESTIONS } from '@shared/questions'
import { useKosha, type Status } from '@/state/kosha'
import { MagneticButton } from '@/components/unlumen-ui/magnetic-button'
import { ShimmeringText } from '@/components/unlumen-ui/shimmering-text'
import { PassportResult } from '@/components/kosha/PassportResult'
import { ErrorNote, Panel, StepHeader } from '@/components/kosha/ui'
import { cn } from '@/lib/utils'

const PHASES = ['Cross-checking every source against the others…', 'Scoring capacity, character, conditions and stability…', 'Working out a limit the shop can repay…', 'Planning instalments around festival seasons…', 'Writing the explanation in the owner\'s language…']

function Item({ icon: Icon, label, status, note }: { icon: typeof Store; label: string; status: Status | 'skip'; note?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
      <Icon className="size-5 shrink-0 text-gold" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {note && <span className="block truncate text-xs text-ink-3">{note}</span>}
      </span>
      {status === 'done' ? <Check className="size-5 text-jade" /> : status === 'reading' ? <Loader2 className="size-5 animate-spin text-jade" /> : status === 'error' ? <span className="text-xs text-vermilion">Failed</span> : <CircleDashed className="size-5 text-ink-3" />}
    </li>
  )
}

export function StepPassport() {
  const s = useKosha()
  const [phase, setPhase] = useState(0)
  const answered = QUESTIONS.filter((q) => s.answers[q.id]?.status === 'done').length
  const reading = Object.values(s.docs).some((d) => d.status === 'reading') || s.location.status === 'reading'
  const canBuild = s.docs.ledger.status === 'done' && s.assessStatus !== 'reading'

  useEffect(() => {
    if (s.assessStatus !== 'reading') return setPhase(0)
    const t = setInterval(() => setPhase((p) => Math.min(PHASES.length - 1, p + 1)), 2600)
    return () => clearInterval(t)
  }, [s.assessStatus])

  if (s.assessment && s.assessStatus === 'done') {
    return (
      <>
        <StepHeader
          eyebrow="Step 6 · The passport"
          title={`${s.profile.shopName}'s credit passport`}
          sub="Issued from the shop's own records. Tap any green chip to see the exact line Gemini read."
          right={
            <div className="flex flex-wrap gap-2">
              <Link to={`/passport/${s.assessment.id}`} className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm">Open shareable page <ArrowUpRight className="size-4" /></Link>
              <Link to="/lender" className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm">Lender view <ArrowUpRight className="size-4" /></Link>
            </div>
          }
        />
        <PassportResult a={s.assessment} fresh />
      </>
    )
  }

  const d = s.docs
  return (
    <>
      <StepHeader eyebrow="Step 6 · The passport" title="Ready to issue the passport" sub="Kosha combines everything it has read. Missing sources are fine; the passport says exactly what was and was not checked." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel>
          <h3 className="mb-3 font-semibold">Evidence collected</h3>
          <ul className="space-y-2">
            <Item icon={Store} label="Shop details" status={s.profile.shopName && s.profile.address ? 'done' : 'idle'} note={s.profile.shopName} />
            <Item icon={BookOpenText} label="Handwritten ledger" status={d.ledger.status} note={d.ledger.result ? `${d.ledger.result.entries.length} lines read` : 'Required'} />
            <Item icon={Receipt} label="Supplier bills" status={d.invoice.status} note={d.invoice.result ? `${d.invoice.result.documents.length} bills` : 'Optional'} />
            <Item icon={Smartphone} label="Digital payments" status={d.payments.status} note={d.payments.result ? `${d.payments.result.daily.length} days${d.payments.result.flags.length ? ' · 1 flag' : ''}` : 'Optional'} />
            <Item icon={Zap} label="Electricity bills" status={d.electricity.status} note={d.electricity.result ? `${d.electricity.result.bills.length} months` : 'Optional'} />
            <Item icon={MapPin} label="Neighbourhood" status={s.location.status} note={s.location.result ? `${s.location.result.places.length} places found` : 'Optional'} />
            <Item icon={Mic} label="Voice interview" status={answered ? 'done' : 'idle'} note={`${answered} of ${QUESTIONS.length} answered`} />
          </ul>
        </Panel>
        <Panel className="relative flex flex-col items-center justify-center overflow-hidden text-center">
          <AnimatePresence mode="wait">
            {s.assessStatus === 'reading' ? (
              <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 py-10">
                <div className="relative size-28">
                  <motion.div className="absolute inset-0 rounded-full border-2 border-gold/30 border-t-gold" animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }} />
                  <motion.div className="absolute inset-3 rounded-full border-2 border-jade/30 border-b-jade" animate={{ rotate: -360 }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} />
                  <Sparkles className="absolute inset-0 m-auto size-8 text-gold" />
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={phase} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <ShimmeringText text={PHASES[phase].replace("the owner's language", LANGUAGES[s.profile.language]?.label ?? 'English')} className="text-lg font-medium" duration={1.6} />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5 py-8">
                <div className="font-display text-2xl">Issue the passport</div>
                <p className="max-w-sm text-sm text-ink-2">
                  {d.ledger.status !== 'done' ? 'The ledger must be read first.' : reading ? 'Some documents are still being read. You can wait, or issue now with what is ready.' : 'Everything is ready.'}
                </p>
                <MagneticButton
                  disabled={!canBuild}
                  onClick={() => void s.build()}
                  className="h-12 rounded-full bg-gradient-to-r from-gold-2 to-gold px-8 text-[15px] font-semibold text-[#1b1203] shadow-[0_10px_40px_-10px_rgb(var(--k-gold-rgb)/0.9)]"
                >
                  <Sparkles className="size-4" /> Build the credit passport
                </MagneticButton>
                {s.assessStatus === 'error' && <ErrorNote error={s.assessError!} onRetry={() => void s.build()} />}
              </motion.div>
            )}
          </AnimatePresence>
          <div className={cn('pointer-events-none absolute -bottom-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl transition-opacity', s.assessStatus === 'reading' ? 'opacity-100' : 'opacity-40')} />
        </Panel>
      </div>
    </>
  )
}
