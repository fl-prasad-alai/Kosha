import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AlertOctagon, Pause, Share2, Sparkles, TrendingUp, Volume2 } from 'lucide-react'
import type { Assessment } from '@shared/types'
import { LANGUAGES } from '@shared/questions'
import { GlowingBadge } from '@/components/unlumen-ui/glowing-badge'
import TypewriterText from '@/components/smoothui/typewriter-text'
import BorderBeam from '@/components/smoothui/border-beam'
import { Passport } from './passport/Passport'
import { ShareSheet } from './passport/ShareSheet'
import { fromAssessment, publicOf } from '@/lib/passportView'
import { useAuth } from '@/state/auth'
import { Pentagon, PillarBars, ScheduleChart } from './Charts'
import { EvidenceChip } from './Evidence'
import { IdentityPanel } from './Assurance'
import { AnimatedNumber, Panel, StatusIcon, StatusPill } from './ui'
import { say, stopSpeaking } from '@/lib/audio'
import { money, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

export function PassportResult({ a, fresh = false, onSaved }: { a: Assessment; fresh?: boolean; onSaved?: (a: Assessment) => void }) {
  const c = a.profile.currency
  const f = (n: number) => money(n, c)
  const [active, setActive] = useState<string | null>(null)
  const [lang, setLang] = useState<'local' | 'english'>(a.explanation.localLang !== 'en' ? 'local' : 'english')
  const [playing, setPlaying] = useState(false)
  const [sharing, setSharing] = useState(false)
  const user = useAuth((s) => s.user)
  // only the owner's copy carries consent; lenders get the passport without it
  const who = a.consent && (!a.ownerId || a.ownerId === user?.id) ? 'owner' : user?.role === 'lender' ? 'lender' : 'other'
  const view = useMemo(() => fromAssessment(a), [a])
  const pub = useMemo(() => publicOf(a), [a])
  const status = a.offer.status
  const text = lang === 'local' ? a.explanation.local : a.explanation.english
  const shown = a.checks.filter((x) => x.status !== 'missing')
  const missing = a.checks.filter((x) => x.status === 'missing')

  const listen = async () => {
    if (playing) {
      stopSpeaking()
      return setPlaying(false)
    }
    setPlaying(true)
    try {
      await say(text, lang === 'local' ? LANGUAGES[a.explanation.localLang]?.speech ?? 'en-US' : 'en-US')
    } finally {
      setPlaying(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Card + offer */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <motion.div initial={fresh ? { opacity: 0, y: 30, rotateX: 12 } : false} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} style={{ perspective: 1200 }}>
          <Passport v={view} live={fresh} onShare={() => setSharing(true)} />
        </motion.div>

        <BorderBeam active={status === 'offer'} colorFrom="#ffd27a" colorTo="#3ee0c4" duration={7} radius={24} className="rounded-3xl">
          <Panel className="h-full">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">The offer</span>
              {status === 'offer' && <GlowingBadge variant="success" pulse dot>Ready to offer</GlowingBadge>}
              {status === 'hold' && <GlowingBadge variant="error" pulse dot>On hold</GlowingBadge>}
              {status === 'decline' && <GlowingBadge variant="warning" dot>Not yet</GlowingBadge>}
            </div>
            {status === 'hold' ? (
              <div className="mt-4 flex gap-3 rounded-2xl border border-vermilion/40 bg-vermilion/10 p-4">
                <AlertOctagon className="mt-0.5 size-5 shrink-0 text-vermilion" />
                <div className="text-sm">
                  <p className="font-semibold text-vermilion">No offer until one record is checked</p>
                  <p className="mt-1">{a.checks.find((x) => x.id === 'integrity' && x.status === 'fail')?.finding ?? a.checks.find((x) => x.status === 'fail')?.finding}</p>
                  <p className="mt-2 text-ink-2">If the record checks out, the shop would qualify for up to <b className="text-ink">{f(a.offer.limit)}</b>.</p>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-sm text-ink-2">Working-capital limit</div>
                <div className="font-display text-[clamp(40px,5vw,56px)] leading-none text-gold-grad tabular">
                  {fresh ? <AnimatedNumber value={a.offer.limit} duration={1.8} format={(n) => f(n)} /> : f(a.offer.limit)}
                </div>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-line p-3"><div className="text-ink-3">Tenure</div><div className="mt-0.5 font-medium">{a.offer.tenureMonths} months</div></div>
              <div className="rounded-2xl border border-line p-3"><div className="text-ink-3">Rate</div><div className="mt-0.5 font-medium">{Math.round(a.offer.annualRate * 100)}% a year</div></div>
              <div className="rounded-2xl border border-line p-3"><div className="text-ink-3">Usual instalment</div><div className="mt-0.5 font-medium tabular">{f(a.offer.flatEmi)} / month</div></div>
              <div className="rounded-2xl border border-line p-3"><div className="text-ink-3">Share of monthly surplus</div><div className="mt-0.5 font-medium">{pct(a.offer.emiToSurplus)}</div></div>
            </div>
            {a.purpose && (
              <div className={cn('mt-4 rounded-2xl p-4 text-sm', a.purpose.paysForItself ? 'bg-jade/10 ring-1 ring-jade/30' : 'bg-glass ring-1 ring-line')}>
                <div className="flex items-center gap-2 font-semibold">
                  <TrendingUp className={cn('size-4', a.purpose.paysForItself ? 'text-jade' : 'text-ink-2')} />
                  {a.purpose.paysForItself ? 'This loan pays for itself' : 'What the loan is for'}
                </div>
                <p className="mt-1.5">
                  {a.purpose.summary}: about {f(a.purpose.cost)}, adding roughly <b>{f(a.purpose.extraMonthlyProfit)}</b> a month in profit. The instalment on {f(a.purpose.cost)} would be about {f(a.purpose.emi ?? 0)} a month{a.purpose.paysForItself ? ', so the extra profit covers it.' : ', more than the extra profit.'}
                </p>
                <p className="mt-1 text-xs text-ink-3">{a.purpose.reasoning}</p>
              </div>
            )}
          </Panel>
        </BorderBeam>
      </div>

      <IdentityPanel id={a.identity} />

      {/* Cross-check */}
      <Panel>
        <div className="eyebrow">Cross-check</div>
        <h2 className="font-display mt-1 text-3xl">Do the sources agree?</h2>
        <p className="mt-1 max-w-[62ch] text-ink-2">Any single document can be faked. Getting a ledger, supplier bills, payment records, electricity bills and the neighbourhood to agree with each other is much harder.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Pentagon checks={a.checks} active={active} onActive={setActive} animate={fresh} />
            <p className="text-center text-xs text-ink-3">Each line is a check between two sources. Green agrees, amber needs a look, red failed, dashed was not checked.</p>
          </div>
          <ul className="space-y-2.5">
            {shown.map((x, i) => (
              <motion.li
                key={x.id}
                initial={fresh ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: fresh ? 0.3 + i * 0.12 : 0 }}
                onMouseEnter={() => setActive(x.id)}
                onMouseLeave={() => setActive(null)}
                className={cn('flex gap-3 rounded-2xl border p-4 transition', active === x.id ? 'border-gold/60 bg-gold/5' : 'border-line', x.status === 'fail' && 'border-vermilion/50')}
              >
                <StatusIcon status={x.status} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-medium">{x.title} <StatusPill status={x.status} /></div>
                  <p className="mt-1 text-sm text-ink-2">{x.finding}</p>
                  {x.refs.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{x.refs.map((r, k) => <EvidenceChip key={k} r={r} />)}</div>}
                </div>
              </motion.li>
            ))}
            {missing.length > 0 && (
              <li className="rounded-2xl border border-dashed border-line-2 p-4 text-sm text-ink-3">Not checked because a document was missing: {missing.map((m) => m.title.toLowerCase()).join('; ')}.</li>
            )}
          </ul>
        </div>
      </Panel>

      {/* Why */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Panel>
          <div className="eyebrow">Score breakdown</div>
          <h2 className="font-display mt-1 text-2xl">{a.score} out of 900</h2>
          <p className="mb-5 mt-1 text-sm text-ink-2">Weighted 35% capacity, 30% character, 20% stability and 15% conditions. A failed integrity check holds the offer whatever the score.</p>
          <PillarBars pillars={a.pillars} />
        </Panel>
        <Panel>
          <div className="eyebrow">Why this result</div>
          <ul className="mt-3 space-y-3.5">
            {a.reasons.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-sm font-bold', r.sign === 'plus' ? 'bg-jade/15 text-jade' : r.sign === 'minus' ? 'bg-amber-k/15 text-amber-k' : 'bg-vermilion/15 text-vermilion')}>
                  {r.sign === 'plus' ? '+' : r.sign === 'minus' ? '−' : '!'}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] leading-relaxed">{r.text}</p>
                  {r.refs.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{r.refs.map((x, k) => <EvidenceChip key={k} r={x} />)}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Schedule + explanation */}
      <div className="grid gap-6 lg:grid-cols-2">
        {status !== 'decline' && a.offer.schedule.length > 0 && (
          <Panel>
            <div className="eyebrow">Repayment that follows the seasons</div>
            <h2 className="font-display mt-1 text-2xl">Pay more in festival months, less in lean ones</h2>
            <p className="mb-6 mt-1 text-sm text-ink-2">Gemini read the shop's busy seasons. The total repaid is the same as a fixed instalment at the same rate.</p>
            <ScheduleChart schedule={a.offer.schedule} flatEmi={a.offer.flatEmi} currency={c} />
          </Panel>
        )}
        <Panel className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="eyebrow flex items-center gap-1.5"><Sparkles className="size-3.5" /> Told to {a.profile.ownerName.split(' ')[0]}</span>
            {a.explanation.localLang !== 'en' && (
              <div className="glass flex rounded-full p-1 text-sm">
                {(['local', 'english'] as const).map((l) => (
                  <button key={l} onClick={() => setLang(l)} className={cn('rounded-full px-3 py-1 transition', lang === l ? 'bg-gold text-[#1b1203]' : 'text-ink-2')}>
                    {l === 'local' ? LANGUAGES[a.explanation.localLang]?.label ?? 'Local' : 'English'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div key={lang} className={cn('mt-4 flex-1 text-lg leading-relaxed', lang === 'local' && 'font-local')}>
            {fresh ? <TypewriterText speed={18}>{text}</TypewriterText> : <p>{text}</p>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={listen} className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-[#1b1203]">
              {playing ? <><Pause className="size-4" /> Stop</> : <><Volume2 className="size-4" /> Listen</>}
            </button>
            <button onClick={() => setSharing(true)} className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
              <Share2 className="size-4" /> Share passport
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-3">Voice by Gemini text-to-speech. {a.geminiCalls ? `${a.geminiCalls} Gemini call${a.geminiCalls > 1 ? 's' : ''} for this step.` : ''}</p>
        </Panel>
      </div>
      <ShareSheet open={sharing} onClose={() => setSharing(false)} pub={pub} who={who} user={user} owned={who === 'owner' ? a : undefined} onSaved={onSaved} />
    </div>
  )
}
