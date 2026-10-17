import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, ArrowUpRight, BadgeCheck, Clock, FileQuestion, Plus, ScrollText, XCircle } from 'lucide-react'
import type { Assessment, Decision, PassportSummary } from '@shared/types'
import { listPassports } from '@/lib/api'
import { money } from '@/lib/format'
import { useAuth } from '@/state/auth'
import { useKosha } from '@/state/kosha'
import { MagneticButton } from '@/components/unlumen-ui/magnetic-button'
import { ErrorNote, Panel, Reading, Stat } from '@/components/kosha/ui'
import { ConsentManager } from '@/components/kosha/Consent'
import { cn } from '@/lib/utils'

const DECISION: Record<Decision['status'], { label: string; cls: string; Icon: typeof BadgeCheck }> = {
  approved: { label: 'Offer approved', cls: 'bg-jade/12 text-jade ring-jade/30', Icon: BadgeCheck },
  more_info: { label: 'Lender needs documents', cls: 'bg-amber-k/12 text-amber-k ring-amber-k/30', Icon: FileQuestion },
  declined: { label: 'Declined', cls: 'bg-vermilion/12 text-vermilion ring-vermilion/30', Icon: XCircle },
}

function Ring({ score, held }: { score: number; held: boolean }) {
  const C = 2 * Math.PI * 26
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90">
      <circle cx="32" cy="32" r="26" fill="none" stroke="var(--k-line-2)" strokeWidth="6" />
      <circle cx="32" cy="32" r="26" fill="none" stroke={held ? 'var(--k-vermilion)' : 'var(--k-gold)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (score - 300) / 600)} />
      <text x="32" y="37" textAnchor="middle" transform="rotate(90 32 32)" fontSize="15" fontWeight="600" fill="var(--k-ink)" fontFamily="var(--font-display)">{score}</text>
    </svg>
  )
}

export default function Home() {
  const user = useAuth((s) => s.user)!
  const nav = useNavigate()
  const reset = useKosha((s) => s.reset)
  const [rows, setRows] = useState<PassportSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => void listPassports().then(setRows).catch((e) => setError((e as Error).message)), [])

  const first = user.name.split(' ')[0]
  const latest = rows?.[0]
  const offers = rows?.filter((r) => r.decision?.status === 'approved').length ?? 0
  const responses = rows?.filter((r) => r.decision).length ?? 0
  // Consent changes apply on the server at once; mirror them in the list.
  const saved = (a: Assessment) => setRows((rs) => rs?.map((x) => (x.id === a.id ? { ...x, consent: a.consent, views: a.access?.length ?? x.views } : x)) ?? rs)
  const startNew = () => {
    reset()
    nav('/build')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="eyebrow">{user.org}</div>
          <h1 className="font-display mt-1.5 text-[clamp(32px,4.4vw,52px)] leading-tight">Namaste, {first}</h1>
          <p className="mt-1 text-ink-2">Your credit passports, and what lenders have said about them.</p>
        </motion.div>
        <MagneticButton onClick={startNew} className="h-12 rounded-full bg-gradient-to-r from-gold-2 to-gold px-6 text-[15px] font-semibold text-[#1b1203] shadow-[0_10px_40px_-12px_rgb(var(--k-gold-rgb)/0.9)]">
          <Plus className="size-4" /> Build a new passport
        </MagneticButton>
      </div>

      {error && <div className="mt-6"><ErrorNote error={error} /></div>}
      {!rows && !error && <Reading className="mt-8" text="Loading your passports…" />}

      {rows && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Latest score" value={latest ? `${latest.score} · ${latest.status === 'hold' ? 'on hold' : latest.band}` : '—'} tone="gold" />
            <Stat label="Best offer" value={rows.filter((r) => r.status === 'offer').reduce((a, r) => Math.max(a, r.limit), 0) ? money(Math.max(...rows.filter((r) => r.status === 'offer').map((r) => r.limit)), rows[0].currency) : '—'} />
            <Stat label="Passports issued" value={rows.length} />
            <Stat label="Lender responses" value={responses ? `${responses} · ${offers} approved` : 'None yet'} tone="jade" />
          </div>

          {rows.length === 0 ? (
            <Panel className="mt-6 flex flex-col items-center gap-3 py-14 text-center">
              <ScrollText className="size-9 text-gold" />
              <h2 className="font-display text-2xl">No passports yet</h2>
              <p className="max-w-sm text-sm text-ink-2">Photograph a few pages of your ledger and a couple of bills. Kosha turns them into a credit passport in about two minutes.</p>
              <button onClick={startNew} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-[#1b1203]">Build my first passport <ArrowRight className="size-4" /></button>
            </Panel>
          ) : (
            <ul className="mt-6 grid gap-4 lg:grid-cols-2">
              {rows.map((r, i) => {
                const d = r.decision ? DECISION[r.decision.status] : null
                return (
                  <motion.li key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.45 }}>
                    <div className="glass group rounded-3xl transition hover:border-gold/40">
                      <Link to={`/passport/${r.id}`} className="flex gap-4 p-4 sm:p-5">
                        {r.thumbnail ? <img src={r.thumbnail} alt="" className="hidden size-24 shrink-0 rounded-2xl object-cover sm:block" /> : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{r.shopName}</div>
                              <div className="font-mono text-[11px] text-ink-3">{r.id} · {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                            </div>
                            <Ring score={r.score} held={r.status === 'hold'} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            {r.status === 'offer' && <span className="font-display text-xl text-gold">{money(r.limit, r.currency)}</span>}
                            {r.status === 'hold' && <span className="rounded-full bg-vermilion/12 px-2.5 py-0.5 text-xs text-vermilion ring-1 ring-vermilion/30">On hold · {r.flags[0] ?? 'a record needs checking'}</span>}
                            {r.status === 'decline' && <span className="text-ink-2">No offer yet</span>}
                          </div>
                          <div className="mt-3 border-t border-line pt-3">
                            {d ? (
                              <div className="flex items-start gap-2 text-sm">
                                <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1', d.cls)}><d.Icon className="size-3.5" />{d.label}</span>
                                <span className="min-w-0 text-ink-2"><b className="font-medium text-ink">{r.decision!.org}</b>{r.decision!.note ? `: ${r.decision!.note}` : ''}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-ink-3"><Clock className="size-4" /> {r.consent?.scope === 'none' ? 'Not shared, so no lender can review it' : 'Waiting for a lender to review'}</div>
                            )}
                          </div>
                        </div>
                        <ArrowUpRight className="size-4 shrink-0 text-ink-3 transition group-hover:text-gold" />
                      </Link>
                      <ConsentManager id={r.id} consent={r.consent} views={r.views} onSaved={saved} className="border-t border-line px-4 py-3 sm:px-5" />
                    </div>
                  </motion.li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
